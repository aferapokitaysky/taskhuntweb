import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { WalletModule } from '../wallet/wallet.module';
import { SubscriptionExpirationProcessor, SUBSCRIPTION_EXPIRATION_QUEUE } from './subscription-expiration.processor';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionsController } from './subscriptions.controller';

@Module({
  imports: [WalletModule, BullModule.registerQueue({ name: SUBSCRIPTION_EXPIRATION_QUEUE })],
  controllers: [SubscriptionsController],
  providers: [SubscriptionExpirationProcessor, SubscriptionsService],
  exports: [SubscriptionExpirationProcessor, SubscriptionsService],
})
export class SubscriptionsModule {}
