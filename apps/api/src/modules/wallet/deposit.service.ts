import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { NowPaymentsService } from './nowpayments.service';
import { WalletService } from './wallet.service';
import { LedgerService } from './ledger.service';
import { EventBusService } from '../../common/events/event-bus.service';
import { DomainEventName } from '@taskhunt/shared-types';

const MIN_DEPOSIT_USD = 5;
const MAX_DEPOSIT_USD = 50000;

@Injectable()
export class DepositService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly nowPayments: NowPaymentsService,
    private readonly wallet: WalletService,
    private readonly ledger: LedgerService,
    private readonly eventBus: EventBusService,
  ) {}

  /** Пользователь пополняет свой кошелёк через NOWPayments — не привязано к заказу. */
  async createDeposit(userId: string, amount: number) {
    if (amount < MIN_DEPOSIT_USD || amount > MAX_DEPOSIT_USD) {
      throw new BadRequestException(`Сумма пополнения должна быть от ${MIN_DEPOSIT_USD} до ${MAX_DEPOSIT_USD} USD`);
    }

    // Провайдер дёргается первым — тот же паттерн, что и в InvoiceService.issueInvoice,
    // чтобы при сбое NOWPayments в базе не оставалось "битой" записи без реквизитов.
    const depositId = randomUUID();
    const payment = await this.nowPayments.createPayment({
      priceAmount: amount,
      priceCurrency: 'USD',
      payCurrency: 'usdttrc20',
      orderId: depositId,
      ipnCallbackUrl: `${process.env.API_PUBLIC_URL}/wallet/nowpayments/ipn`,
    });

    const deposit = await this.prisma.walletDeposit.create({
      data: {
        id: depositId,
        userId,
        amount,
        currency: 'USD',
        status: 'PENDING',
        nowPaymentsPaymentId: payment.paymentId,
        payAddress: payment.payAddress,
        payAmount: payment.payAmount,
        payCurrency: payment.payCurrency,
      },
    });

    return deposit;
  }

  async getPaymentDetails(userId: string, depositId: string) {
    const deposit = await this.prisma.walletDeposit.findUnique({ where: { id: depositId } });
    if (!deposit) throw new NotFoundException('Deposit not found');
    if (deposit.userId !== userId) throw new ForbiddenException('Not your deposit');

    return {
      depositId: deposit.id,
      amount: deposit.amount,
      currency: deposit.currency,
      status: deposit.status,
      payAddress: deposit.payAddress,
      payAmount: deposit.payAmount,
      payCurrency: deposit.payCurrency,
      paymentNetwork: deposit.payCurrency,
    };
  }

  /** Вызывается из NowPaymentsController после проверки подписи IPN. */
  async markPaid(nowPaymentsPaymentId: string) {
    const deposit = await this.prisma.walletDeposit.findUnique({ where: { nowPaymentsPaymentId } });
    if (!deposit) return null; // возможно, это платёж по Invoice — обработает InvoiceService
    if (deposit.status === 'PAID') return deposit; // идемпотентность на случай повторного IPN

    const systemWalletId = await this.wallet.getSystemWalletId();
    const userWallet = await this.prisma.wallet.findUnique({ where: { userId: deposit.userId } });
    if (!userWallet) throw new BadRequestException('Wallet not found for deposit user');

    const paid = await this.prisma.walletDeposit.update({
      where: { id: deposit.id },
      data: { status: 'PAID', paidAt: new Date() },
    });

    await this.ledger.applyTransaction({
      type: 'DEPOSIT',
      referenceType: 'WALLET_DEPOSIT',
      referenceId: deposit.id,
      description: `Пополнение кошелька через NOWPayments`,
      entries: [
        { walletId: systemWalletId, balanceType: 'MAIN', direction: 'DEBIT', amount: deposit.amount.toString() },
        { walletId: userWallet.id, balanceType: 'MAIN', direction: 'CREDIT', amount: deposit.amount.toString() },
      ],
    });

    await this.eventBus.publish(DomainEventName.WalletDepositPaid, {
      depositId: deposit.id,
      userId: deposit.userId,
      amount: Number(deposit.amount),
      currency: deposit.currency,
    });

    return paid;
  }
}
