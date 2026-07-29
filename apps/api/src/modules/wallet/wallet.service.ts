import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as PDFDocument from 'pdfkit';
import { PrismaService } from '../../prisma/prisma.service';
import { LedgerService } from './ledger.service';
import { EventBusService } from '../../common/events/event-bus.service';
import { DomainEventName } from '@taskhunt/shared-types';
import { SYSTEM_ACCOUNT_EMAIL, DEFAULT_MARKETPLACE_FEE_PERCENT } from './constants';

// PDFKit-овские встроенные Standard-14 шрифты (Helvetica и т.п.) не
// поддерживают кириллицу — без встраивания отдельного TTF-шрифта русский
// текст рендерится битой кашей (проверено вживую). Библиотеку шрифтов
// ради одного PDF-чека тащить не стали — чек на английском, это обычная
// практика для авто-генерируемых финансовых документов.
const TRANSACTION_TYPE_LABELS_EN: Record<string, string> = {
  DEPOSIT: 'Deposit',
  WITHDRAWAL: 'Withdrawal',
  ESCROW_LOCK: 'Escrow lock',
  ESCROW_RELEASE: 'Escrow release',
  REFUND: 'Refund',
  COMMISSION: 'Commission',
  BONUS: 'Bonus',
  REFERRAL: 'Referral reward',
  PROMO: 'Promotion',
  CHARGEBACK: 'Chargeback',
};

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

  /** Курсорная пагинация — таблица только растёт, offset на больших объёмах деградирует. */
  async getTransactionHistory(userId: string, cursor?: string, limit = 20) {
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) throw new NotFoundException('Wallet not found');

    const entries = await this.prisma.ledgerEntry.findMany({
      where: { walletId: wallet.id },
      include: { transaction: true },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    });

    const nextCursor = entries.length > limit ? entries.pop()!.id : null;

    return {
      items: entries.map((entry) => ({
        id: entry.id,
        type: entry.transaction.type,
        direction: entry.direction,
        balanceType: entry.balanceType,
        amount: entry.amount,
        currency: entry.currency,
        description: entry.transaction.description,
        referenceType: entry.transaction.referenceType,
        createdAt: entry.createdAt,
      })),
      nextCursor,
    };
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

  async setAutoWithdraw(userId: string, threshold: number | null | undefined, savedAddressId?: string) {
    return this.prisma.wallet.update({
      where: { userId },
      data: {
        autoWithdrawThreshold: threshold !== undefined && threshold !== null ? threshold : null,
        autoWithdrawAddressId: savedAddressId ?? null,
      },
    });
  }

  async exportTransactionHistoryCsv(userId: string): Promise<string> {
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) return 'Date,Type,Amount,Currency,Description\n';

    const entries = await this.prisma.ledgerEntry.findMany({
      where: { walletId: wallet.id },
      include: { transaction: true },
      orderBy: { createdAt: 'desc' },
    });

    const escapeCsv = (str: string) => {
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const header = 'Date,Type,Amount,Currency,Description\n';
    const rows = entries.map((e) => {
      const date = e.createdAt.toISOString();
      const type = e.transaction.type;
      const amount = e.amount.toString();
      const currency = wallet.currency;
      const desc = escapeCsv(e.transaction.description ?? '');
      return `${date},${type},${amount},${currency},${desc}`;
    });

    return header + rows.join('\n');
  }

  async generateReceiptPdf(userId: string, entryId: string): Promise<Buffer> {
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) throw new NotFoundException('Wallet not found');

    const entry = await this.prisma.ledgerEntry.findUnique({
      where: { id: entryId },
      include: { transaction: true },
    });
    if (!entry || entry.walletId !== wallet.id) {
      throw new ForbiddenException('This transaction does not belong to your wallet');
    }

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    const done = new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });

    doc.fontSize(20).text('TaskHunt', { continued: false });
    doc.fontSize(10).fillColor('#888').text('Wallet transaction receipt').moveDown(1.5);

    doc.fillColor('#000').fontSize(12);
    doc.text(`Type: ${TRANSACTION_TYPE_LABELS_EN[entry.transaction.type] ?? entry.transaction.type}`);
    doc.text(`Amount: ${entry.direction === 'CREDIT' ? '+' : '-'}${entry.amount.toString()} ${entry.currency}`);
    doc.text(`Date: ${entry.createdAt.toISOString()}`);
    // description может быть на русском — встроенный шрифт pdfkit его не
    // отрендерит (см. комментарий у TRANSACTION_TYPE_LABELS_EN), поэтому
    // сюда идут только ASCII-описания, остальные молча пропускаются, а не
    // показываются битой кашей.
    if (entry.transaction.description && /^[\x20-\x7E]*$/.test(entry.transaction.description)) {
      doc.text(`Description: ${entry.transaction.description}`);
    }
    doc.text(`Transaction ID: ${entry.id}`);

    doc.moveDown(2).fontSize(8).fillColor('#888').text('This is not a tax document.');

    doc.end();
    return done;
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
