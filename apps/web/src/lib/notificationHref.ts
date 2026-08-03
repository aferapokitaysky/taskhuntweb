export interface NotificationRouteInput {
  eventName: string;
  metadata?: {
    href?: string;
    orderId?: string;
    freelancerId?: string;
    threadId?: string;
    invoiceId?: string;
    bidId?: string;
    disputeId?: string;
    ticketId?: string;
  } | null;
}

export function fallbackNotificationHref(eventName: string) {
  if (eventName.includes('InvoiceIssued') || eventName.includes('ChatMessageCreated')) return '/chats';
  if (eventName.includes('DisputeOpened') || eventName.includes('Support')) return '/support';
  if (eventName.includes('FraudFlagCreated')) return '/admin';
  return '/dashboard';
}

export function notificationHref(notification: NotificationRouteInput) {
  if (notification.metadata?.href) return notification.metadata.href;
  if (notification.metadata?.invoiceId && notification.metadata.orderId) {
    const params = new URLSearchParams({ orderId: notification.metadata.orderId });
    if (notification.metadata.freelancerId) params.set('freelancerId', notification.metadata.freelancerId);
    return `/chats?${params.toString()}`;
  }
  if (notification.metadata?.ticketId) {
    return `/support?ticketId=${encodeURIComponent(notification.metadata.ticketId)}`;
  }
  if (notification.metadata?.orderId) return `/orders/${notification.metadata.orderId}`;
  return fallbackNotificationHref(notification.eventName);
}
