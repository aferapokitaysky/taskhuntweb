import { Resend } from 'resend';
import type {
  NotificationChannel,
  NotificationPayload,
  NotificationSender,
} from './console-sender';
import type { PrismaClient } from '../../generated/prisma-client';
import { renderEmailHtml } from '../email-template';

export class EmailNotificationSender implements NotificationSender {
  private readonly resend: Resend;

  constructor(
    private readonly prisma: PrismaClient,
    apiKey: string,
    private readonly fromAddress: string,
  ) {
    this.resend = new Resend(apiKey);
  }

  async send(
    userId: string,
    channel: NotificationChannel,
    payload: NotificationPayload,
  ): Promise<void> {
    if (channel !== 'EMAIL') return;

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.email) {
      console.warn(`[NOTIFY_EMAIL] User ${userId} not found or has no email`);
      return;
    }

    try {
      await this.resend.emails.send({
        from: this.fromAddress,
        to: user.email,
        subject: payload.title,
        text: payload.actionUrl ? `${payload.message}\n\n${payload.actionLabel ?? 'Ссылка'}: ${payload.actionUrl}` : payload.message,
        html: renderEmailHtml({
          title: payload.title,
          message: payload.message,
          actionUrl: payload.actionUrl,
          actionLabel: payload.actionLabel,
        }),
      });
      console.log(`[NOTIFY_EMAIL] Sent email to ${user.email} (${payload.eventName})`);
    } catch (err) {
      console.error(
        `[NOTIFY_EMAIL] Failed to send email to ${user.email}:`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }
}
