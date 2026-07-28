import { PayoutProcessor } from '../payout.processor';

describe('PayoutProcessor', () => {
  let processor: PayoutProcessor;
  let prisma: any;
  let ledgerService: { applyTransaction: jest.Mock };
  let walletService: { getSystemWalletId: jest.Mock };
  let nowPaymentsService: { createPayout: jest.Mock };

  beforeEach(() => {
    prisma = {
      wallet: {
        findUnique: jest.fn(),
      },
    };

    ledgerService = {
      applyTransaction: jest.fn().mockResolvedValue({ id: 'refund-tx-1' }),
    };

    walletService = {
      getSystemWalletId: jest.fn().mockResolvedValue('system-wallet-id'),
    };

    nowPaymentsService = {
      createPayout: jest.fn(),
    };

    processor = new PayoutProcessor(
      prisma,
      ledgerService as any,
      walletService as any,
      nowPaymentsService as any,
    );
  });

  it('успешно вызывает createPayout в NOWPayments и не начисляет откат', async () => {
    nowPaymentsService.createPayout.mockResolvedValue({
      id: 'payout-123',
      status: 'PROCESSING',
    });

    const job = {
      data: {
        ledgerTransactionId: 'tx-1',
        userId: 'user-1',
        amount: 50,
        payoutAddress: '0x123abc',
      },
    } as any;

    await processor.process(job);

    expect(nowPaymentsService.createPayout).toHaveBeenCalledWith({
      address: '0x123abc',
      amount: 50,
    });
    expect(ledgerService.applyTransaction).not.toHaveBeenCalled();
  });

  it('при ошибке NOWPayments откатывает средства пользователю обратно через REFUND транзакцию в Ledger', async () => {
    nowPaymentsService.createPayout.mockRejectedValue(
      new Error('NOWPayments API error 500'),
    );
    prisma.wallet.findUnique.mockResolvedValue({ id: 'user-wallet-id' });

    const job = {
      data: {
        ledgerTransactionId: 'tx-failed-1',
        userId: 'user-1',
        amount: 100,
        payoutAddress: '0x123abc',
      },
    } as any;

    await expect(processor.process(job)).rejects.toThrow('NOWPayments API error 500');

    expect(walletService.getSystemWalletId).toHaveBeenCalled();
    expect(ledgerService.applyTransaction).toHaveBeenCalledWith({
      type: 'REFUND',
      referenceType: 'PAYOUT_FAILED',
      referenceId: 'tx-failed-1',
      description: 'Refund failed payout for transaction tx-failed-1',
      entries: [
        {
          walletId: 'system-wallet-id',
          balanceType: 'MAIN',
          direction: 'DEBIT',
          amount: 100,
        },
        {
          walletId: 'user-wallet-id',
          balanceType: 'WITHDRAWABLE',
          direction: 'CREDIT',
          amount: 100,
        },
      ],
    });
  });
});
