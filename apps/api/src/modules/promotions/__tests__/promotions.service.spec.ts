import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PromotionsService } from '../promotions.service';

describe('PromotionsService', () => {
  let prisma: any;
  let nowPayments: { createPayment: jest.Mock };
  let service: PromotionsService;

  beforeEach(() => {
    prisma = {
      order: { findUnique: jest.fn() },
      subscription: { findUnique: jest.fn().mockResolvedValue(null) },
      promotion: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({ id: 'promo-1' }),
        findMany: jest.fn(),
      },
    };
    nowPayments = { createPayment: jest.fn().mockResolvedValue({ paymentId: 'pay-1', payAddress: '0xabc' }) };
    service = new PromotionsService(prisma, nowPayments as any);
  });

  describe('checkout — владение', () => {
    it('запрещает продвигать чужой заказ', async () => {
      prisma.order.findUnique.mockResolvedValue({ id: 'order-1', clientId: 'other-user' });
      await expect(service.checkout('user-1', 'ORDER', 'order-1')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('404 на несуществующий заказ', async () => {
      prisma.order.findUnique.mockResolvedValue(null);
      await expect(service.checkout('user-1', 'ORDER', 'order-1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('запрещает продвигать чужой профиль (entityId != userId)', async () => {
      await expect(service.checkout('user-1', 'PROFILE', 'someone-else')).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('checkout — квота и оплата', () => {
    it('без активной подписки идёт сразу на оплату (0 бесплатных бустов)', async () => {
      prisma.order.findUnique.mockResolvedValue({ id: 'order-1', clientId: 'user-1' });

      const result = await service.checkout('user-1', 'ORDER', 'order-1');

      expect(result.paidFromQuota).toBe(false);
      expect(nowPayments.createPayment).toHaveBeenCalledWith(
        expect.objectContaining({ orderId: 'promotion:ORDER:order-1:user-1', priceAmount: 5 }),
      );
      expect(prisma.promotion.create).not.toHaveBeenCalled();
    });

    it('списывает бесплатный буст из квоты тарифа вместо оплаты, если есть остаток', async () => {
      prisma.order.findUnique.mockResolvedValue({ id: 'order-1', clientId: 'user-1' });
      prisma.subscription.findUnique.mockResolvedValue({
        status: 'ACTIVE',
        expiresAt: new Date(Date.now() + 100000),
        tier: { freeBoostsPerMonth: 5 },
      });
      prisma.promotion.count.mockResolvedValue(2); // 2 из 5 уже использовано в этом месяце

      const result = await service.checkout('user-1', 'ORDER', 'order-1');

      expect(result.paidFromQuota).toBe(true);
      expect(nowPayments.createPayment).not.toHaveBeenCalled();
      expect(prisma.promotion.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ amountUsd: null }) }),
      );
    });

    it('уходит на оплату, если квота бустов исчерпана полностью', async () => {
      prisma.order.findUnique.mockResolvedValue({ id: 'order-1', clientId: 'user-1' });
      prisma.subscription.findUnique.mockResolvedValue({
        status: 'ACTIVE',
        expiresAt: new Date(Date.now() + 100000),
        tier: { freeBoostsPerMonth: 1 },
      });
      prisma.promotion.count.mockResolvedValue(1); // квота уже вся использована

      const result = await service.checkout('user-1', 'ORDER', 'order-1');
      expect(result.paidFromQuota).toBe(false);
    });
  });

  describe('confirmFromIpn', () => {
    it('отклоняет нераспознаваемый order_id', async () => {
      await expect(service.confirmFromIpn('garbage')).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.promotion.create).not.toHaveBeenCalled();
    });

    it('создаёт Promotion с правильным сроком и суммой по валидному order_id', async () => {
      await service.confirmFromIpn('promotion:PROFILE:user-2:user-2');

      const call = prisma.promotion.create.mock.calls[0][0];
      expect(call.data.entityType).toBe('PROFILE');
      expect(call.data.entityId).toBe('user-2');
      expect(call.data.purchasedById).toBe('user-2');
      expect(call.data.amountUsd).toBe(10); // профиль — $10/30 дней

      const daysUntilExpiry = (call.data.expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
      expect(daysUntilExpiry).toBeCloseTo(30, 0);
    });
  });
});
