import type { DomainEventName } from '@taskhunt/shared-types';
import type { PrismaClient as GeneratedPrismaClient } from '../../generated/prisma-client';
import type { NotificationChannel, NotificationPayload, NotificationSender } from '../senders/console-sender';

interface OrderReadDelegate {
  findUnique(args: {
    where: { id: string };
    select: { clientId: true; title: true };
  }): Promise<{ clientId: string; title: string } | null>;
}

export interface HandlerContext {
  prisma: GeneratedPrismaClient & { order: OrderReadDelegate };
  sender: NotificationSender;
}

const DEFAULT_CHANNEL: NotificationChannel = 'EMAIL';

export async function notifyUser(
  context: HandlerContext,
  userId: string,
  payload: NotificationPayload & { eventName: DomainEventName },
  channel: NotificationChannel = DEFAULT_CHANNEL,
) {
  const preference = await context.prisma.notificationPreference.findUnique({
    where: { userId_channel: { userId, channel } },
  });

  if (preference && !preference.enabled) {
    console.log('[NOTIFY_SKIP]', payload.eventName, JSON.stringify({ userId, channel, reason: 'channel_disabled' }));
    return;
  }

  await context.sender.send(userId, channel, payload);
}
