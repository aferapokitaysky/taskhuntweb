import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsEventsListener } from './notifications-events.listener';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsEventsListener],
  exports: [NotificationsService],
})
export class NotificationsModule {}
