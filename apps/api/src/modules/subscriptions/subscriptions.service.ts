import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { SubscriptionTierName } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NowPaymentsService } from '../wallet/nowpayments.service';
import { WalletService } from '../wallet/wallet.service';
import { LedgerService } from '../wallet/ledger.service';

const SUBSCRIPTION_PERIOD_DAYS = 30;

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly nowPayments: NowPaymentsService,
    private readonly wallet: WalletService,
    private readonly ledger: LedgerService,
  ) {}

  listTiers() {
    return this.prisma.subscriptionTier.findMany({ orderBy: { priceUsd: 'asc' } });
  }

  /** Активная подписка пользователя, либо эффективный STARTER, если её нет/истекла. */
  async getMyEffectiveSubscription(userId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
      include: { tier: true },
    });

    if (subscription && subscription.status === 'ACTIVE' && subscription.expiresAt > new Date()) {
      return subscription;
    }

    const starter = await this.prisma.subscriptionTier.findUniqueOrThrow({ where: { name: 'STARTER' } });
    return { tier: starter, status: 'ACTIVE' as const, expiresAt: null, startedAt: null, userId };
  }

  /**
   * Создаёт платёж на апгрейд тира. Подписка НЕ создаётся здесь — только
   * после подтверждения оплаты через IPN (см. confirmFromIpn), чтобы не
   * плодить "подвисшие" записи на неоплаченные попытки.
   *
   * userId и tierName кодируются прямо в order_id, который NOWPayments
   * обязан вернуть в IPN-колбэке нетронутым — так не нужна отдельная
   * "pending"-таблица для сопоставления платежа с тем, что активировать.
   */
  async checkout(userId: string, tierName: 'PRO' | 'PREMIUM') {
    const tier = await this.prisma.subscriptionTier.findUnique({ where: { name: tierName } });
    if (!tier) throw new NotFoundException('Subscription tier not found');

    const syntheticOrderId = `subscription:${userId}:${tierName}`;
    const payment = await this.nowPayments.createPayment({
      priceAmount: Number(tier.priceUsd),
      priceCurrency: 'usd',
      payCurrency: 'usdttrc20',
      orderId: syntheticOrderId,
      ipnCallbackUrl: `${process.env.API_PUBLIC_URL}/subscriptions/nowpayments/ipn`,
    });

    return { tier, payment };
  }

  /**
   * Покупка/продление подписки с основного баланса кошелька — без нового
   * крипто-платежа. Деньги реально уходят с платформы пользователю в
   * систему (это заработок площадки, не эскроу), поэтому в отличие от
   * lockEscrowFromMainBalance здесь MAIN клиента дебетуется, а MAIN
   * системного счёта кредитуется — сумма покидает пользовательский контур
   * насовсем, как и при обычной крипто-оплате через NOWPayments.
   */
  async checkoutFromBalance(userId: string, tierName: 'PRO' | 'PREMIUM') {
    const tier = await this.prisma.subscriptionTier.findUnique({ where: { name: tierName } });
    if (!tier) throw new NotFoundException('Subscription tier not found');

    const userWallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!userWallet) throw new NotFoundException('Wallet not found');

    const price = Number(tier.priceUsd);
    if (Number(userWallet.mainBalance) < price) {
      throw new ForbiddenException('Недостаточно средств на основном балансе для покупки подписки');
    }

    const systemWalletId = await this.wallet.getSystemWalletId();
    await this.ledger.applyTransaction({
      type: 'PROMO',
      referenceType: 'SUBSCRIPTION',
      referenceId: tier.id,
      description: `Оплата подписки ${tierName} с основного баланса`,
      entries: [
        { walletId: userWallet.id, balanceType: 'MAIN', direction: 'DEBIT', amount: price },
        { walletId: systemWalletId, balanceType: 'MAIN', direction: 'CREDIT', amount: price },
      ],
    });

    return this.activateSubscription(userId, tierName);
  }

  /** Вызывается из SubscriptionsController после проверки подписи IPN. */
  async confirmFromIpn(syntheticOrderId: string) {
    const parsed = /^subscription:([^:]+):(PRO|PREMIUM)$/.exec(syntheticOrderId);
    if (!parsed) {
      throw new BadRequestException(`Unrecognized subscription order_id: ${syntheticOrderId}`);
    }
    const [, userId, tierName] = parsed;
    return this.activateSubscription(userId, tierName as 'PRO' | 'PREMIUM');
  }

  private async activateSubscription(userId: string, tierName: 'PRO' | 'PREMIUM') {
    const tier = await this.prisma.subscriptionTier.findUniqueOrThrow({
      where: { name: tierName as SubscriptionTierName },
    });

    const expiresAt = new Date(Date.now() + SUBSCRIPTION_PERIOD_DAYS * 24 * 60 * 60 * 1000);

    return this.prisma.subscription.upsert({
      where: { userId },
      create: { userId, tierId: tier.id, status: 'ACTIVE', expiresAt },
      // Продление — не складываем даты, а сдвигаем от "сейчас": повторная
      // оплата во время ещё активной подписки просто продлевает на новый
      // period от текущего момента (проще для пользователя, чем копить остаток).
      update: { tierId: tier.id, status: 'ACTIVE', startedAt: new Date(), expiresAt },
    });
  }
}
