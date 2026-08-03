import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  BidSubmittedEvent,
  BidAcceptedEvent,
  DisputeOpenedEvent,
  DomainEventName,
  EscrowLockedEvent,
  EscrowReleasedEvent,
  InvoiceIssuedEvent,
  InvoicePaidEvent,
  DeadlineExtensionRequestedEvent,
  DeadlineExtensionRespondedEvent,
  OrderInviteCreatedEvent,
  OrderInviteRespondedEvent,
  SubscriptionExpiringSoonEvent,
  WalletDepositPaidEvent,
  WorkSubmittedEvent,
} from '@taskhunt/shared-types';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsGateway } from './notifications.gateway';

@Injectable()
export class NotificationsEventsListener {
  private readonly logger = new Logger(NotificationsEventsListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: NotificationsGateway,
  ) {}

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
      metadata: {
        orderId: event.payload.orderId,
        bidId: event.payload.bidId,
        href: `/orders/${event.payload.orderId}`,
      },
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
      metadata: {
        orderId: event.payload.orderId,
        bidId: event.payload.bidId,
        freelancerId: event.payload.freelancerId,
        href: `/orders/${event.payload.orderId}`,
      },
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
      metadata: {
        orderId: event.payload.orderId,
        invoiceId: event.payload.invoiceId,
        freelancerId: invoice.issuedById,
        href: `/chats?orderId=${event.payload.orderId}&freelancerId=${invoice.issuedById}`,
      },
    });
  }

  @OnEvent(DomainEventName.OrderInviteCreated)
  async handleOrderInviteCreated(event: OrderInviteCreatedEvent) {
    await this.createNotification({
      userId: event.payload.freelancerId,
      title: 'Приглашение в заказ',
      message: `Вас пригласили в заказ "${event.payload.orderTitle}".`,
      eventName: DomainEventName.OrderInviteCreated,
      metadata: {
        inviteId: event.payload.inviteId,
        orderId: event.payload.orderId,
        clientId: event.payload.clientId,
        href: `/orders/${event.payload.orderId}`,
      },
    });
  }

  @OnEvent(DomainEventName.OrderInviteResponded)
  async handleOrderInviteResponded(event: OrderInviteRespondedEvent) {
    await this.createNotification({
      userId: event.payload.clientId,
      title: event.payload.accepted ? 'Приглашение принято' : 'Приглашение отклонено',
      message: `Фрилансер ${event.payload.accepted ? 'принял' : 'отклонил'} приглашение в заказ "${event.payload.orderTitle}".`,
      eventName: DomainEventName.OrderInviteResponded,
      metadata: {
        inviteId: event.payload.inviteId,
        orderId: event.payload.orderId,
        freelancerId: event.payload.freelancerId,
        accepted: event.payload.accepted,
        href: `/orders/${event.payload.orderId}`,
      },
    });
  }

  @OnEvent(DomainEventName.InvoicePaid)
  async handleInvoicePaid(event: InvoicePaidEvent) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id: event.payload.invoiceId } });
    await this.createNotification({
      userId: event.payload.payerId,
      title: 'Оплата подтверждена',
      message: `Платёж на сумму ${event.payload.amount} ${event.payload.currency} подтверждён. Средства переведены в эскроу заказа.`,
      eventName: DomainEventName.InvoicePaid,
      metadata: {
        orderId: event.payload.orderId,
        invoiceId: event.payload.invoiceId,
        freelancerId: event.payload.freelancerId,
        href: `/orders/${event.payload.orderId}#payment-history`,
      },
    });
    if (invoice?.issuedById) {
      if (invoice.issuedById === event.payload.payerId) return;
      await this.createNotification({
        userId: invoice.issuedById,
        title: 'Счёт оплачен',
        message: `Заказчик оплатил счёт на сумму $${event.payload.amount}.`,
        eventName: DomainEventName.InvoicePaid,
        metadata: {
          orderId: event.payload.orderId,
          invoiceId: event.payload.invoiceId,
          payerId: event.payload.payerId,
          href: `/chats?orderId=${event.payload.orderId}&freelancerId=${event.payload.freelancerId}`,
        },
      });
    }
  }

  @OnEvent(DomainEventName.EscrowLocked)
  async handleEscrowLocked(event: EscrowLockedEvent) {
    const order = await this.prisma.order.findUnique({
      where: { id: event.payload.orderId },
      include: { bids: { where: { status: 'ACCEPTED' } } },
    });
    const freelancerId = order?.bids[0]?.freelancerId;
    if (!order || !freelancerId) return;
    await this.createNotification({
      userId: freelancerId,
      title: 'Эскроу открыт',
      message: `Заказчик внёс ${event.payload.amount} ${order.currency} в эскроу по заказу "${order.title}". Можно спокойно продолжать работу.`,
      eventName: DomainEventName.EscrowLocked,
      metadata: {
        orderId: event.payload.orderId,
        href: `/orders/${event.payload.orderId}#payment-history`,
      },
    });
  }

  @OnEvent(DomainEventName.EscrowReleased)
  async handleEscrowReleased(event: EscrowReleasedEvent) {
    const order = await this.prisma.order.findUnique({ where: { id: event.payload.orderId } });
    await this.createNotification({
      userId: event.payload.toFreelancerId,
      title: 'Эскроу выплачен',
      message: `Средства ${event.payload.amount} ${order?.currency ?? 'USD'} зачислены на доступный баланс.`,
      eventName: DomainEventName.EscrowReleased,
      metadata: {
        orderId: event.payload.orderId,
        href: `/orders/${event.payload.orderId}#payment-history`,
      },
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
        metadata: {
          orderId: event.payload.orderId,
          deliveryId: event.payload.deliveryId,
          submittedById: event.payload.submittedById,
          href: `/orders/${event.payload.orderId}`,
        },
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
            metadata: {
              orderId: event.payload.orderId,
              disputeId: event.payload.disputeId,
              openedById: event.payload.openedById,
              href: `/orders/${event.payload.orderId}`,
            },
          });
        }
      }
    }
  }

  @OnEvent(DomainEventName.DeadlineExtensionRequested)
  async handleDeadlineExtensionRequested(event: DeadlineExtensionRequestedEvent) {
    const order = await this.prisma.order.findUnique({ where: { id: event.payload.orderId } });
    await this.createNotification({
      userId: event.payload.clientId,
      title: 'Запрошено продление срока',
      message: `Исполнитель просит продлить срок по заказу "${order?.title ?? 'заказ'}" до ${new Date(event.payload.newDeadline).toLocaleDateString('ru-RU')}.`,
      eventName: DomainEventName.DeadlineExtensionRequested,
      metadata: {
        orderId: event.payload.orderId,
        requestId: event.payload.requestId,
        freelancerId: event.payload.freelancerId,
        href: `/orders/${event.payload.orderId}`,
      },
    });
  }

  @OnEvent(DomainEventName.DeadlineExtensionResponded)
  async handleDeadlineExtensionResponded(event: DeadlineExtensionRespondedEvent) {
    const order = await this.prisma.order.findUnique({ where: { id: event.payload.orderId } });
    await this.createNotification({
      userId: event.payload.freelancerId,
      title: event.payload.approved ? 'Продление принято' : 'Продление отклонено',
      message: `Заказчик ${event.payload.approved ? 'принял' : 'отклонил'} продление срока по заказу "${order?.title ?? 'заказ'}".`,
      eventName: DomainEventName.DeadlineExtensionResponded,
      metadata: {
        orderId: event.payload.orderId,
        requestId: event.payload.requestId,
        clientId: event.payload.clientId,
        href: `/orders/${event.payload.orderId}`,
      },
    });
  }

  // Раньше это событие публиковалось (SubscriptionExpirationProcessor),
  // но никто его не слушал — ни здесь, ни в notifications-service. Платящий
  // пользователь узнавал об истечении подписки только постфактум, когда она
  // уже истекла, без единого предупреждения.
  @OnEvent(DomainEventName.SubscriptionExpiringSoon)
  async handleSubscriptionExpiringSoon(event: SubscriptionExpiringSoonEvent) {
    const expiresDate = new Date(event.payload.expiresAt).toLocaleDateString('ru-RU');
    await this.createNotification({
      userId: event.payload.userId,
      title: 'Подписка скоро истечёт',
      message: `Тариф "${event.payload.tierName}" истекает ${expiresDate}. Продлите, чтобы не потерять преимущества.`,
      eventName: DomainEventName.SubscriptionExpiringSoon,
      metadata: {
        tierName: event.payload.tierName,
        expiresAt: event.payload.expiresAt,
        href: '/pricing',
      },
    });
  }

  @OnEvent(DomainEventName.WalletDepositPaid)
  async handleWalletDepositPaid(event: WalletDepositPaidEvent) {
    await this.createNotification({
      userId: event.payload.userId,
      title: 'Кошелёк пополнен',
      message: `Баланс пополнен на ${event.payload.amount} ${event.payload.currency}.`,
      eventName: DomainEventName.WalletDepositPaid,
      metadata: { depositId: event.payload.depositId, href: '/dashboard' },
    });
  }

  private async createNotification(data: {
    userId: string;
    title: string;
    message: string;
    eventName: string;
    metadata?: Prisma.InputJsonValue;
  }) {
    try {
      const notification = await this.prisma.notification.create({ data });
      // Раньше колокольчик узнавал о новом уведомлении только через
      // polling раз в 30с (NotificationBell) — "отправил отклик, уведомление
      // не пришло" было не багом, а просто ожиданием таймера. Теперь
      // толкаем сразу через личный сокет-канал пользователя.
      this.gateway.emitToUser(data.userId, 'notification', notification);
    } catch (err) {
      this.logger.error(`Failed to create in-app notification for user ${data.userId}: ${err}`);
    }
  }
}
