import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';

export const DEADLINE_WARNING_QUEUE = 'deadline-warning-processor';

@Injectable()
@Processor(DEADLINE_WARNING_QUEUE)
export class DeadlineWarningProcessor extends WorkerHost {
  private readonly logger = new Logger(DeadlineWarningProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job): Promise<void> {
    this.logger.log(`Processing deadline warning job ${job.id}`);

    const now = new Date();
    const in48Hours = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    const orders = await this.prisma.order.findMany({
      where: {
        status: 'IN_PROGRESS',
        deadlineWarningSentAt: null,
        deadline: {
          gte: now,
          lte: in48Hours,
        },
      },
      include: {
        bids: { where: { status: 'ACCEPTED' } },
      },
    });

    for (const order of orders) {
      const acceptedBid = order.bids[0];
      if (!acceptedBid || !order.deadline) continue;

      try {
        const hoursLeft = Math.round((order.deadline.getTime() - now.getTime()) / (1000 * 60 * 60));

        await this.prisma.$transaction([
          this.prisma.notification.create({
            data: {
              userId: acceptedBid.freelancerId,
              title: 'Дедлайн близко',
              message: `Дедлайн по заказу «${order.title}» наступает через ${hoursLeft} ч.`,
              eventName: 'DeadlineApproaching',
            },
          }),
          this.prisma.order.update({
            where: { id: order.id },
            data: { deadlineWarningSentAt: now },
          }),
        ]);

        this.logger.log(`Sent deadline warning for order ${order.id} to freelancer ${acceptedBid.freelancerId}`);
      } catch (err: any) {
        this.logger.error(`Failed to send deadline warning for order ${order.id}: ${err.message}`, err.stack);
      }
    }
  }
}
