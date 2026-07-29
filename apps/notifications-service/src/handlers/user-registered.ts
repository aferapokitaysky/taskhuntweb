import type { UserRegisteredEvent } from '@taskhunt/shared-types';
import type { HandlerContext } from './shared';
import { notifyUser } from './shared';

export function handleUserRegistered(event: UserRegisteredEvent, context: HandlerContext) {
  return notifyUser(context, event.payload.userId, {
    eventName: event.name,
    title: 'Добро пожаловать в TaskHunt',
    message: `Аккаунт ${event.payload.email} зарегистрирован как ${event.payload.role}.`,
    metadata: { email: event.payload.email, role: event.payload.role },
  });
}
