import { BadRequestException } from '@nestjs/common';
import { LedgerService } from '../ledger.service';

/**
 * Ledger — единственное место, которое имеет право двигать деньги.
 * Эти тесты проверяют самое важное инвариантное свойство системы:
 * ни одна проводка не должна пройти, если DEBIT != CREDIT, и каждая
 * проведённая запись обязана корректно менять кэш-баланс кошелька
 * (increment с правильным знаком в зависимости от direction).
 */
describe('LedgerService', () => {
  let service: LedgerService;
  let tx: {
    ledgerTransaction: { create: jest.Mock };
    ledgerEntry: { create: jest.Mock };
    wallet: { update: jest.Mock };
  };
  let prisma: { $transaction: jest.Mock };

  beforeEach(() => {
    tx = {
      ledgerTransaction: { create: jest.fn().mockResolvedValue({ id: 'tx-1' }) },
      ledgerEntry: { create: jest.fn().mockResolvedValue({}) },
      wallet: { update: jest.fn().mockResolvedValue({}) },
    };
    prisma = {
      $transaction: jest.fn((callback: (tx: unknown) => unknown) => callback(tx)),
    };
    service = new LedgerService(prisma as any);
  });

  it('отклоняет транзакцию с одной записью (double-entry требует минимум две)', async () => {
    await expect(
      service.applyTransaction({
        type: 'DEPOSIT',
        referenceType: 'TEST',
        entries: [{ walletId: 'w1', balanceType: 'MAIN', direction: 'CREDIT', amount: 10 }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('отклоняет запись с нулевой или отрицательной суммой', async () => {
    await expect(
      service.applyTransaction({
        type: 'DEPOSIT',
        referenceType: 'TEST',
        entries: [
          { walletId: 'w1', balanceType: 'MAIN', direction: 'DEBIT', amount: 0 },
          { walletId: 'w2', balanceType: 'MAIN', direction: 'CREDIT', amount: 0 },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('отклоняет несбалансированную транзакцию (сумма DEBIT != сумма CREDIT)', async () => {
    await expect(
      service.applyTransaction({
        type: 'DEPOSIT',
        referenceType: 'TEST',
        entries: [
          { walletId: 'w1', balanceType: 'MAIN', direction: 'DEBIT', amount: 100 },
          { walletId: 'w2', balanceType: 'MAIN', direction: 'CREDIT', amount: 50 },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('проводит сбалансированную транзакцию из двух записей и корректно меняет кэш-баланс со знаком', async () => {
    await service.applyTransaction({
      type: 'ESCROW_LOCK',
      referenceType: 'INVOICE',
      referenceId: 'inv-1',
      entries: [
        { walletId: 'system', balanceType: 'MAIN', direction: 'DEBIT', amount: 100 },
        { walletId: 'client', balanceType: 'ESCROW', direction: 'CREDIT', amount: 100 },
      ],
    });

    expect(tx.ledgerTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: 'ESCROW_LOCK', referenceType: 'INVOICE', referenceId: 'inv-1' }),
    });
    expect(tx.ledgerEntry.create).toHaveBeenCalledTimes(2);

    const systemUpdate = tx.wallet.update.mock.calls.find((call) => call[0].where.id === 'system');
    const clientUpdate = tx.wallet.update.mock.calls.find((call) => call[0].where.id === 'client');

    // DEBIT на системном кошельке -> отрицательный increment (деньги "ушли" из системы наружу)
    expect(systemUpdate[0].data.mainBalance.increment.toString()).toBe('-100');
    // CREDIT на кошельке клиента -> положительный increment
    expect(clientUpdate[0].data.escrowBalance.increment.toString()).toBe('100');
  });

  it('поддерживает транзакцию из трёх записей (релиз эскроу с удержанием комиссии)', async () => {
    // 100 эскроу клиента -> 90 фрилансеру + 10 комиссии платформе, баланс сходится
    await service.applyTransaction({
      type: 'ESCROW_RELEASE',
      referenceType: 'INVOICE',
      referenceId: 'inv-1',
      entries: [
        { walletId: 'client', balanceType: 'ESCROW', direction: 'DEBIT', amount: 100 },
        { walletId: 'freelancer', balanceType: 'WITHDRAWABLE', direction: 'CREDIT', amount: 90 },
        { walletId: 'system', balanceType: 'MAIN', direction: 'CREDIT', amount: 10 },
      ],
    });

    expect(tx.ledgerEntry.create).toHaveBeenCalledTimes(3);
    expect(tx.wallet.update).toHaveBeenCalledTimes(3);

    const freelancerUpdate = tx.wallet.update.mock.calls.find((call) => call[0].where.id === 'freelancer');
    expect(freelancerUpdate[0].data.withdrawableBalance.increment.toString()).toBe('90');
  });

  it('не пишет ничего в БД, если валидация не прошла (fail-fast до начала $transaction)', async () => {
    await expect(
      service.applyTransaction({
        type: 'DEPOSIT',
        referenceType: 'TEST',
        entries: [
          { walletId: 'w1', balanceType: 'MAIN', direction: 'DEBIT', amount: -5 },
          { walletId: 'w2', balanceType: 'MAIN', direction: 'CREDIT', amount: 5 },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(tx.ledgerTransaction.create).not.toHaveBeenCalled();
  });
});
