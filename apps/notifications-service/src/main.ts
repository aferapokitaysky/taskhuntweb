import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { DomainEvent, DomainEventName, EVENT_QUEUE_NAME } from '@taskhunt/shared-types';
import { PrismaClient } from '../generated/prisma-client';
import { ConsoleNotificationSender, NotificationSender } from './senders/console-sender';
import { EmailNotificationSender } from './senders/email-sender';
import type { HandlerContext } from './handlers/shared';
import { handleUserRegistered } from './handlers/user-registered';
import { handleEmailVerificationRequested, handlePasswordResetRequested } from './handlers/auth';
import {
  handleBidAccepted,
  handleBidSubmitted,
  handleDisputeOpened,
  handleEscrowLocked,
  handleEscrowReleased,
  handleInvoiceIssued,
  handleInvoicePaid,
  handleOrderCreated,
  handleOrderInviteCreated,
  handleWorkSubmitted,
} from './handlers/orders';

const connection = new IORedis({
  host: process.env.REDIS_HOST ?? 'localhost',
  port: Number(process.env.REDIS_PORT ?? 6379),
  maxRetriesPerRequest: null,
});

const prisma = new PrismaClient();
const resendApiKey = process.env.RESEND_API_KEY;
const resendFrom = process.env.RESEND_FROM_ADDRESS ?? 'noreply@taskhunt.io';

let sender: NotificationSender;
if (resendApiKey) {
  console.log('[NOTIFY_WORKER] Initializing Resend EmailNotificationSender');
  sender = new EmailNotificationSender(prisma, resendApiKey, resendFrom);
} else {
  console.log('[NOTIFY_WORKER] RESEND_API_KEY missing — falling back to ConsoleNotificationSender');
  sender = new ConsoleNotificationSender();
}

const context: HandlerContext = {
  prisma,
  sender,
};

async function route(event: DomainEvent) {
  switch (event.name) {
    case DomainEventName.UserRegistered:
      return handleUserRegistered(event, context);
    case DomainEventName.OrderCreated:
      return handleOrderCreated(event, context);
    case DomainEventName.BidSubmitted:
      return handleBidSubmitted(event, context);
    case DomainEventName.BidAccepted:
      return handleBidAccepted(event, context);
    case DomainEventName.InvoiceIssued:
      return handleInvoiceIssued(event, context);
    case DomainEventName.InvoicePaid:
      return handleInvoicePaid(event, context);
    case DomainEventName.EscrowLocked:
      return handleEscrowLocked(event, context);
    case DomainEventName.EscrowReleased:
      return handleEscrowReleased(event, context);
    case DomainEventName.WorkSubmitted:
      return handleWorkSubmitted(event, context);
    case DomainEventName.DisputeOpened:
      return handleDisputeOpened(event, context);
    case DomainEventName.OrderInviteCreated:
      return handleOrderInviteCreated(event, context);
    case DomainEventName.EmailVerificationRequested:
      return handleEmailVerificationRequested(event, context);
    case DomainEventName.PasswordResetRequested:
      return handlePasswordResetRequested(event, context);
  }
}

const worker = new Worker<DomainEvent>(
  EVENT_QUEUE_NAME,
  async (job) => {
    await route(job.data);
  },
  { connection },
);

worker.on('ready', () => console.log('[NOTIFY_WORKER] ready'));
worker.on('failed', (job, error) => {
  console.error('[NOTIFY_WORKER] failed', JSON.stringify({ jobId: job?.id, error: error.message }));
});

process.on('SIGTERM', async () => {
  await worker.close();
  await context.prisma.$disconnect();
  await connection.quit();
});
