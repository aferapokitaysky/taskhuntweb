import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { S3Service } from './s3.service';
import { resolveFileKind } from './file-kind.util';

export const FILE_SCAN_QUEUE = 'file-virus-scan';

const MAX_UPLOAD_BYTES = 200 * 1024 * 1024; // 200MB — APK/IPA/архивы бывают тяжёлые

@Injectable()
export class FilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
    @InjectQueue(FILE_SCAN_QUEUE) private readonly scanQueue: Queue,
  ) {}

  async uploadFile(ownerId: string, file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file provided');
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new BadRequestException(`File exceeds max size of ${MAX_UPLOAD_BYTES} bytes`);
    }

    const key = this.s3.buildKey(ownerId, file.originalname);
    await this.s3.upload(key, file.buffer, file.mimetype);

    const kind = resolveFileKind(file.mimetype, file.originalname);

    const asset = await this.prisma.fileAsset.create({
      data: {
        ownerId,
        url: key, // храним ключ объекта, не публичный URL — отдаём через presigned URL при скачивании
        mimeType: file.mimetype,
        sizeBytes: file.size,
        kind,
        scanStatus: 'PENDING',
      },
    });

    // Скан на вирусы — асинхронно, не блокируем ответ на аплоад.
    await this.scanQueue.add('scan', { fileAssetId: asset.id, key }, { attempts: 3 });

    return asset;
  }

  async getDownloadUrl(fileId: string, requesterId: string) {
    const asset = await this.prisma.fileAsset.findUnique({ where: { id: fileId } });
    if (!asset) throw new NotFoundException('File not found');
    if (asset.scanStatus === 'INFECTED') {
      throw new BadRequestException('File failed virus scan and is blocked');
    }
    // TODO(access-control): для файлов, привязанных к чужому чату/тикету,
    // здесь нужна дополнительная проверка "requesterId — участник треда".
    // Для MVP ограничиваемся тем, что ссылка временная (presigned, 1 час).
    void requesterId;

    return this.s3.getSignedDownloadUrl(asset.url);
  }
}
