import { Global, Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { BullModule } from '@nestjs/bullmq';
import { EVENT_QUEUE_NAME } from '@taskhunt/shared-types';
import { EventBusService } from './event-bus.service';

// @Global() обязателен: 7 сервисов в 6 разных модулях инжектят
// EventBusService напрямую, ни один явно не импортирует EventBusModule —
// без этого декоратора реальный DI-граф Nest не собирается вообще
// (баг был с Phase 1, но unit-тесты его не ловят, т.к. мокают сервисы
// напрямую через `new`, а не через настоящий Nest DI-контейнер).
@Global()
@Module({
  imports: [
    EventEmitterModule.forRoot(),
    BullModule.registerQueue({ name: EVENT_QUEUE_NAME }),
  ],
  providers: [EventBusService],
  exports: [EventBusService],
})
export class EventBusModule {}
