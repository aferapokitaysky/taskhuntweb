import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { LedgerService } from './ledger.service';
import { WalletService } from './wallet.service';
import { NowPaymentsService } from './nowpayments.service';

export const PAYOUT_QUEUE = 'payout-queue';

export interface PayoutJobData {
  ledgerTransactionId: string;
  userId: string;
  amount: number;
  netAmount?: number;
  payoutAddress: string;
}

@Processor(PAYOUT_QUEUE)
export class PayoutProcessor extends WorkerHost {
  private readonly logger = new Logger(PayoutProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerService: LedgerService,
    private readonly walletService: WalletService,
    private readonly nowPaymentsService: NowPaymentsService,
  ) {
    super();
  }

  async process(job: Job<PayoutJobData>): Promise<void> {
    const { ledgerTransactionId, userId, amount, netAmount, payoutAddress } = job.data;
    const payoutAmount = netAmount ?? amount;

    this.logger.log(
      `Processing crypto payout for transaction ${ledgerTransactionId}, requested $${amount}, net payout $${payoutAmount} to ${payoutAddress}`,
    );

    try {
      const payoutResult = await this.nowPaymentsService.createPayout({
        address: payoutAddress,
        amount: payoutAmount,
      });

      this.logger.log(
        `NOWPayments payout initiated successfully for tx ${ledgerTransactionId}: ${payoutResult.id} (status: ${payoutResult.status})`,
      );
    } catch (err) {
      this.logger.error(
        `NOWPayments payout failed for transaction ${ledgerTransactionId}: ${
          err instanceof Error ? err.message : String(err)
        }. Initiating REFUND of full amount $${amount} to user ${userId}.`,
      );

      const userWallet = await this.prisma.wallet.findUnique({ where: { userId } });
      if (userWallet) {
        const systemWalletId = await this.walletService.getSystemWalletId();
        await this.ledgerService.applyTransaction({
          type: 'REFUND',
          referenceType: 'PAYOUT_FAILED',
          referenceId: ledgerTransactionId,
          description: `Refund failed payout for transaction ${ledgerTransactionId}`,
          entries: [
            {
              walletId: systemWalletId,
              balanceType: 'MAIN',
              direction: 'DEBIT',
              amount,
            },
            {
              walletId: userWallet.id,
              balanceType: 'WITHDRAWABLE',
              direction: 'CREDIT',
              amount,
            },
          ],
        });
        this.logger.log(`Refunded $${amount} back to user ${userId} WITHDRAWABLE balance`);
      }

      throw err;
    }
  }
}
