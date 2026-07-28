import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PromotedEntityType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NowPaymentsService } from '../wallet/nowpayments.service';

const PROMOTION_RULES: Record<PromotedEntityType, { days: number; priceUsd: number }> = {
  ORDER: { days: 7, priceUsd: 5 },
  PROFILE: { days: 30, priceUsd: 10 },
};

@Injectable()
export class PromotionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly nowPayments: NowPaymentsService,
  ) {}

  listActive(entityType: PromotedEntityType, entityId: string) {
    return this.prisma.promotion.findMany({
      where: { entityType, entityId, expiresAt: { gt: new Date() } },
      orderBy: { expiresAt: 'desc' },
    });
  }

  private async assertOwnership(userId: string, entityType: PromotedEntityType, entityId: string) {
    if (entityType === 'PROFILE') {
      if (entityId !== userId) throw new ForbiddenException('Can only promote your own profile');
      return;
    }
    const order = await this.prisma.order.findUnique({ where: { id: entityId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.clientId !== userId) throw new ForbiddenException('Can only promote your own order');
  }

  private async getFreeBoostsRemaining(userId: string): Promise<number> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
      include: { tier: true },
    });
    if (!subscription || subscription.status !== 'ACTIVE' || subscription.expiresAt < new Date()) {
      return 0; // эффективный STARTER — бесплатных бустов нет
    }

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const usedThisMonth = await this.prisma.promotion.count({
      where: { purchasedById: userId, amountUsd: null, startedAt: { gte: startOfMonth } },
    });

    return Math.max(0, subscription.tier.freeBoostsPerMonth - usedThisMonth);
  }

  /**
   * Если у пользователя есть бесплатный буст в квоте тарифа — списывает его
   * сразу без похода в NOWPayments. Иначе — создаёт платёж, сама
   * Promotion появляется только после подтверждения оплаты (см. confirmFromIpn).
   */
  async checkout(userId: string, entityType: PromotedEntityType, entityId: string) {
    await this.assertOwnership(userId, entityType, entityId);

    const rule = PROMOTION_RULES[entityType];
    const freeBoostsRemaining = await this.getFreeBoostsRemaining(userId);

    if (freeBoostsRemaining > 0) {
      const promotion = await this.prisma.promotion.create({
        data: {
          entityType,
          entityId,
          purchasedById: userId,
          expiresAt: new Date(Date.now() + rule.days * 24 * 60 * 60 * 1000),
          amountUsd: null,
        },
      });
      return { promotion, paidFromQuota: true };
    }

    const syntheticOrderId = `promotion:${entityType}:${entityId}:${userId}`;
    const payment = await this.nowPayments.createPayment({
      priceAmount: rule.priceUsd,
      priceCurrency: 'usd',
      payCurrency: 'usdttrc20',
      orderId: syntheticOrderId,
      ipnCallbackUrl: `${process.env.API_PUBLIC_URL}/promotions/nowpayments/ipn`,
    });

    return { payment, paidFromQuota: false };
  }

  async confirmFromIpn(syntheticOrderId: string) {
    const parsed = /^promotion:(ORDER|PROFILE):([^:]+):([^:]+)$/.exec(syntheticOrderId);
    if (!parsed) {
      throw new BadRequestException(`Unrecognized promotion order_id: ${syntheticOrderId}`);
    }
    const [, entityType, entityId, userId] = parsed;
    const rule = PROMOTION_RULES[entityType as PromotedEntityType];

    return this.prisma.promotion.create({
      data: {
        entityType: entityType as PromotedEntityType,
        entityId,
        purchasedById: userId,
        expiresAt: new Date(Date.now() + rule.days * 24 * 60 * 60 * 1000),
        amountUsd: rule.priceUsd,
      },
    });
  }
}
