import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';

export const NOTIFICATION_DIGEST_QUEUE = 'notification-digest';

@Injectable()
@Processor(NOTIFICATION_DIGEST_QUEUE)
export class NotificationDigestProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationDigestProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<{ frequency?: 'DAILY' | 'WEEKLY' }>): Promise<void> {
    const frequency = job.data.frequency ?? 'DAILY';
    this.logger.log(`Processing ${frequency} notification digest (job ${job.id})`);

    const users = await this.prisma.user.findMany({
      where: { digestFrequency: frequency as any },
    });

    const now = new Date();

    for (const user of users) {
      const since = user.lastDigestSentAt ?? new Date(0);

      const unread = await this.prisma.notification.findMany({
        where: {
          userId: user.id,
          read: false,
          createdAt: { gt: since },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (unread.length === 0) continue;

      this.logger.log(`Sending ${frequency} digest with ${unread.length} items to user ${user.id}`);

      await this.prisma.user.update({
        where: { id: user.id },
        data: { lastDigestSentAt: now },
      });
    }
  }
}
