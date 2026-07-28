import { NotFoundException } from '@nestjs/common';
import { WalletService } from '../wallet.service';
import { DEFAULT_MARKETPLACE_FEE_PERCENT, SYSTEM_ACCOUNT_EMAIL } from '../constants';

describe('WalletService', () => {
  const systemWallet = { id: 'system-wallet-id' };
  let prisma: any;
  let ledger: { applyTransaction: jest.Mock };
  let eventBus: { publish: jest.Mock };
  let service: WalletService;

  beforeEach(() => {
    prisma = {
      user: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({ wallet: systemWallet }),
      },
      wallet: {
        findUnique: jest.fn(),
      },
      commissionRule: {
        findUnique: jest.fn().mockResolvedValue(null), // по умолчанию — нет правила в БД, берём дефолт
      },
    };
    ledger = { applyTransaction: jest.fn().mockResolvedValue({ id: 'tx-1' }) };
    eventBus = { publish: jest.fn().mockResolvedValue(undefined) };

    service = new WalletService(prisma, ledger as any, eventBus as any);
  });

  describe('lockEscrowForInvoice', () => {
    it('ищет системный кошелёк по SYSTEM_ACCOUNT_EMAIL и создаёт сбалансированную проводку ESCROW_LOCK', async () => {
      await service.lockEscrowForInvoice({
        clientWalletId: 'client-wallet',
        clientId: 'client-1',
        amount: 150,
        invoiceId: 'inv-1',
        orderId: 'order-1',
      });

      expect(prisma.user.findUniqueOrThrow).toHaveBeenCalledWith(
        expect.objectContaining({ where: { email: SYSTEM_ACCOUNT_EMAIL } }),
      );

      expect(ledger.applyTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'ESCROW_LOCK',
          referenceType: 'INVOICE',
          referenceId: 'inv-1',
          entries: [
            { walletId: systemWallet.id, balanceType: 'MAIN', direction: 'DEBIT', amount: 150 },
            { walletId: 'client-wallet', balanceType: 'ESCROW', direction: 'CREDIT', amount: 150 },
          ],
        }),
      );

      expect(eventBus.publish).toHaveBeenCalledWith(
        'EscrowLocked',
        expect.objectContaining({ orderId: 'order-1', clientId: 'client-1', amount: 150 }),
      );
    });
  });

  describe('releaseEscrow', () => {
    it('использует дефолтный % комиссии, если CommissionRule не настроен в БД', async () => {
      await service.releaseEscrow({
        clientWalletId: 'client-wallet',
        freelancerWalletId: 'freelancer-wallet',
        amount: 100,
        invoiceId: 'inv-1',
        orderId: 'order-1',
        freelancerId: 'freelancer-1',
      });

      const call = ledger.applyTransaction.mock.calls[0][0];
      const commission = (100 * DEFAULT_MARKETPLACE_FEE_PERCENT) / 100;
      const payout = 100 - commission;

      expect(call.entries).toEqual([
        { walletId: 'client-wallet', balanceType: 'ESCROW', direction: 'DEBIT', amount: 100 },
        { walletId: 'freelancer-wallet', balanceType: 'WITHDRAWABLE', direction: 'CREDIT', amount: payout },
        { walletId: systemWallet.id, balanceType: 'MAIN', direction: 'CREDIT', amount: commission },
      ]);
    });

    it('использует % из CommissionRule, если он активен в БД', async () => {
      prisma.commissionRule.findUnique.mockResolvedValue({ active: true, percentage: 20 });

      await service.releaseEscrow({
        clientWalletId: 'client-wallet',
        freelancerWalletId: 'freelancer-wallet',
        amount: 100,
        invoiceId: 'inv-1',
        orderId: 'order-1',
        freelancerId: 'freelancer-1',
      });

      const call = ledger.applyTransaction.mock.calls[0][0];
      expect(call.entries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ walletId: systemWallet.id, amount: 20 }),
          expect.objectContaining({ walletId: 'freelancer-wallet', amount: 80 }),
        ]),
      );
    });

    it('сумма выплаты фрилансеру + комиссия всегда равна полной сумме эскроу (баланс не теряется и не создаётся из воздуха)', async () => {
      await service.releaseEscrow({
        clientWalletId: 'client-wallet',
        freelancerWalletId: 'freelancer-wallet',
        amount: 33.33,
        invoiceId: 'inv-1',
        orderId: 'order-1',
        freelancerId: 'freelancer-1',
      });

      const [, payoutEntry, commissionEntry] = ledger.applyTransaction.mock.calls[0][0].entries;
      expect(payoutEntry.amount + commissionEntry.amount).toBeCloseTo(33.33, 2);
    });
  });

  describe('requestWithdrawal', () => {
    it('бросает ошибку, если WITHDRAWABLE баланса не хватает', async () => {
      prisma.wallet.findUnique.mockResolvedValue({ id: 'w1', withdrawableBalance: '10.00' });

      await expect(service.requestWithdrawal('user-1', 50)).rejects.toBeInstanceOf(NotFoundException);
      expect(ledger.applyTransaction).not.toHaveBeenCalled();
    });

    it('проводит вывод средств, если баланса достаточно', async () => {
      prisma.wallet.findUnique.mockResolvedValue({ id: 'w1', withdrawableBalance: '100.00' });

      await service.requestWithdrawal('user-1', 50);

      expect(ledger.applyTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'WITHDRAWAL',
          entries: [
            { walletId: 'w1', balanceType: 'WITHDRAWABLE', direction: 'DEBIT', amount: 50 },
            { walletId: systemWallet.id, balanceType: 'MAIN', direction: 'CREDIT', amount: 50 },
          ],
        }),
      );
    });
  });

  describe('refundEscrow', () => {
    it('возвращает полную сумму эскроу клиенту одной сбалансированной проводкой', async () => {
      await service.refundEscrow({ clientWalletId: 'client-wallet', amount: 42, invoiceId: 'inv-1' });

      expect(ledger.applyTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'REFUND',
          entries: [
            { walletId: 'client-wallet', balanceType: 'ESCROW', direction: 'DEBIT', amount: 42 },
            { walletId: systemWallet.id, balanceType: 'MAIN', direction: 'CREDIT', amount: 42 },
          ],
        }),
      );
    });
  });
});
