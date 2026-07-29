import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { WalletService } from './wallet.service';
import { LedgerService } from './ledger.service';
import { InvoiceService } from './invoice.service';
import { NowPaymentsService } from './nowpayments.service';
import { PayoutAddressesService } from './payout-addresses.service';
import { WalletController } from './wallet.controller';
import { NowPaymentsController } from './nowpayments.controller';
import { PayoutAddressesController } from './payout-addresses.controller';
import { PayoutProcessor, PAYOUT_QUEUE } from './payout.processor';
import { AutoWithdrawProcessor, AUTO_WITHDRAW_QUEUE } from './auto-withdraw.processor';

@Module({
  imports: [
    BullModule.registerQueue({ name: PAYOUT_QUEUE }),
    BullModule.registerQueue({ name: AUTO_WITHDRAW_QUEUE }),
  ],
  controllers: [WalletController, NowPaymentsController, PayoutAddressesController],
  providers: [
    WalletService,
    LedgerService,
    InvoiceService,
    NowPaymentsService,
    PayoutAddressesService,
    PayoutProcessor,
    AutoWithdrawProcessor,
  ],
  exports: [WalletService, LedgerService, InvoiceService, NowPaymentsService, PayoutAddressesService],
})
export class WalletModule {}
