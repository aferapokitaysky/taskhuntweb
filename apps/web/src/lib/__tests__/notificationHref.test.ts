import { describe, expect, it } from 'vitest';
import { notificationHref } from '../notificationHref';

describe('notificationHref', () => {
  it('использует явный metadata.href как самый точный маршрут', () => {
    expect(
      notificationHref({
        eventName: 'SupportMessageCreated',
        metadata: { ticketId: 'ticket-1', href: '/support?ticketId=ticket-1' },
      }),
    ).toBe('/support?ticketId=ticket-1');
  });

  it('строит ссылку в чат по invoiceId, orderId и freelancerId', () => {
    expect(
      notificationHref({
        eventName: 'InvoiceIssued',
        metadata: { invoiceId: 'invoice-1', orderId: 'order-1', freelancerId: 'freelancer-1' },
      }),
    ).toBe('/chats?orderId=order-1&freelancerId=freelancer-1');
  });

  it('ведёт support-уведомление в конкретный тикет даже без metadata.href', () => {
    expect(
      notificationHref({
        eventName: 'SupportTicketStatusChanged',
        metadata: { ticketId: 'ticket with spaces' },
      }),
    ).toBe('/support?ticketId=ticket%20with%20spaces');
  });

  it('использует заказ как fallback для order-событий', () => {
    expect(
      notificationHref({
        eventName: 'BidSubmitted',
        metadata: { orderId: 'order-1', bidId: 'bid-1' },
      }),
    ).toBe('/orders/order-1');
    expect(
      notificationHref({
        eventName: 'BidAccepted',
        metadata: { orderId: 'order-1', bidId: 'bid-1' },
      }),
    ).toBe('/orders/order-1');
    expect(
      notificationHref({
        eventName: 'BidRejected',
        metadata: { orderId: 'order-1', bidId: 'bid-1' },
      }),
    ).toBe('/orders/order-1');
    expect(
      notificationHref({
        eventName: 'EscrowReleased',
        metadata: { orderId: 'order-1' },
      }),
    ).toBe('/orders/order-1');
  });

  it('возвращает раздел по типу события, если metadata нет', () => {
    expect(notificationHref({ eventName: 'ChatMessageCreated', metadata: null })).toBe('/chats');
    expect(notificationHref({ eventName: 'DisputeOpened' })).toBe('/support');
    expect(notificationHref({ eventName: 'SupportMessageCreated' })).toBe('/support');
    expect(notificationHref({ eventName: 'UnknownEvent' })).toBe('/dashboard');
  });
});
