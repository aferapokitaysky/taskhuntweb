import { createServer } from 'http';
import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { DomainEvent, DomainEventName, EVENT_QUEUE_NAME } from '@taskhunt/shared-types';
import { PrismaClient } from '../generated/prisma-client';
import { saveRisk, scoreBidAccepted, scoreDisputeOpened, scoreOrderCreated } from './handlers/risk';

const prisma = new PrismaClient();
const connection = new IORedis({
  host: process.env.REDIS_HOST ?? 'localhost',
  port: Number(process.env.REDIS_PORT ?? 6379),
  maxRetriesPerRequest: null,
});

async function route(event: DomainEvent) {
  switch (event.name) {
    case DomainEventName.OrderCreated:
      return saveRisk(prisma, await scoreOrderCreated(prisma, event));
    case DomainEventName.BidAccepted:
      return saveRisk(prisma, await scoreBidAccepted(prisma, event));
    case DomainEventName.DisputeOpened:
      return saveRisk(prisma, await scoreDisputeOpened(prisma, event));
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

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  const match = url.pathname.match(/^\/fraud-signals\/([^/]+)$/);

  if (req.method !== 'GET' || !match) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'Not found' }));
    return;
  }

  const signal = await prisma.fraudSignal.findUnique({ where: { orderId: decodeURIComponent(match[1]) } });
  if (!signal) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'Fraud signal not found' }));
    return;
  }

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(signal));
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
