import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { Readable } from 'stream';
import { PrismaService } from '../../prisma/prisma.service';
import { S3Service } from './s3.service';
import { FILE_SCAN_QUEUE } from './files.service';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const NodeClam = require('clamscan');

@Processor(FILE_SCAN_QUEUE)
export class FileScanProcessor extends WorkerHost {
  private readonly logger = new Logger(FileScanProcessor.name);
  private clamscanPromise: Promise<any> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3Service: S3Service,
    private readonly config: ConfigService,
  ) {
    super();
  }

  private async getClamScan(): Promise<any> {
    if (!this.clamscanPromise) {
      const host = this.config.get<string>('CLAMAV_HOST') ?? 'clamav';
      const port = Number(this.config.get<number>('CLAMAV_PORT') ?? 3310);

      this.clamscanPromise = new NodeClam().init({
        clamdscan: {
          host,
          port,
          timeout: 10000,
          active: true,
        },
        preference: 'clamdscan',
      });
    }
    return this.clamscanPromise;
  }

  async process(job: Job<{ fileAssetId: string; key: string }>): Promise<void> {
    this.logger.log(`Starting ClamAV virus scan for file ${job.data.key}`);

    try {
      const fileBuffer = await this.s3Service.downloadToBuffer(job.data.key);
      const clamscan = await this.getClamScan();

      const stream = Readable.from(fileBuffer);
      const { isInfected, viruses } = await clamscan.scanStream(stream);

      const status = isInfected ? 'INFECTED' : 'CLEAN';

      if (isInfected) {
        this.logger.warn(
          `File ${job.data.key} is INFECTED: ${viruses?.join(', ')}`,
        );
      } else {
        this.logger.log(`File ${job.data.key} scan result: CLEAN`);
      }

      await this.prisma.fileAsset.update({
        where: { id: job.data.fileAssetId },
        data: { scanStatus: status },
      });
    } catch (err) {
      this.logger.error(
        `ClamAV scan failed for file ${job.data.key} (daemon may be offline): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      // Бросаем ошибку, чтобы BullMQ переретраил задачу по attempts: 3,
      // сохраняя файл в статусе PENDING до успешного сканирования.
      throw err;
    }
  }
}
