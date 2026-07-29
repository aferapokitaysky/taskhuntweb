import {
  scoreBidSubmitted,
  scoreDisputeOpened,
  scoreEscrowReleased,
  scoreOrderCreated,
  scoreUserRegistered,
} from '../handlers/risk';

function fakeRedis(counts: number[]) {
  let i = 0;
  return {
    incr: jest.fn(async () => counts[Math.min(i++, counts.length - 1)]),
    expire: jest.fn(),
  } as any;
}

describe('scoreOrderCreated', () => {
  it('низкий бюджет + свежий аккаунт клиента дают повышенный риск', async () => {
    const prisma = {
      order: {
        findUnique: jest.fn().mockResolvedValue({
          budgetMin: 10,
          client: { id: 'client-1', createdAt: new Date(), profile: { disputesCount: 0 } },
          disputes: [],
        }),
      },
    } as any;

    const flag = await scoreOrderCreated(prisma, {
      name: 'OrderCreated',
      occurredAt: new Date().toISOString(),
      payload: { orderId: 'order-1', clientId: 'client-1', categoryId: 'cat-1', budgetMin: 10, budgetMax: null },
    } as any);

    expect(flag.reasons).toContain('budget_min_below_20');
    expect(flag.reasons).toContain('client_account_younger_than_24h');
    expect(flag.riskScore).toBeGreaterThan(0);
  });

  it('нормальный бюджет и старый аккаунт — риск 0', async () => {
    const prisma = {
      order: {
        findUnique: jest.fn().mockResolvedValue({
          budgetMin: 500,
          client: { id: 'client-1', createdAt: new Date('2020-01-01'), profile: { disputesCount: 0 } },
          disputes: [],
        }),
      },
    } as any;

    const flag = await scoreOrderCreated(prisma, {
      name: 'OrderCreated',
      occurredAt: new Date().toISOString(),
      payload: { orderId: 'order-1', clientId: 'client-1', categoryId: 'cat-1', budgetMin: 500, budgetMax: 600 },
    } as any);

    expect(flag.riskScore).toBe(0);
    expect(flag.severity).toBe('LOW');
  });
});

describe('scoreUserRegistered', () => {
  it('возвращает null (не проверяем) для OAuth-регистрации без IP', async () => {
    const redis = fakeRedis([1]);
    const flag = await scoreUserRegistered(redis, {
      name: 'UserRegistered',
      occurredAt: new Date().toISOString(),
      payload: { userId: 'u-1', email: 'a@b.com', role: 'CLIENT', ip: null },
    } as any);
    expect(flag).toBeNull();
    expect(redis.incr).not.toHaveBeenCalled();
  });

  it('1-2 регистрации с одного IP за час — не флагуем (обычный NAT/семья)', async () => {
    const redis = fakeRedis([2]);
    const flag = await scoreUserRegistered(redis, {
      name: 'UserRegistered',
      occurredAt: new Date().toISOString(),
      payload: { userId: 'u-1', email: 'a@b.com', role: 'CLIENT', ip: '1.2.3.4' },
    } as any);
    expect(flag).toBeNull();
  });

  it('3+ регистрации с одного IP за час — флагуем', async () => {
    const redis = fakeRedis([4]);
    const flag = await scoreUserRegistered(redis, {
      name: 'UserRegistered',
      occurredAt: new Date().toISOString(),
      payload: { userId: 'u-1', email: 'a@b.com', role: 'CLIENT', ip: '1.2.3.4' },
    } as any);
    expect(flag).not.toBeNull();
    expect(flag!.reasons[0]).toContain('registrations_from_same_ip_last_hour:4');
  });
});

describe('scoreBidSubmitted', () => {
  it('превышение скорости подачи откликов флагуется', async () => {
    const prisma = { bid: { findUnique: jest.fn().mockResolvedValue({ orderId: 'order-1' }) } } as any;
    const redis = fakeRedis([6]);

    const flag = await scoreBidSubmitted(prisma, redis, {
      name: 'BidSubmitted',
      occurredAt: new Date().toISOString(),
      payload: { bidId: 'bid-1', orderId: 'order-1', freelancerId: 'f-1', amount: 100 },
    } as any);

    expect(flag).not.toBeNull();
    expect(flag!.reasons.some((r) => r.startsWith('bid_spam_velocity'))).toBe(true);
  });

  it('нормальная скорость и адекватная сумма — null', async () => {
    const prisma = { bid: { findUnique: jest.fn() } } as any;
    const redis = fakeRedis([1]);

    const flag = await scoreBidSubmitted(prisma, redis, {
      name: 'BidSubmitted',
      occurredAt: new Date().toISOString(),
      payload: { bidId: 'bid-1', orderId: 'order-1', freelancerId: 'f-1', amount: 100 },
    } as any);

    expect(flag).toBeNull();
  });
});

describe('scoreEscrowReleased', () => {
  it('быстрые повторные релизы эскроу одному фрилансеру флагуются', async () => {
    const redis = fakeRedis([3]);
    const flag = await scoreEscrowReleased(redis, {
      name: 'EscrowReleased',
      occurredAt: new Date().toISOString(),
      payload: { orderId: 'order-1', walletId: 'w-1', amount: 100, toFreelancerId: 'f-1' },
    } as any);
    expect(flag).not.toBeNull();
    expect(flag!.reasons[0]).toContain('rapid_escrow_release_velocity');
  });

  it('единичный релиз — null', async () => {
    const redis = fakeRedis([1]);
    const flag = await scoreEscrowReleased(redis, {
      name: 'EscrowReleased',
      occurredAt: new Date().toISOString(),
      payload: { orderId: 'order-1', walletId: 'w-1', amount: 100, toFreelancerId: 'f-1' },
    } as any);
    expect(flag).toBeNull();
  });
});

describe('scoreDisputeOpened', () => {
  it('серийный "открыватель" споров (3+ за 30 дней) получает дополнительный риск', async () => {
    const prisma = {
      order: {
        findUnique: jest.fn().mockResolvedValue({
          client: { profile: { disputesCount: 0 } },
          disputes: [],
        }),
      },
    } as any;
    const redis = fakeRedis([3]);

    const flag = await scoreDisputeOpened(prisma, redis, {
      name: 'DisputeOpened',
      occurredAt: new Date().toISOString(),
      payload: { disputeId: 'd-1', orderId: 'order-1', openedById: 'u-1', reason: 'test' },
    } as any);

    expect(flag.reasons.some((r) => r.startsWith('serial_dispute_opener'))).toBe(true);
    expect(flag.riskScore).toBeGreaterThanOrEqual(65);
  });
});
