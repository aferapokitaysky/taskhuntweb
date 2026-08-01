import { DomainEventName } from '@taskhunt/shared-types';
import { NotificationsEventsListener } from '../notifications-events.listener';

function event<TName extends DomainEventName, TPayload>(name: TName, payload: TPayload) {
  return {
    name,
    occurredAt: new Date('2026-08-01T12:00:00.000Z').toISOString(),
    payload,
  } as any;
}

describe('NotificationsEventsListener', () => {
  let prisma: any;
  let gateway: any;
  let listener: NotificationsEventsListener;

  beforeEach(() => {
    prisma = {
      order: { findUnique: jest.fn() },
      invoice: { findUnique: jest.fn() },
      user: { findUnique: jest.fn() },
      notification: { create: jest.fn().mockResolvedValue({ id: 'notification-1' }) },
    };
    gateway = { emitToUser: jest.fn() };
    listener = new NotificationsEventsListener(prisma, gateway);
  });

  it('уведомление о новом отклике ведёт заказчика в нужный заказ с bid/freelancer metadata', async () => {
    prisma.order.findUnique.mockResolvedValue({ id: 'order-1', title: 'Landing page', clientId: 'client-1' });

    await listener.handleBidSubmitted(
      event(DomainEventName.BidSubmitted, {
        bidId: 'bid-1',
        orderId: 'order-1',
        freelancerId: 'freelancer-1',
        amount: 800,
      }),
    );

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'client-1',
        title: 'Новый отклик',
        eventName: DomainEventName.BidSubmitted,
        metadata: {
          orderId: 'order-1',
          bidId: 'bid-1',
          freelancerId: 'freelancer-1',
          href: '/orders/order-1',
        },
      }),
    });
  });

  it('уведомление о принятом отклике ведёт исполнителя в заказ', async () => {
    await listener.handleBidAccepted(
      event(DomainEventName.BidAccepted, {
        bidId: 'bid-1',
        orderId: 'order-1',
        freelancerId: 'freelancer-1',
        clientId: 'client-1',
        amount: 800,
      }),
    );

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'freelancer-1',
        title: 'Отклик принят',
        eventName: DomainEventName.BidAccepted,
        metadata: {
          orderId: 'order-1',
          bidId: 'bid-1',
          href: '/orders/order-1',
        },
      }),
    });
  });

  it('уведомление о выставленном счёте ведёт плательщика сразу в чат по заказу', async () => {
    prisma.invoice.findUnique.mockResolvedValue({
      id: 'invoice-1',
      orderId: 'order-1',
      issuedById: 'freelancer-1',
      order: { id: 'order-1', title: 'Landing page' },
    });
    prisma.user.findUnique.mockResolvedValue({ id: 'freelancer-1', email: 'pro@test.dev', profile: { displayName: 'Pro Designer' } });

    await listener.handleInvoiceIssued(
      event(DomainEventName.InvoiceIssued, {
        invoiceId: 'invoice-1',
        orderId: 'order-1',
        payerId: 'client-1',
        amount: 500,
        currency: 'USD',
      }),
    );

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'client-1',
        title: 'Вам выставили счёт',
        eventName: DomainEventName.InvoiceIssued,
        metadata: {
          orderId: 'order-1',
          invoiceId: 'invoice-1',
          freelancerId: 'freelancer-1',
          href: '/chats?orderId=order-1&freelancerId=freelancer-1',
        },
      }),
    });
  });

  it('уведомление об оплате счёта подтверждает платёж заказчику и ведёт фрилансера в рабочий чат', async () => {
    prisma.invoice.findUnique.mockResolvedValue({ id: 'invoice-1', issuedById: 'freelancer-1' });

    await listener.handleInvoicePaid(
      event(DomainEventName.InvoicePaid, {
        invoiceId: 'invoice-1',
        orderId: 'order-1',
        payerId: 'client-1',
        freelancerId: 'freelancer-1',
        amount: 500,
        currency: 'USD',
      }),
    );

    expect(prisma.notification.create).toHaveBeenNthCalledWith(1, {
      data: expect.objectContaining({
        userId: 'client-1',
        title: 'Оплата подтверждена',
        eventName: DomainEventName.InvoicePaid,
        metadata: {
          orderId: 'order-1',
          invoiceId: 'invoice-1',
          freelancerId: 'freelancer-1',
          href: '/orders/order-1#payment-history',
        },
      }),
    });
    expect(prisma.notification.create).toHaveBeenNthCalledWith(2, {
      data: expect.objectContaining({
        userId: 'freelancer-1',
        title: 'Счёт оплачен',
        eventName: DomainEventName.InvoicePaid,
        metadata: {
          orderId: 'order-1',
          invoiceId: 'invoice-1',
          payerId: 'client-1',
          href: '/chats?orderId=order-1&freelancerId=freelancer-1',
        },
      }),
    });
  });

  it('уведомление об открытом эскроу ведёт исполнителя в историю платежей заказа', async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: 'order-1',
      title: 'Landing page',
      currency: 'USD',
      bids: [{ freelancerId: 'freelancer-1' }],
    });

    await listener.handleEscrowLocked(
      event(DomainEventName.EscrowLocked, {
        orderId: 'order-1',
        walletId: 'wallet-1',
        clientId: 'client-1',
        amount: 500,
      }),
    );

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'freelancer-1',
        title: 'Эскроу открыт',
        eventName: DomainEventName.EscrowLocked,
        metadata: {
          orderId: 'order-1',
          href: '/orders/order-1#payment-history',
        },
      }),
    });
  });

  it('уведомление о выплате эскроу ведёт исполнителя в историю платежей заказа', async () => {
    prisma.order.findUnique.mockResolvedValue({ id: 'order-1', title: 'Landing page', currency: 'USD' });

    await listener.handleEscrowReleased(
      event(DomainEventName.EscrowReleased, {
        orderId: 'order-1',
        walletId: 'wallet-1',
        amount: 455,
        toFreelancerId: 'freelancer-1',
      }),
    );

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'freelancer-1',
        title: 'Эскроу выплачен',
        eventName: DomainEventName.EscrowReleased,
        metadata: {
          orderId: 'order-1',
          href: '/orders/order-1#payment-history',
        },
      }),
    });
  });

  it('уведомление о сдаче работы ведёт заказчика в заказ на проверку результата', async () => {
    prisma.order.findUnique.mockResolvedValue({ id: 'order-1', title: 'Landing page', clientId: 'client-1' });

    await listener.handleWorkSubmitted(
      event(DomainEventName.WorkSubmitted, {
        orderId: 'order-1',
        deliveryId: 'delivery-1',
        submittedById: 'freelancer-1',
        clientId: 'client-1',
      }),
    );

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'client-1',
        title: 'Работа сдана',
        eventName: DomainEventName.WorkSubmitted,
        metadata: {
          orderId: 'order-1',
          deliveryId: 'delivery-1',
          submittedById: 'freelancer-1',
          href: '/orders/order-1',
        },
      }),
    });
  });

  it('уведомление о споре уходит всем участникам кроме инициатора и ведёт в заказ', async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: 'order-1',
      title: 'Landing page',
      clientId: 'client-1',
      bids: [{ freelancerId: 'freelancer-1' }],
    });

    await listener.handleDisputeOpened(
      event(DomainEventName.DisputeOpened, {
        disputeId: 'dispute-1',
        orderId: 'order-1',
        openedById: 'client-1',
        reason: 'Нужна проверка результата',
      }),
    );

    expect(prisma.notification.create).toHaveBeenCalledTimes(1);
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'freelancer-1',
        title: 'Открыт спор',
        eventName: DomainEventName.DisputeOpened,
        metadata: {
          orderId: 'order-1',
          disputeId: 'dispute-1',
          openedById: 'client-1',
          href: '/orders/order-1',
        },
      }),
    });
  });
});
