import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { BullModule } from '@nestjs/bullmq';
import { EVENT_QUEUE_NAME } from '@taskhunt/shared-types';
import { EventBusService } from './event-bus.service';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    BullModule.registerQueue({ name: EVENT_QUEUE_NAME }),
  ],
  providers: [EventBusService],
  exports: [EventBusService],
})
export class EventBusModule {}
