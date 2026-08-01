import type { WalletDepositPaidEvent } from '@taskhunt/shared-types';
import type { HandlerContext } from './shared';
import { notifyUser } from './shared';

export function handleWalletDepositPaid(event: WalletDepositPaidEvent, context: HandlerContext) {
  return notifyUser(context, event.payload.userId, {
    eventName: event.name,
    title: 'Кошелёк пополнен',
    message: `Баланс пополнен на ${event.payload.amount} ${event.payload.currency}.`,
    metadata: { depositId: event.payload.depositId },
  });
}
