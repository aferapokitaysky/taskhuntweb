import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { WalletService } from './wallet.service';

export const AUTO_WITHDRAW_QUEUE = 'auto-withdraw';

@Injectable()
@Processor(AUTO_WITHDRAW_QUEUE)
export class AutoWithdrawProcessor extends WorkerHost {
  private readonly logger = new Logger(AutoWithdrawProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    this.logger.log(`Processing auto-withdrawal check (job ${job.id})`);

    const wallets = await this.prisma.wallet.findMany({
      where: {
        autoWithdrawThreshold: { not: null },
      },
    });

    for (const wallet of wallets) {
      if (!wallet.autoWithdrawThreshold) continue;
      if (wallet.withdrawableBalance.gte(wallet.autoWithdrawThreshold)) {
        try {
          await this.walletService.requestWithdrawal(wallet.userId, Number(wallet.autoWithdrawThreshold));
          this.logger.log(`Auto-withdrawal triggered for user ${wallet.userId} amount ${wallet.autoWithdrawThreshold}`);
        } catch (err) {
          this.logger.error(`Auto-withdrawal failed for user ${wallet.userId}: ${(err as Error).message}`);
        }
      }
    }
  }
}
