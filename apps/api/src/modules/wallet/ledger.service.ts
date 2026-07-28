import { BadRequestException, Injectable } from '@nestjs/common';
import { BalanceType, LedgerDirection, LedgerTransactionType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface LedgerEntryInput {
  walletId: string;
  balanceType: BalanceType;
  direction: LedgerDirection;
  amount: number | string;
}

export interface ApplyTransactionInput {
  type: LedgerTransactionType;
  referenceType: string;
  referenceId?: string;
  description?: string;
  createdById?: string;
  entries: LedgerEntryInput[];
}

const BALANCE_COLUMN: Record<BalanceType, keyof Prisma.WalletUncheckedUpdateInput> = {
  MAIN: 'mainBalance',
  ESCROW: 'escrowBalance',
  LOCKED: 'lockedBalance',
  WITHDRAWABLE: 'withdrawableBalance',
  PENDING: 'pendingBalance',
};

/**
 * Ядро double-entry ledger. Единственное место в системе, которое имеет
 * право писать в LedgerEntry и трогать кэш-баланс Wallet.
 *
 * Правило: сумма DEBIT должна быть равна сумме CREDIT внутри одной
 * транзакции (по каждой валюте). Если это не так — это баг вызывающего
 * кода, а не что-то, что можно "почти" разрешить, поэтому кидаем исключение
 * и ничего не пишем в БД.
 */
@Injectable()
export class LedgerService {
  constructor(private readonly prisma: PrismaService) {}

  async applyTransaction(input: ApplyTransactionInput) {
    this.assertBalanced(input.entries);

    return this.prisma.$transaction(async (tx) => {
      const transaction = await tx.ledgerTransaction.create({
        data: {
          type: input.type,
          referenceType: input.referenceType,
          referenceId: input.referenceId,
          description: input.description,
          createdById: input.createdById,
        },
      });

      for (const entry of input.entries) {
        await tx.ledgerEntry.create({
          data: {
            transactionId: transaction.id,
            walletId: entry.walletId,
            balanceType: entry.balanceType,
            direction: entry.direction,
            amount: entry.amount,
          },
        });

        const column = BALANCE_COLUMN[entry.balanceType];
        const signedDelta =
          entry.direction === 'CREDIT' ? entry.amount : `-${entry.amount}`;

        await tx.wallet.update({
          where: { id: entry.walletId },
          data: { [column]: { increment: new Prisma.Decimal(signedDelta) } },
        });
      }

      return transaction;
    });
  }

  private assertBalanced(entries: LedgerEntryInput[]) {
    if (entries.length < 2) {
      throw new BadRequestException('Ledger transaction requires at least two entries (double-entry)');
    }

    let debit = new Prisma.Decimal(0);
    let credit = new Prisma.Decimal(0);

    for (const entry of entries) {
      const amount = new Prisma.Decimal(entry.amount);
      if (amount.lte(0)) {
        throw new BadRequestException('Ledger entry amount must be positive');
      }
      if (entry.direction === 'DEBIT') {
        debit = debit.plus(amount);
      } else {
        credit = credit.plus(amount);
      }
    }

    if (!debit.equals(credit)) {
      throw new BadRequestException(
        `Unbalanced ledger transaction: debit=${debit.toString()} credit=${credit.toString()}`,
      );
    }
  }
}
