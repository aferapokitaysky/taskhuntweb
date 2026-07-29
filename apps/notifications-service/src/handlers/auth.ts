import type { EmailVerificationRequestedEvent, PasswordResetRequestedEvent } from '@taskhunt/shared-types';
import type { HandlerContext } from './shared';
import { notifyUser } from './shared';

export function handleEmailVerificationRequested(event: EmailVerificationRequestedEvent, context: HandlerContext) {
  return notifyUser(context, event.payload.userId, {
    eventName: event.name,
    title: 'Подтвердите email на TuskHunt',
    message: `Перейдите по ссылке, чтобы подтвердить email: ${event.payload.verificationUrl}\n\nСсылка действует 24 часа.`,
    metadata: { email: event.payload.email },
  });
}

export function handlePasswordResetRequested(event: PasswordResetRequestedEvent, context: HandlerContext) {
  return notifyUser(context, event.payload.userId, {
    eventName: event.name,
    title: 'Сброс пароля на TuskHunt',
    message: `Перейдите по ссылке, чтобы задать новый пароль: ${event.payload.resetUrl}\n\nСсылка действует 1 час. Если вы не запрашивали сброс — проигнорируйте это письмо.`,
    metadata: { email: event.payload.email },
  });
}
