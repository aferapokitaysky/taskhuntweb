import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { SubscriptionExpirationProcessor, SUBSCRIPTION_EXPIRATION_QUEUE } from './subscription-expiration.processor';

@Module({
  imports: [BullModule.registerQueue({ name: SUBSCRIPTION_EXPIRATION_QUEUE })],
  providers: [SubscriptionExpirationProcessor],
  exports: [SubscriptionExpirationProcessor],
})
export class SubscriptionsModule {}
