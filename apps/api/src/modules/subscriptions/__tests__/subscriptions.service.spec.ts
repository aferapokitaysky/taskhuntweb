import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SubscriptionsService } from '../subscriptions.service';

describe('SubscriptionsService', () => {
  let prisma: any;
  let nowPayments: { createPayment: jest.Mock };
  let service: SubscriptionsService;

  beforeEach(() => {
    prisma = {
      subscriptionTier: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
      subscription: {
        findUnique: jest.fn(),
        upsert: jest.fn().mockResolvedValue({ id: 'sub-1' }),
      },
    };
    nowPayments = { createPayment: jest.fn().mockResolvedValue({ paymentId: 'pay-1', payAddress: '0xabc' }) };
    const wallet = { getSystemWalletId: jest.fn().mockResolvedValue('system-wallet-1') };
    const ledger = { applyTransaction: jest.fn().mockResolvedValue(undefined) };
    service = new SubscriptionsService(prisma, nowPayments as any, wallet as any, ledger as any);
  });

  describe('getMyEffectiveSubscription', () => {
    it('возвращает STARTER, если активной подписки нет вообще', async () => {
      prisma.subscription.findUnique.mockResolvedValue(null);
      prisma.subscriptionTier.findUniqueOrThrow.mockResolvedValue({ name: 'STARTER' });

      const result = await service.getMyEffectiveSubscription('user-1');
      expect(result.tier.name).toBe('STARTER');
    });

    it('возвращает STARTER, если подписка есть, но истекла', async () => {
      prisma.subscription.findUnique.mockResolvedValue({
        status: 'ACTIVE',
        expiresAt: new Date(Date.now() - 1000),
        tier: { name: 'PRO' },
      });
      prisma.subscriptionTier.findUniqueOrThrow.mockResolvedValue({ name: 'STARTER' });

      const result = await service.getMyEffectiveSubscription('user-1');
      expect(result.tier.name).toBe('STARTER');
    });

    it('возвращает реальный тир, если подписка активна и не истекла', async () => {
      const active = { status: 'ACTIVE', expiresAt: new Date(Date.now() + 100000), tier: { name: 'PREMIUM' } };
      prisma.subscription.findUnique.mockResolvedValue(active);

      const result = await service.getMyEffectiveSubscription('user-1');
      expect(result).toBe(active);
    });
  });

  describe('checkout', () => {
    it('бросает NotFoundException для несуществующего тира', async () => {
      prisma.subscriptionTier.findUnique.mockResolvedValue(null);
      await expect(service.checkout('user-1', 'PRO')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('кодирует userId и tierName в order_id платежа', async () => {
      prisma.subscriptionTier.findUnique.mockResolvedValue({ name: 'PRO', priceUsd: 9.99 });

      await service.checkout('user-1', 'PRO');

      expect(nowPayments.createPayment).toHaveBeenCalledWith(
        expect.objectContaining({ orderId: 'subscription:user-1:PRO', priceAmount: 9.99 }),
      );
    });
  });

  describe('confirmFromIpn', () => {
    it('отклоняет нераспознаваемый order_id', async () => {
      await expect(service.confirmFromIpn('garbage')).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.subscription.upsert).not.toHaveBeenCalled();
    });

    it('активирует подписку на 30 дней от текущего момента по валидному order_id', async () => {
      prisma.subscriptionTier.findUniqueOrThrow.mockResolvedValue({ id: 'tier-pro', name: 'PRO' });

      await service.confirmFromIpn('subscription:user-1:PREMIUM');

      const call = prisma.subscription.upsert.mock.calls[0][0];
      expect(call.where).toEqual({ userId: 'user-1' });
      expect(call.create.tierId).toBe('tier-pro');
      expect(call.update.status).toBe('ACTIVE');

      const daysUntilExpiry = (call.create.expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
      expect(daysUntilExpiry).toBeCloseTo(30, 0);
    });
  });
});
