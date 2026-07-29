import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { WalletModule } from '../wallet/wallet.module';
import { MatchingModule } from '../matching/matching.module';
import { UsersModule } from '../users/users.module';
import { OrdersService } from './orders.service';
import { MilestonesService } from './milestones.service';
import { ReviewsService } from './reviews.service';
import { OrdersController } from './orders.controller';
import { ExpiredOrdersProcessor, EXPIRED_ORDERS_QUEUE } from './expired-orders.processor';

@Module({
  imports: [
    WalletModule,
    MatchingModule,
    UsersModule,
    BullModule.registerQueue({ name: EXPIRED_ORDERS_QUEUE }),
  ],
  controllers: [OrdersController],
  providers: [OrdersService, MilestonesService, ReviewsService, ExpiredOrdersProcessor],
  exports: [OrdersService],
})
export class OrdersModule {}
