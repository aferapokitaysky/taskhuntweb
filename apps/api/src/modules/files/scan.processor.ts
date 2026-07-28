import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { FILE_SCAN_QUEUE } from './files.service';

/**
 * Заглушка антивирус-скана. В реальной эксплуатации здесь должен быть вызов
 * ClamAV (например, через `clamscan` / отдельный ClamAV-контейнер по TCP) —
 * это отдельная инфраструктурная задача (Phase 2), не блокирующая MVP.
 * Пока помечаем файл CLEAN, чтобы весь остальной флоу (chat/delivery) можно
 * было тестировать end-to-end уже сейчас.
 */
@Processor(FILE_SCAN_QUEUE)
export class FileScanProcessor extends WorkerHost {
  private readonly logger = new Logger(FileScanProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<{ fileAssetId: string; key: string }>): Promise<void> {
    this.logger.log(`Scanning file ${job.data.key} (stub: ClamAV integration — TODO)`);

    await this.prisma.fileAsset.update({
      where: { id: job.data.fileAssetId },
      data: { scanStatus: 'CLEAN' },
    });
  }
}
