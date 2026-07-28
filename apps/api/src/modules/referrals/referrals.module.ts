import { Module } from '@nestjs/common';
import { ReferralsService } from './referrals.service';
import { ReferralsController } from './referrals.controller';
import { ReferralsEventsListener } from './referrals-events.listener';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [WalletModule],
  controllers: [ReferralsController],
  providers: [ReferralsService, ReferralsEventsListener],
  exports: [ReferralsService],
})
export class ReferralsModule {}
