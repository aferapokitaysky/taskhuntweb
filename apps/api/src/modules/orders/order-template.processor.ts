import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';

export const ORDER_TEMPLATE_QUEUE = 'order-template-processor';

@Injectable()
@Processor(ORDER_TEMPLATE_QUEUE)
export class OrderTemplateProcessor extends WorkerHost {
  private readonly logger = new Logger(OrderTemplateProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job): Promise<void> {
    this.logger.log(`Processing order templates job ${job.id}`);
    const now = new Date();

    const templates = await this.prisma.orderTemplate.findMany({
      where: {
        active: true,
        nextRunAt: { lte: now },
      },
    });

    for (const t of templates) {
      try {
        await this.prisma.order.create({
          data: {
            clientId: t.clientId,
            categoryId: t.categoryId,
            title: t.title,
            description: t.description,
            budgetMin: t.budgetMin,
            budgetMax: t.budgetMax,
            tags: t.tags,
            status: 'OPEN',
          },
        });

        const periodDays = t.frequency === 'WEEKLY' ? 7 : 30;
        const newNextRunAt = new Date(t.nextRunAt.getTime() + periodDays * 24 * 60 * 60 * 1000);

        await this.prisma.orderTemplate.update({
          where: { id: t.id },
          data: { nextRunAt: newNextRunAt },
        });

        this.logger.log(`Created order from template ${t.id} for client ${t.clientId}`);
      } catch (err: any) {
        this.logger.error(`Failed to process order template ${t.id}: ${err.message}`, err.stack);
      }
    }
  }
}
