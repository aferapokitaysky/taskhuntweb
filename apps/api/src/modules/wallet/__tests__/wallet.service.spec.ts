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
        findUnique: jest.fn().mockResolvedValue(null),
      },
      subscription: {
        findFirst: jest.fn().mockResolvedValue(null),
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
        invoiceId: 'inv-123',
        orderId: 'ord-123',
      });

      expect(prisma.user.findUniqueOrThrow).toHaveBeenCalledWith({
        where: { email: SYSTEM_ACCOUNT_EMAIL },
        include: { wallet: true },
      });
      expect(ledger.applyTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'ESCROW_LOCK',
          referenceType: 'INVOICE',
          referenceId: 'inv-123',
          description: 'Escrow lock for invoice inv-123',
          entries: [
            { walletId: systemWallet.id, balanceType: 'MAIN', direction: 'DEBIT', amount: 150 },
            { walletId: 'client-wallet', balanceType: 'ESCROW', direction: 'CREDIT', amount: 150 },
          ],
        }),
      );
    });
  });

  describe('releaseEscrow', () => {
    it('рассчитывает дефолтную комиссию 10%, удерживает её в системный кошелёк и отправляет остаток фрилансеру', async () => {
      await service.releaseEscrow({
        clientWalletId: 'client-wallet',
        freelancerWalletId: 'freelancer-wallet',
        amount: 100,
        invoiceId: 'inv-1',
        orderId: 'ord-1',
        freelancerId: 'freelancer-1',
      });

      expect(ledger.applyTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'ESCROW_RELEASE',
          entries: [
            { walletId: 'client-wallet', balanceType: 'ESCROW', direction: 'DEBIT', amount: 100 },
            { walletId: 'freelancer-wallet', balanceType: 'WITHDRAWABLE', direction: 'CREDIT', amount: 90 },
            { walletId: systemWallet.id, balanceType: 'MAIN', direction: 'CREDIT', amount: 10 },
          ],
        }),
      );
    });

    it('использует процент комиссии из активного Pro-тира фрилансера (7% вместо 10%)', async () => {
      prisma.subscription.findFirst.mockResolvedValue({
        status: 'ACTIVE',
        tier: { name: 'PRO', commissionPercent: '7.00' },
      });

      await service.releaseEscrow({
        clientWalletId: 'client-wallet',
        freelancerWalletId: 'freelancer-wallet',
        amount: 100,
        invoiceId: 'inv-1',
        orderId: 'ord-1',
        freelancerId: 'freelancer-pro',
      });

      expect(ledger.applyTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'ESCROW_RELEASE',
          entries: [
            { walletId: 'client-wallet', balanceType: 'ESCROW', direction: 'DEBIT', amount: 100 },
            { walletId: 'freelancer-wallet', balanceType: 'WITHDRAWABLE', direction: 'CREDIT', amount: 93 },
            { walletId: systemWallet.id, balanceType: 'MAIN', direction: 'CREDIT', amount: 7 },
          ],
        }),
      );
    });
  });

  describe('requestWithdrawal', () => {
    it('бросает ошибку, если WITHDRAWABLE баланса не хватает', async () => {
      prisma.wallet.findUnique.mockResolvedValue({ id: 'w1', withdrawableBalance: '10.00' });

      await expect(service.requestWithdrawal('user-1', 50)).rejects.toBeInstanceOf(NotFoundException);
      expect(ledger.applyTransaction).not.toHaveBeenCalled();
    });

    it('проводит вывод средств с удержанием комиссии WITHDRAWAL_FEE (1% по дефолту)', async () => {
      prisma.wallet.findUnique.mockResolvedValue({ id: 'w1', withdrawableBalance: '100.00' });
      prisma.commissionRule.findUnique.mockResolvedValue(null);

      const res = await service.requestWithdrawal('user-1', 100);

      expect(res.amount).toBe(100);
      expect(res.fee).toBe(1);
      expect(res.netAmount).toBe(99);

      expect(ledger.applyTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'WITHDRAWAL',
          entries: [
            { walletId: 'w1', balanceType: 'WITHDRAWABLE', direction: 'DEBIT', amount: 100 },
            { walletId: systemWallet.id, balanceType: 'MAIN', direction: 'CREDIT', amount: 99 },
            { walletId: systemWallet.id, balanceType: 'MAIN', direction: 'CREDIT', amount: 1 },
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
