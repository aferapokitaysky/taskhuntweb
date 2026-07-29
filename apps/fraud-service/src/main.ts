import { createServer } from 'http';
import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { DomainEvent, DomainEventName, EVENT_QUEUE_NAME } from '@taskhunt/shared-types';
import { PrismaClient } from '../generated/prisma-client';
import {
  scoreBidAccepted,
  scoreBidSubmitted,
  scoreDisputeOpened,
  scoreEscrowLocked,
  scoreEscrowReleased,
  scoreInvoiceIssued,
  scoreInvoicePaid,
  scoreOrderCreated,
  scoreUserRegistered,
  scoreWorkSubmitted,
} from './handlers/risk';
import { reportFlag } from './lib/report';

const prisma = new PrismaClient();
const connection = new IORedis({
  host: process.env.REDIS_HOST ?? 'localhost',
  port: Number(process.env.REDIS_PORT ?? 6379),
  maxRetriesPerRequest: null,
});

/**
 * Не все 13 типов доменных событий фрод-релевантны: EmailVerificationRequested,
 * PasswordResetRequested и SubscriptionExpiringSoon существуют только как
 * триггеры для notifications-service, скоринг для них осознанно не пишем.
 */
async function route(event: DomainEvent) {
  switch (event.name) {
    case DomainEventName.UserRegistered:
      return reportFlag(await scoreUserRegistered(connection, event));
    case DomainEventName.OrderCreated:
      return reportFlag(await scoreOrderCreated(prisma, event));
    case DomainEventName.BidSubmitted:
      return reportFlag(await scoreBidSubmitted(prisma, connection, event));
    case DomainEventName.BidAccepted:
      return reportFlag(await scoreBidAccepted(prisma, event));
    case DomainEventName.InvoiceIssued:
      return reportFlag(await scoreInvoiceIssued(prisma, connection, event));
    case DomainEventName.InvoicePaid:
      return reportFlag(await scoreInvoicePaid(prisma, event));
    case DomainEventName.EscrowLocked:
      return reportFlag(await scoreEscrowLocked(prisma, event));
    case DomainEventName.EscrowReleased:
      return reportFlag(await scoreEscrowReleased(connection, event));
    case DomainEventName.WorkSubmitted:
      return reportFlag(await scoreWorkSubmitted(prisma, event));
    case DomainEventName.DisputeOpened:
      return reportFlag(await scoreDisputeOpened(prisma, connection, event));
    default:
      return undefined;
  }
}

const worker = new Worker<DomainEvent>(
  EVENT_QUEUE_NAME,
  async (job) => {
    await route(job.data);
  },
  { connection },
);

const server = createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ message: 'Not found' }));
});

const port = Number(process.env.PORT ?? 3002);
server.listen(port, () => console.log(`[FRAUD_HTTP] listening on :${port}`));
worker.on('ready', () => console.log('[FRAUD_WORKER] ready'));
worker.on('failed', (job, error) => {
  console.error('[FRAUD_WORKER] failed', JSON.stringify({ jobId: job?.id, error: error.message }));
});

process.on('SIGTERM', async () => {
  server.close();
  await worker.close();
  await prisma.$disconnect();
  await connection.quit();
});
