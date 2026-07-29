import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';

export const EXPIRED_ORDERS_QUEUE = 'expired-orders';

@Injectable()
@Processor(EXPIRED_ORDERS_QUEUE)
export class ExpiredOrdersProcessor extends WorkerHost {
  private readonly logger = new Logger(ExpiredOrdersProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job): Promise<void> {
    this.logger.log(`Processing expired orders check (job ${job.id})`);

    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

    const expiredCandidates = await this.prisma.order.findMany({
      where: {
        status: 'OPEN',
        createdAt: { lt: sixtyDaysAgo },
        bids: { none: {} },
      },
    });

    for (const order of expiredCandidates) {
      await this.prisma.order.update({
        where: { id: order.id },
        data: { status: 'EXPIRED' },
      });

      await this.prisma.notification.create({
        data: {
          userId: order.clientId,
          title: 'Заказ автоматически архивирован',
          message: `Ваш заказ «${order.title}» автоматически архивирован — 0 откликов за 60 дней, можно переопубликовать.`,
          eventName: 'OrderExpired',
        },
      });
    }

    this.logger.log(`Archived ${expiredCandidates.length} expired orders`);
  }
}
