import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { BullBoardModule } from '@bull-board/nestjs';
import { ExpressAdapter } from '@bull-board/express';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';

import { PrismaModule } from './prisma/prisma.module';
import { EventBusModule } from './common/events/event-bus.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { SubscriptionAwareThrottlerGuard } from './common/guards/subscription-aware-throttler.guard';

import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { OrdersModule } from './modules/orders/orders.module';
import { ChatModule } from './modules/chat/chat.module';
import { SupportModule } from './modules/support/support.module';
import { AdminModule } from './modules/admin/admin.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { FilesModule } from './modules/files/files.module';
import { ReferralsModule } from './modules/referrals/referrals.module';
import { HealthModule } from './modules/health/health.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { PromotionsModule } from './modules/promotions/promotions.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { SavedSearchesModule } from './modules/saved-searches/saved-searches.module';
import { FraudModule } from './modules/fraud/fraud.module';
import { SearchModule } from './modules/search/search.module';
import { StatsModule } from './modules/stats/stats.module';
import { PAYOUT_QUEUE } from './modules/wallet/payout.processor';
import { FILE_SCAN_QUEUE } from './modules/files/files.service';
import { SUBSCRIPTION_EXPIRATION_QUEUE } from './modules/subscriptions/subscription-expiration.processor';
import { EVENT_QUEUE_NAME } from '@taskhunt/shared-types';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV !== 'production' ? 'debug' : 'info',
        transport: process.env.NODE_ENV !== 'production' ? { target: 'pino-pretty' } : undefined,
      },
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
        },
      }),
      inject: [ConfigService],
    }),
    BullBoardModule.forRoot({
      route: '/admin/queues',
      adapter: ExpressAdapter,
    }),
    BullBoardModule.forFeature({
      name: PAYOUT_QUEUE,
      adapter: BullMQAdapter as any,
    }),
    BullBoardModule.forFeature({
      name: FILE_SCAN_QUEUE,
      adapter: BullMQAdapter as any,
    }),
    BullBoardModule.forFeature({
      name: SUBSCRIPTION_EXPIRATION_QUEUE,
      adapter: BullMQAdapter as any,
    }),
    BullBoardModule.forFeature({
      name: EVENT_QUEUE_NAME,
      adapter: BullMQAdapter as any,
    }),
    PrismaModule,
    EventBusModule,
    AuthModule,
    UsersModule,
    WalletModule,
    OrdersModule,
    ChatModule,
    SupportModule,
    AdminModule,
    CatalogModule,
    FilesModule,
    ReferralsModule,
    HealthModule,
    SubscriptionsModule,
    PromotionsModule,
    NotificationsModule,
    SavedSearchesModule,
    FraudModule,
    SearchModule,
    StatsModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_GUARD, useClass: SubscriptionAwareThrottlerGuard },
  ],
})
export class AppModule {}
