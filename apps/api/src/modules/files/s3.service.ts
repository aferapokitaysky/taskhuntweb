import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

/**
 * Тонкая обёртка над S3-совместимым хранилищем (Cloudflare R2, AWS S3,
 * MinIO — все они говорят одним протоколом). Ключ объекта всегда
 * `<ownerId>/<uuid>-<оригинальное имя>`, чтобы не было коллизий и было видно,
 * чей файл, даже глядя только в бакет.
 */
@Injectable()
export class S3Service {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(config: ConfigService) {
    this.bucket = config.get<string>('S3_BUCKET') ?? 'taskhunt';
    this.client = new S3Client({
      region: config.get<string>('S3_REGION') ?? 'auto',
      endpoint: config.get<string>('S3_ENDPOINT'),
      credentials: {
        accessKeyId: config.get<string>('S3_ACCESS_KEY_ID') ?? '',
        secretAccessKey: config.get<string>('S3_SECRET_ACCESS_KEY') ?? '',
      },
    });
  }

  buildKey(ownerId: string, originalName: string): string {
    return `${ownerId}/${randomUUID()}-${originalName}`;
  }

  async upload(key: string, body: Buffer, mimeType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: mimeType }),
    );
  }

  /** Публичные файлы отдаём напрямую через CDN-домен бакета, приватные — через presigned URL. */
  async getSignedDownloadUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }
}
