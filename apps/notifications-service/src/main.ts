import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { DomainEvent, DomainEventName, EVENT_QUEUE_NAME } from '@taskhunt/shared-types';
import { PrismaClient } from '../generated/prisma-client';
import { ConsoleNotificationSender } from './senders/console-sender';
import type { HandlerContext } from './handlers/shared';
import { handleUserRegistered } from './handlers/user-registered';
import {
  handleBidAccepted,
  handleBidSubmitted,
  handleDisputeOpened,
  handleEscrowLocked,
  handleEscrowReleased,
  handleInvoiceIssued,
  handleInvoicePaid,
  handleOrderCreated,
  handleWorkSubmitted,
} from './handlers/orders';

const connection = new IORedis({
  host: process.env.REDIS_HOST ?? 'localhost',
  port: Number(process.env.REDIS_PORT ?? 6379),
  maxRetriesPerRequest: null,
});

const context: HandlerContext = {
  prisma: new PrismaClient(),
  sender: new ConsoleNotificationSender(),
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
