import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { JwtModule } from '@nestjs/jwt';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsEventsListener } from './notifications-events.listener';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationDigestProcessor, NOTIFICATION_DIGEST_QUEUE } from './notification-digest.processor';

@Module({
  imports: [BullModule.registerQueue({ name: NOTIFICATION_DIGEST_QUEUE }), JwtModule.register({})],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsEventsListener, NotificationsGateway, NotificationDigestProcessor],
  exports: [NotificationsService, NotificationsGateway],
})
export class NotificationsModule {}
