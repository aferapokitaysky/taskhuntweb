import { Module } from '@nestjs/common';
import { WalletModule } from '../wallet/wallet.module';
import { OrdersService } from './orders.service';
import { MilestonesService } from './milestones.service';
import { ReviewsService } from './reviews.service';
import { OrdersController } from './orders.controller';

@Module({
  imports: [WalletModule],
  controllers: [OrdersController],
  providers: [OrdersService, MilestonesService, ReviewsService],
  exports: [OrdersService],
})
export class OrdersModule {}
