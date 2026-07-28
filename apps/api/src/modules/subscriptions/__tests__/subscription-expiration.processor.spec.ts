import { SubscriptionExpirationProcessor } from '../subscription-expiration.processor';
import { DomainEventName } from '@taskhunt/shared-types';

describe('SubscriptionExpirationProcessor', () => {
  let processor: SubscriptionExpirationProcessor;
  let prisma: any;
  let eventBus: { publish: jest.Mock };
  let queue: { add: jest.Mock };

  beforeEach(() => {
    prisma = {
      subscription: {
        updateMany: jest.fn(),
        findMany: jest.fn(),
      },
    };

    eventBus = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    queue = {
      add: jest.fn().mockResolvedValue(undefined),
    };

    processor = new SubscriptionExpirationProcessor(
      prisma,
      eventBus as any,
      queue as any,
    );
  });

  it('переводит истекшие подписки в EXPIRED и шлет событие SubscriptionExpiringSoon для истекающих в 3 дня', async () => {
    prisma.subscription.updateMany.mockResolvedValue({ count: 2 });
    const expiresAtDate = new Date(Date.now() + 86400000); // 1 day in future
    prisma.subscription.findMany.mockResolvedValue([
      {
        userId: 'user-sub-1',
        tier: { name: 'PRO' },
        expiresAt: expiresAtDate,
      },
    ]);

    await processor.process({} as any);

    expect(prisma.subscription.updateMany).toHaveBeenCalledWith({
      where: {
        status: 'ACTIVE',
        expiresAt: { lt: expect.any(Date) },
      },
      data: {
        status: 'EXPIRED',
      },
    });

    expect(eventBus.publish).toHaveBeenCalledWith(
      DomainEventName.SubscriptionExpiringSoon,
      {
        userId: 'user-sub-1',
        tierName: 'PRO',
        expiresAt: expiresAtDate.toISOString(),
      },
    );
  });
});
