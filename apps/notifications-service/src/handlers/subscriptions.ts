import type { SubscriptionExpiringSoonEvent } from '@taskhunt/shared-types';
import type { HandlerContext } from './shared';
import { notifyUser } from './shared';

// Событие публиковалось (SubscriptionExpirationProcessor), но раньше не
// имело ни одного обработчика ни здесь, ни в in-app-листенере API —
// платящий пользователь узнавал об истечении подписки только постфактум.
export function handleSubscriptionExpiringSoon(event: SubscriptionExpiringSoonEvent, context: HandlerContext) {
  const expiresDate = new Date(event.payload.expiresAt).toLocaleDateString('ru-RU');
  return notifyUser(context, event.payload.userId, {
    eventName: event.name,
    title: 'Подписка скоро истечёт',
    message: `Тариф "${event.payload.tierName}" истекает ${expiresDate}. Продлите, чтобы не потерять преимущества.`,
    metadata: { tierName: event.payload.tierName, expiresAt: event.payload.expiresAt },
  });
}
