import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { DomainEvent, DomainEventName, EVENT_QUEUE_NAME } from '@taskhunt/shared-types';

/**
 * Единственная точка публикации доменных событий.
 *
 * - Внутри монолита события летят синхронно через EventEmitter2, чтобы
 *   модули не импортировали сервисы друг друга напрямую (auth не должен
 *   знать о wallet, wallet не должен знать о notifications).
 * - Наружу (notifications-service, fraud-service) — то же событие кладётся
 *   в очередь BullMQ. Публикация в очередь не блокирует бизнес-транзакцию:
 *   если Redis недоступен, ошибка логируется, но HTTP-ответ пользователю
 *   не должен из-за этого падать (события — best-effort side-effect).
 */
@Injectable()
export class EventBusService {
  private readonly logger = new Logger(EventBusService.name);

  constructor(
    private readonly emitter: EventEmitter2,
    @InjectQueue(EVENT_QUEUE_NAME) private readonly queue: Queue,
  ) {}

  async publish<TName extends DomainEventName>(
    name: TName,
    payload: Extract<DomainEvent, { name: TName }>['payload'],
  ): Promise<void> {
    const event = { name, occurredAt: new Date().toISOString(), payload } as DomainEvent;

    // 1) локальные подписчики внутри монолита (синхронно, в рамках процесса)
    this.emitter.emit(name, event);

    // 2) внешние микросервисы (асинхронно, через очередь)
    try {
      await this.queue.add(name, event, {
        removeOnComplete: 1000,
        removeOnFail: 5000,
        attempts: 5,
        backoff: { type: 'exponential', delay: 2000 },
      });
    } catch (err) {
      this.logger.error(`Failed to publish "${name}" to external queue`, err as Error);
    }
  }
}
