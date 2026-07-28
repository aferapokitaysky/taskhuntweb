import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { WalletService } from './wallet.service';
import { LedgerService } from './ledger.service';
import { InvoiceService } from './invoice.service';
import { NowPaymentsService } from './nowpayments.service';
import { WalletController } from './wallet.controller';
import { NowPaymentsController } from './nowpayments.controller';
import { PayoutProcessor, PAYOUT_QUEUE } from './payout.processor';

@Module({
  imports: [BullModule.registerQueue({ name: PAYOUT_QUEUE })],
  controllers: [WalletController, NowPaymentsController],
  providers: [
    WalletService,
    LedgerService,
    InvoiceService,
    NowPaymentsService,
    PayoutProcessor,
  ],
  exports: [WalletService, LedgerService, InvoiceService, NowPaymentsService],
})
export class WalletModule {}
