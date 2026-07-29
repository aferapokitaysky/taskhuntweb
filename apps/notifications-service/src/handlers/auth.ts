import type { EmailVerificationRequestedEvent, PasswordResetRequestedEvent } from '@taskhunt/shared-types';
import type { HandlerContext } from './shared';
import { notifyUser } from './shared';

export function handleEmailVerificationRequested(event: EmailVerificationRequestedEvent, context: HandlerContext) {
  return notifyUser(context, event.payload.userId, {
    eventName: event.name,
    title: 'Подтвердите email на TaskHunt',
    message: 'Осталось совсем немного — подтвердите адрес, и аккаунт станет активным. Ссылка действует 24 часа.',
    actionUrl: event.payload.verificationUrl,
    actionLabel: 'Подтвердить email',
    metadata: { email: event.payload.email },
  });
}

export function handlePasswordResetRequested(event: PasswordResetRequestedEvent, context: HandlerContext) {
  return notifyUser(context, event.payload.userId, {
    eventName: event.name,
    title: 'Сброс пароля на TaskHunt',
    message: 'Запрошен сброс пароля. Ссылка действует 1 час — если это были не вы, просто проигнорируйте письмо.',
    actionUrl: event.payload.resetUrl,
    actionLabel: 'Задать новый пароль',
    metadata: { email: event.payload.email },
  });
}
