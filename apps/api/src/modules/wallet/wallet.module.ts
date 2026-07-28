import { Module } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { LedgerService } from './ledger.service';
import { InvoiceService } from './invoice.service';
import { NowPaymentsService } from './nowpayments.service';
import { WalletController } from './wallet.controller';
import { NowPaymentsController } from './nowpayments.controller';

@Module({
  controllers: [WalletController, NowPaymentsController],
  providers: [WalletService, LedgerService, InvoiceService, NowPaymentsService],
  exports: [WalletService, LedgerService, InvoiceService],
})
export class WalletModule {}
