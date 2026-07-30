import type {
  BidAcceptedEvent,
  BidSubmittedEvent,
  DisputeOpenedEvent,
  EscrowLockedEvent,
  EscrowReleasedEvent,
  InvoiceIssuedEvent,
  InvoicePaidEvent,
  OrderCreatedEvent,
  OrderInviteCreatedEvent,
  WorkSubmittedEvent,
} from '@taskhunt/shared-types';
import type { HandlerContext } from './shared';
import { notifyUser } from './shared';

export function handleOrderCreated(event: OrderCreatedEvent, context: HandlerContext) {
  return notifyUser(context, event.payload.clientId, {
    eventName: event.name,
    title: 'Заказ опубликован',
    message: `Заказ ${event.payload.orderId} опубликован с бюджетом от ${event.payload.budgetMin}.`,
    metadata: event.payload,
  });
}

export async function handleBidSubmitted(event: BidSubmittedEvent, context: HandlerContext) {
  const order = await context.prisma.order.findUnique({
    where: { id: event.payload.orderId },
    select: { clientId: true, title: true },
  });

  const notifications = [
    notifyUser(context, event.payload.freelancerId, {
      eventName: event.name,
      title: 'Отклик отправлен',
      message: `Отклик ${event.payload.bidId} на заказ ${event.payload.orderId} отправлен.`,
      metadata: event.payload,
    }),
  ];

  // Заказчик раньше вообще не узнавал о новом отклике — только сам
  // фрилансер получал подтверждение "отклик отправлен". Без уведомления
  // клиент видел новых откликнувшихся, только зайдя на страницу заказа
  // вручную (баг из живого тестирования: "нет уведомления заказчику").
  if (order) {
    notifications.push(
      notifyUser(context, order.clientId, {
        eventName: event.name,
        title: 'Новый отклик на заказ',
        message: `На заказ «${order.title}» откликнулись за ${event.payload.amount}.`,
        metadata: event.payload,
      }),
    );
  }

  return Promise.all(notifications);
}

export function handleBidAccepted(event: BidAcceptedEvent, context: HandlerContext) {
  return Promise.all([
    notifyUser(context, event.payload.freelancerId, {
      eventName: event.name,
      title: 'Отклик принят',
      message: `Ваш отклик на заказ ${event.payload.orderId} принят.`,
      metadata: event.payload,
    }),
    notifyUser(context, event.payload.clientId, {
      eventName: event.name,
      title: 'Исполнитель выбран',
      message: `По заказу ${event.payload.orderId} выбран исполнитель.`,
      metadata: event.payload,
    }),
  ]);
}

export function handleInvoiceIssued(event: InvoiceIssuedEvent, context: HandlerContext) {
  return notifyUser(context, event.payload.payerId, {
    eventName: event.name,
    title: 'Выставлен счёт',
    message: `По заказу ${event.payload.orderId} выставлен счёт на ${event.payload.amount} ${event.payload.currency}.`,
    metadata: event.payload,
  });
}

export function handleInvoicePaid(event: InvoicePaidEvent, context: HandlerContext) {
  return Promise.all([
    notifyUser(context, event.payload.payerId, {
      eventName: event.name,
      title: 'Счёт оплачен',
      message: `Счёт ${event.payload.invoiceId} оплачен.`,
      metadata: event.payload,
    }),
    notifyUser(context, event.payload.freelancerId, {
      eventName: event.name,
      title: 'Счёт оплачен заказчиком',
      message: `По заказу ${event.payload.orderId} получена оплата ${event.payload.amount} ${event.payload.currency}.`,
      metadata: event.payload,
    }),
  ]);
}

export function handleEscrowLocked(event: EscrowLockedEvent, context: HandlerContext) {
  return notifyUser(context, event.payload.clientId, {
    eventName: event.name,
    title: 'Эскроу заморожен',
    message: `По заказу ${event.payload.orderId} заморожено ${event.payload.amount}.`,
    metadata: event.payload,
  });
}

export function handleEscrowReleased(event: EscrowReleasedEvent, context: HandlerContext) {
  return notifyUser(context, event.payload.toFreelancerId, {
    eventName: event.name,
    title: 'Эскроу выплачен',
    message: `По заказу ${event.payload.orderId} выплачено ${event.payload.amount}.`,
    metadata: event.payload,
  });
}

export function handleWorkSubmitted(event: WorkSubmittedEvent, context: HandlerContext) {
  return Promise.all([
    notifyUser(context, event.payload.submittedById, {
      eventName: event.name,
      title: 'Работа отправлена',
      message: `Сдача ${event.payload.deliveryId} по заказу ${event.payload.orderId} отправлена.`,
      metadata: event.payload,
    }),
    notifyUser(context, event.payload.clientId, {
      eventName: event.name,
      title: 'Работа готова к проверке',
      message: `Исполнитель отправил сдачу по заказу ${event.payload.orderId}.`,
      metadata: event.payload,
    }),
  ]);
}

export function handleOrderInviteCreated(event: OrderInviteCreatedEvent, context: HandlerContext) {
  return notifyUser(context, event.payload.freelancerId, {
    eventName: event.name,
    title: 'Вас пригласили на заказ',
    message: `Заказчик пригласил вас откликнуться на заказ «${event.payload.orderTitle}».`,
    metadata: event.payload,
  });
}

export function handleDisputeOpened(event: DisputeOpenedEvent, context: HandlerContext) {
  return notifyUser(context, event.payload.openedById, {
    eventName: event.name,
    title: 'Спор открыт',
    message: `По заказу ${event.payload.orderId} открыт спор.`,
    metadata: event.payload,
  });
}
