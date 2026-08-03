import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { WalletModule } from '../wallet/wallet.module';
import { MatchingModule } from '../matching/matching.module';
import { UsersModule } from '../users/users.module';
import { OrdersService } from './orders.service';
import { MilestonesService } from './milestones.service';
import { ReviewsService } from './reviews.service';
import { OrdersController } from './orders.controller';
import { OrderTemplatesService } from './order-templates.service';
import { OrderTemplatesController } from './order-templates.controller';
import { ExpiredOrdersProcessor, EXPIRED_ORDERS_QUEUE } from './expired-orders.processor';
import { OrderTemplateProcessor, ORDER_TEMPLATE_QUEUE } from './order-template.processor';
import { DeadlineWarningProcessor, DEADLINE_WARNING_QUEUE } from './deadline-warning.processor';

@Module({
  imports: [
    WalletModule,
    MatchingModule,
    UsersModule,
    BullModule.registerQueue(
      { name: EXPIRED_ORDERS_QUEUE },
      { name: ORDER_TEMPLATE_QUEUE },
      { name: DEADLINE_WARNING_QUEUE },
    ),
  ],
  controllers: [OrdersController, OrderTemplatesController],
  providers: [
    OrdersService,
    MilestonesService,
    ReviewsService,
    OrderTemplatesService,
    ExpiredOrdersProcessor,
    OrderTemplateProcessor,
    DeadlineWarningProcessor,
  ],
  exports: [OrdersService, OrderTemplatesService],
})
export class OrdersModule {}
