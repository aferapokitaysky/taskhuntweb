import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../common/events/event-bus.service';
import { DomainEventName } from '@taskhunt/shared-types';

export const SUBSCRIPTION_EXPIRATION_QUEUE = 'subscription-expiration-queue';

@Processor(SUBSCRIPTION_EXPIRATION_QUEUE)
@Injectable()
export class SubscriptionExpirationProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(SubscriptionExpirationProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    @InjectQueue(SUBSCRIPTION_EXPIRATION_QUEUE) private readonly queue: Queue,
  ) {
    super();
  }

  async onModuleInit() {
    await this.queue.add(
      'check-expirations',
      {},
      {
        repeat: { pattern: '0 * * * *' },
        jobId: 'subscription-check-hourly',
      },
    );
  }

  async process(_job: Job): Promise<void> {
    const now = new Date();
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    const expiredCount = await this.prisma.subscription.updateMany({
      where: {
        status: 'ACTIVE',
        expiresAt: { lt: now },
      },
      data: {
        status: 'EXPIRED',
      },
    });

    if (expiredCount.count > 0) {
      this.logger.log(`Expired ${expiredCount.count} subscriptions`);
    }

    const expiringSoonSubs = await this.prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        expiresAt: {
          gt: now,
          lte: threeDaysFromNow,
        },
      },
      include: { tier: true },
    });

    for (const sub of expiringSoonSubs) {
      await this.eventBus.publish(DomainEventName.SubscriptionExpiringSoon, {
        userId: sub.userId,
        tierName: sub.tier.name,
        expiresAt: sub.expiresAt.toISOString(),
      });
    }

    if (expiringSoonSubs.length > 0) {
      this.logger.log(`Published SubscriptionExpiringSoon events for ${expiringSoonSubs.length} users`);
    }
  }
}
