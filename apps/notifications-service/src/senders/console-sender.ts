import type { DomainEventName } from '@taskhunt/shared-types';

export type NotificationChannel = 'EMAIL' | 'PUSH' | 'TELEGRAM' | 'IN_APP' | 'SMS';

export interface NotificationPayload {
  eventName: DomainEventName;
  title: string;
  message: string;
  metadata?: Record<string, string | number | null>;
  actionUrl?: string;
  actionLabel?: string;
}

export interface NotificationSender {
  send(userId: string, channel: NotificationChannel, payload: NotificationPayload): Promise<void>;
}

export class ConsoleNotificationSender implements NotificationSender {
  async send(userId: string, channel: NotificationChannel, payload: NotificationPayload): Promise<void> {
    console.log(
      '[NOTIFY]',
      payload.eventName,
      JSON.stringify({
        userId,
        channel,
        title: payload.title,
        message: payload.message,
        metadata: payload.metadata ?? {},
      }),
    );
  }
}
