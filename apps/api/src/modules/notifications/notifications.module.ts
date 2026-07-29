import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsEventsListener } from './notifications-events.listener';
import { NotificationDigestProcessor, NOTIFICATION_DIGEST_QUEUE } from './notification-digest.processor';

@Module({
  imports: [BullModule.registerQueue({ name: NOTIFICATION_DIGEST_QUEUE })],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsEventsListener, NotificationDigestProcessor],
  exports: [NotificationsService],
})
export class NotificationsModule {}
