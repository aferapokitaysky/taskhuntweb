import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  BidSubmittedEvent,
  BidAcceptedEvent,
  DisputeOpenedEvent,
  DomainEventName,
  EscrowReleasedEvent,
  InvoiceIssuedEvent,
  InvoicePaidEvent,
  OrderInviteCreatedEvent,
  OrderInviteRespondedEvent,
  WorkSubmittedEvent,
} from '@taskhunt/shared-types';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class NotificationsEventsListener {
  private readonly logger = new Logger(NotificationsEventsListener.name);

  constructor(private readonly prisma: PrismaService) {}

  // EventBusService.publish() эмитит через EventEmitter2 не сырой payload,
  // а весь конверт { name, occurredAt, payload } (см. event-bus.service.ts) —
  // поэтому здесь, как и в остальных *-events.listener.ts, читаем event.payload,
  // а не payload напрямую.
  @OnEvent(DomainEventName.BidAccepted)
  async handleBidAccepted(event: BidAcceptedEvent) {
    await this.createNotification({
      userId: event.payload.freelancerId,
      title: 'Отклик принят',
      message: `Ваш отклик на заказ с суммой $${event.payload.amount} принят заказчиком.`,
      eventName: DomainEventName.BidAccepted,
    });
  }

  @OnEvent(DomainEventName.BidSubmitted)
  async handleBidSubmitted(event: BidSubmittedEvent) {
    const order = await this.prisma.order.findUnique({ where: { id: event.payload.orderId } });
    if (!order) return;
    await this.createNotification({
      userId: order.clientId,
      title: 'Новый отклик',
      message: `По заказу "${order.title}" пришёл новый отклик на сумму $${event.payload.amount}.`,
      eventName: DomainEventName.BidSubmitted,
    });
  }

  @OnEvent(DomainEventName.InvoiceIssued)
  async handleInvoiceIssued(event: InvoiceIssuedEvent) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: event.payload.invoiceId },
      include: { order: true },
    });
    if (!invoice) return;
    const issuedBy = await this.prisma.user.findUnique({ where: { id: invoice.issuedById }, include: { profile: true } });
    const sender = issuedBy?.profile?.displayName ?? issuedBy?.email ?? 'Фрилансер';
    await this.createNotification({
      userId: event.payload.payerId,
      title: 'Вам выставили счёт',
      message: `${sender} отправил счёт ${event.payload.amount} ${event.payload.currency} по заказу "${invoice.order.title}".`,
      eventName: DomainEventName.InvoiceIssued,
    });
  }

  @OnEvent(DomainEventName.OrderInviteCreated)
  async handleOrderInviteCreated(event: OrderInviteCreatedEvent) {
    await this.createNotification({
      userId: event.payload.freelancerId,
      title: 'Приглашение в заказ',
      message: `Вас пригласили в заказ "${event.payload.orderTitle}".`,
      eventName: DomainEventName.OrderInviteCreated,
    });
  }

  @OnEvent(DomainEventName.OrderInviteResponded)
  async handleOrderInviteResponded(event: OrderInviteRespondedEvent) {
    await this.createNotification({
      userId: event.payload.clientId,
      title: event.payload.accepted ? 'Приглашение принято' : 'Приглашение отклонено',
      message: `Фрилансер ${event.payload.accepted ? 'принял' : 'отклонил'} приглашение в заказ "${event.payload.orderTitle}".`,
      eventName: DomainEventName.OrderInviteResponded,
    });
  }

  @OnEvent(DomainEventName.InvoicePaid)
  async handleInvoicePaid(event: InvoicePaidEvent) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id: event.payload.invoiceId } });
    if (invoice?.issuedById) {
      await this.createNotification({
        userId: invoice.issuedById,
        title: 'Счёт оплачен',
        message: `Заказчик оплатил счёт на сумму $${event.payload.amount}.`,
        eventName: DomainEventName.InvoicePaid,
      });
    }
  }

  @OnEvent(DomainEventName.EscrowReleased)
  async handleEscrowReleased(event: EscrowReleasedEvent) {
    await this.createNotification({
      userId: event.payload.toFreelancerId,
      title: 'Эскроу выплачен',
      message: `Средства в размере $${event.payload.amount} зачислены на ваш баланс.`,
      eventName: DomainEventName.EscrowReleased,
    });
  }

  @OnEvent(DomainEventName.WorkSubmitted)
  async handleWorkSubmitted(event: WorkSubmittedEvent) {
    const order = await this.prisma.order.findUnique({ where: { id: event.payload.orderId } });
    if (order) {
      await this.createNotification({
        userId: order.clientId,
        title: 'Работа сдана',
        message: `Фрилансер отправил результат работы по заказу "${order.title}" на проверку.`,
        eventName: DomainEventName.WorkSubmitted,
      });
    }
  }

  @OnEvent(DomainEventName.DisputeOpened)
  async handleDisputeOpened(event: DisputeOpenedEvent) {
    const order = await this.prisma.order.findUnique({
      where: { id: event.payload.orderId },
      include: { bids: { where: { status: 'ACCEPTED' } } },
    });
    if (order) {
      const participants = new Set<string>();
      participants.add(order.clientId);
      for (const bid of order.bids) {
        participants.add(bid.freelancerId);
      }
      for (const userId of participants) {
        if (userId !== event.payload.openedById) {
          await this.createNotification({
            userId,
            title: 'Открыт спор',
            message: `По заказу "${order.title}" открыт спор по причине: ${event.payload.reason}`,
            eventName: DomainEventName.DisputeOpened,
          });
        }
      }
    }
  }

  private async createNotification(data: { userId: string; title: string; message: string; eventName: string }) {
    try {
      await this.prisma.notification.create({ data });
    } catch (err) {
      this.logger.error(`Failed to create in-app notification for user ${data.userId}: ${err}`);
    }
  }
}
