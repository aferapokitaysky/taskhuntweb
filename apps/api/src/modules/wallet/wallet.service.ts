import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LedgerService } from './ledger.service';
import { EventBusService } from '../../common/events/event-bus.service';
import { DomainEventName } from '@taskhunt/shared-types';
import { SYSTEM_ACCOUNT_EMAIL, DEFAULT_MARKETPLACE_FEE_PERCENT } from './constants';

@Injectable()
export class WalletService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly eventBus: EventBusService,
  ) {}

  async getBalances(userId: string) {
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) throw new NotFoundException('Wallet not found');
    return wallet;
  }

  async getSystemWalletId(): Promise<string> {
    const wallet = await this.getSystemWallet();
    return wallet.id;
  }

  private async getSystemWallet() {
    const systemUser = await this.prisma.user.findUniqueOrThrow({
      where: { email: SYSTEM_ACCOUNT_EMAIL },
      include: { wallet: true },
    });
    if (!systemUser.wallet) throw new NotFoundException('System wallet not seeded — run prisma:seed');
    return systemUser.wallet;
  }

  private async getMarketplaceFeePercent(freelancerId?: string): Promise<number> {
    if (freelancerId) {
      const activeSub = await this.prisma.subscription.findFirst({
        where: {
          userId: freelancerId,
          status: 'ACTIVE',
          expiresAt: { gt: new Date() },
        },
        include: { tier: true },
      });
      if (activeSub?.tier?.commissionPercent != null) {
        return Number(activeSub.tier.commissionPercent);
      }
    }

    const rule = await this.prisma.commissionRule.findUnique({ where: { type: 'MARKETPLACE_FEE' } });
    if (!rule || !rule.active || rule.percentage == null) return DEFAULT_MARKETPLACE_FEE_PERCENT;
    return Number(rule.percentage);
  }

  /**
   * Вызывается после подтверждения оплаты инвойса через NOWPayments IPN.
   * Деньги "заходят" в систему (от внешнего мира) и сразу оседают в ESCROW
   * заказчика, привязанные к конкретному инвойсу/заказу.
   */
  async lockEscrowForInvoice(params: {
    clientWalletId: string;
    clientId: string;
    amount: number;
    invoiceId: string;
    orderId: string;
  }) {
    const system = await this.getSystemWallet();

    await this.ledger.applyTransaction({
      type: 'ESCROW_LOCK',
      referenceType: 'INVOICE',
      referenceId: params.invoiceId,
      description: `Escrow lock for invoice ${params.invoiceId}`,
      entries: [
        { walletId: system.id, balanceType: 'MAIN', direction: 'DEBIT', amount: params.amount },
        { walletId: params.clientWalletId, balanceType: 'ESCROW', direction: 'CREDIT', amount: params.amount },
      ],
    });

    await this.eventBus.publish(DomainEventName.EscrowLocked, {
      orderId: params.orderId,
      walletId: params.clientWalletId,
      clientId: params.clientId,
      amount: params.amount,
    });
  }

  /**
   * Релиз эскроу фрилансеру при принятии сдачи работы. Комиссия платформы
   * удерживается тут же, одной сбалансированной транзакцией:
   *   DEBIT client.ESCROW (amount)
   *   CREDIT freelancer.WITHDRAWABLE (amount - commission)
   *   CREDIT platform.MAIN (commission)
   */
  async releaseEscrow(params: {
    clientWalletId: string;
    freelancerWalletId: string;
    amount: number;
    invoiceId: string;
    orderId: string;
    freelancerId: string;
  }) {
    const system = await this.getSystemWallet();
    const feePercent = await this.getMarketplaceFeePercent(params.freelancerId);
    const commission = round2(params.amount * (feePercent / 100));
    const payout = round2(params.amount - commission);

    await this.ledger.applyTransaction({
      type: 'ESCROW_RELEASE',
      referenceType: 'INVOICE',
      referenceId: params.invoiceId,
      description: `Escrow release for invoice ${params.invoiceId} (fee ${feePercent}%)`,
      entries: [
        { walletId: params.clientWalletId, balanceType: 'ESCROW', direction: 'DEBIT', amount: params.amount },
        { walletId: params.freelancerWalletId, balanceType: 'WITHDRAWABLE', direction: 'CREDIT', amount: payout },
        { walletId: system.id, balanceType: 'MAIN', direction: 'CREDIT', amount: commission },
      ],
    });

    await this.eventBus.publish(DomainEventName.EscrowReleased, {
      orderId: params.orderId,
      walletId: params.freelancerWalletId,
      amount: payout,
      toFreelancerId: params.freelancerId,
    });
  }

  /** Возврат эскроу заказчику целиком — при отмене заказа или решении спора в его пользу. */
  async refundEscrow(params: { clientWalletId: string; amount: number; invoiceId: string }) {
    const system = await this.getSystemWallet();

    await this.ledger.applyTransaction({
      type: 'REFUND',
      referenceType: 'INVOICE',
      referenceId: params.invoiceId,
      description: `Escrow refund for invoice ${params.invoiceId}`,
      entries: [
        { walletId: params.clientWalletId, balanceType: 'ESCROW', direction: 'DEBIT', amount: params.amount },
        { walletId: system.id, balanceType: 'MAIN', direction: 'CREDIT', amount: params.amount },
      ],
    });
  }

  // Держим в синхроне с getWithdrawalFeePercent() ниже (та же проверка rule.active) —
  // иначе калькулятор на фронте покажет процент, который по факту не спишется
  // (или наоборот), если staff выключил правило через admin.
  async getWithdrawalFeeInfo() {
    const rule = await this.prisma.commissionRule.findUnique({ where: { type: 'WITHDRAWAL_FEE' } });
    if (!rule || !rule.active) {
      return { percentage: 1, fixedAmount: 0 };
    }
    return {
      percentage: rule.percentage != null ? Number(rule.percentage) : 1,
      fixedAmount: rule.fixedAmount != null ? Number(rule.fixedAmount) : 0,
    };
  }

  private async getWithdrawalFeePercent(): Promise<number> {
    const rule = await this.prisma.commissionRule.findUnique({ where: { type: 'WITHDRAWAL_FEE' } });
    if (!rule || !rule.active || rule.percentage == null) return 1;
    return Number(rule.percentage);
  }

  /**
   * Запрос на вывод средств. Списывает WITHDRAWABLE сразу (пессимистично)
   * с удержанием комиссии за вывод (WITHDRAWAL_FEE, дефолт 1%),
   * фактическая крипто-выплата — асинхронный процесс вне ledger (воркер,
   * который дёргает NOWPayments payout API на сумму netAmount); если выплата не пройдёт,
   * полная сумма возвращается отдельной REFUND-транзакцией.
   */
  async requestWithdrawal(userId: string, amount: number) {
    const wallet = await this.getBalances(userId);
    if (Number(wallet.withdrawableBalance) < amount) {
      throw new NotFoundException('Insufficient withdrawable balance');
    }
    const system = await this.getSystemWallet();
    const feePercent = await this.getWithdrawalFeePercent();
    const fee = round2(amount * (feePercent / 100));
    const netAmount = round2(amount - fee);

    const transaction = await this.ledger.applyTransaction({
      type: 'WITHDRAWAL',
      referenceType: 'WALLET',
      referenceId: wallet.id,
      createdById: userId,
      description: `Withdrawal request of $${amount} (fee ${feePercent}% = $${fee}, net payout = $${netAmount})`,
      entries: [
        { walletId: wallet.id, balanceType: 'WITHDRAWABLE', direction: 'DEBIT', amount },
        { walletId: system.id, balanceType: 'MAIN', direction: 'CREDIT', amount: netAmount },
        { walletId: system.id, balanceType: 'MAIN', direction: 'CREDIT', amount: fee },
      ],
    });

    return { transaction, amount, fee, netAmount };
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
