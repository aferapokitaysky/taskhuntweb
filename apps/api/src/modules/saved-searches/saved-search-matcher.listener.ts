import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DomainEventName, OrderCreatedEvent } from '@taskhunt/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

// Не долбим одного и того же подписчика уведомлением по одному и тому же
// фильтру чаще раза в 5 минут — защита не от нагрузки на сервер (запрос и
// так один, дешёвый), а от того, что заказчик, постящий заказы пачкой,
// не завалит фрилансера уведомлениями за секунды.
const MATCH_COOLDOWN_MS = 5 * 60 * 1000;

@Injectable()
export class SavedSearchMatcherListener {
  private readonly logger = new Logger(SavedSearchMatcherListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  @OnEvent(DomainEventName.OrderCreated)
  async handleOrderCreated(event: OrderCreatedEvent) {
    // Полезная нагрузка события не содержит tags — дозапрашиваем заказ,
    // как это уже делают другие листенеры в NotificationsEventsListener.
    const order = await this.prisma.order.findUnique({ where: { id: event.payload.orderId } });
    if (!order) return;

    const cooldownCutoff = new Date(Date.now() - MATCH_COOLDOWN_MS);

    // Один индексированный запрос по категории (или "любая категория") +
    // троттлинг по времени в самом запросе — совпадение по тэгам/бюджету
    // после этого фильтруем в JS на уже узком кандидатском наборе.
    const candidates = await this.prisma.savedSearch.findMany({
      where: {
        userId: { not: order.clientId },
        AND: [
          { OR: [{ categoryId: null }, { categoryId: order.categoryId }] },
          { OR: [{ lastMatchedAt: null }, { lastMatchedAt: { lt: cooldownCutoff } }] },
        ],
      },
    });

    const matched = candidates.filter((search) => {
      if (search.tags.length > 0) {
        const orderTags = new Set(order.tags.map((t) => t.toLowerCase()));
        if (!search.tags.some((t) => orderTags.has(t.toLowerCase()))) return false;
      }
      if (search.minBudget !== null) {
        const min = Number(search.minBudget);
        const budgetMax = order.budgetMax !== null ? Number(order.budgetMax) : null;
        const budgetMin = Number(order.budgetMin);
        const meetsMin = budgetMax !== null ? budgetMax >= min : budgetMin >= min;
        if (!meetsMin) return false;
      }
      return true;
    });

    if (matched.length === 0) return;

    // Дедуп: если у одного юзера совпало сразу несколько сохранённых
    // фильтров — одно уведомление, не N.
    const labelsByUser = new Map<string, string[]>();
    for (const search of matched) {
      const labels = labelsByUser.get(search.userId) ?? [];
      labels.push(search.label);
      labelsByUser.set(search.userId, labels);
    }

    for (const [userId, labels] of labelsByUser) {
      try {
        await this.notifications.createForUser({
          userId,
          title: 'Появился подходящий заказ',
          message:
            labels.length === 1
              ? `Заказ "${order.title}" подходит под ваш фильтр «${labels[0]}».`
              : `Заказ "${order.title}" подходит сразу под несколько ваших фильтров: ${labels.join(', ')}.`,
          eventName: 'SavedSearchMatch',
          metadata: {
            orderId: order.id,
            labels,
            href: `/orders/${order.id}`,
          },
        });
      } catch (err) {
        this.logger.error(`Failed to notify user ${userId} about saved search match: ${err}`);
      }
    }

    await this.prisma.savedSearch.updateMany({
      where: { id: { in: matched.map((s) => s.id) } },
      data: { lastMatchedAt: new Date() },
    });
  }
}
