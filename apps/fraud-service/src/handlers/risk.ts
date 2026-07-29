import type IORedis from 'ioredis';
import type {
  BidAcceptedEvent,
  BidSubmittedEvent,
  DisputeOpenedEvent,
  EscrowLockedEvent,
  EscrowReleasedEvent,
  InvoiceIssuedEvent,
  InvoicePaidEvent,
  OrderCreatedEvent,
  UserRegisteredEvent,
  WorkSubmittedEvent,
} from '@taskhunt/shared-types';
import type { PrismaClient } from '../../generated/prisma-client';
import { checkVelocity } from '../lib/velocity';
import { severityFromScore, type FraudFlagPayload } from '../lib/report';

const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_S = 60;
const HOUR_S = 60 * 60;

function toFlag(partial: { eventName: string; userId?: string; orderId?: string; riskScore: number; reasons: string[] }): FraudFlagPayload {
  const riskScore = Math.min(100, Math.max(0, partial.riskScore));
  return { ...partial, riskScore, severity: severityFromScore(riskScore) };
}

export async function scoreOrderCreated(prisma: PrismaClient, event: OrderCreatedEvent): Promise<FraudFlagPayload> {
  const order = await prisma.order.findUnique({
    where: { id: event.payload.orderId },
    include: { client: { include: { profile: true } }, disputes: true },
  });

  const reasons: string[] = [];
  let riskScore = 0;
  const budgetMin = order ? Number(order.budgetMin) : event.payload.budgetMin;
  const client = order?.client;

  if (budgetMin < 20) {
    riskScore += 30;
    reasons.push('budget_min_below_20');
  }
  if (client && Date.now() - client.createdAt.getTime() < DAY_MS) {
    riskScore += 20;
    reasons.push('client_account_younger_than_24h');
  }
  if ((client?.profile?.disputesCount ?? 0) > 2) {
    riskScore += 25;
    reasons.push('client_has_many_profile_disputes');
  }
  if ((order?.disputes.length ?? 0) > 0) {
    riskScore += 20;
    reasons.push('order_already_has_disputes');
  }
  if (event.payload.budgetMax !== null && event.payload.budgetMax > 0 && event.payload.budgetMax / Math.max(budgetMin, 1) > 20) {
    riskScore += 10;
    reasons.push('wide_budget_range');
  }

  return toFlag({ eventName: event.name, userId: client?.id, orderId: event.payload.orderId, riskScore, reasons });
}

export async function scoreUserRegistered(redis: IORedis, event: UserRegisteredEvent): Promise<FraudFlagPayload | null> {
  if (!event.payload.ip) return null; // OAuth-регистрация — IP не передаётся, нечего проверять

  const count = await checkVelocity(redis, `register-ip:${event.payload.ip}`, HOUR_S);
  if (count <= 2) return null; // 1-2 регистрации с одного IP в час — нормально (семья, офис, NAT)

  return toFlag({
    eventName: event.name,
    userId: event.payload.userId,
    riskScore: Math.min(80, 30 + count * 10),
    reasons: [`registrations_from_same_ip_last_hour:${count}`],
  });
}

export async function scoreBidSubmitted(prisma: PrismaClient, redis: IORedis, event: BidSubmittedEvent): Promise<FraudFlagPayload | null> {
  const reasons: string[] = [];
  let riskScore = 0;

  const count = await checkVelocity(redis, `bid-submit:${event.payload.freelancerId}`, 10 * MINUTE_S);
  if (count > 5) {
    riskScore += 25;
    reasons.push(`bid_spam_velocity:${count}_in_10min`);
  }

  if (event.payload.amount < 20) {
    riskScore += 10;
    reasons.push('bid_amount_below_20');
  }

  if (riskScore === 0) return null;

  const bid = await prisma.bid.findUnique({ where: { id: event.payload.bidId } });
  return toFlag({ eventName: event.name, userId: event.payload.freelancerId, orderId: bid?.orderId, riskScore, reasons });
}

export async function scoreBidAccepted(prisma: PrismaClient, event: BidAcceptedEvent): Promise<FraudFlagPayload> {
  const bid = await prisma.bid.findUnique({
    where: { id: event.payload.bidId },
    include: { freelancer: { include: { profile: true } }, order: true },
  });

  const reasons: string[] = [];
  let riskScore = 0;

  if (event.payload.amount < 20) {
    riskScore += 25;
    reasons.push('accepted_bid_below_20');
  }
  if (bid && Number(bid.amount) < Number(bid.order.budgetMin) * 0.5) {
    riskScore += 20;
    reasons.push('accepted_bid_far_below_budget');
  }
  if (bid && Date.now() - bid.freelancer.createdAt.getTime() < DAY_MS) {
    riskScore += 15;
    reasons.push('freelancer_account_younger_than_24h');
  }
  if ((bid?.freelancer.profile?.lateDeliveries ?? 0) > 3) {
    riskScore += 15;
    reasons.push('freelancer_has_many_late_deliveries');
  }

  return toFlag({ eventName: event.name, userId: event.payload.freelancerId, orderId: event.payload.orderId, riskScore, reasons });
}

export async function scoreInvoiceIssued(prisma: PrismaClient, redis: IORedis, event: InvoiceIssuedEvent): Promise<FraudFlagPayload | null> {
  const reasons: string[] = [];
  let riskScore = 0;

  const count = await checkVelocity(redis, `invoice-issue:${event.payload.orderId}`, HOUR_S);
  if (count > 3) {
    riskScore += 20;
    reasons.push(`repeated_invoices_for_order:${count}_in_1h`);
  }

  const order = await prisma.order.findUnique({ where: { id: event.payload.orderId } });
  if (order) {
    const budgetAnchor = order.budgetMax != null ? Number(order.budgetMax) : Number(order.budgetMin);
    if (event.payload.amount > budgetAnchor * 3) {
      riskScore += 20;
      reasons.push('invoice_far_exceeds_order_budget');
    }
  }

  if (riskScore === 0) return null;
  return toFlag({ eventName: event.name, orderId: event.payload.orderId, riskScore, reasons });
}

export async function scoreInvoicePaid(_prisma: PrismaClient, event: InvoicePaidEvent): Promise<FraudFlagPayload | null> {
  // Крупный единовременный платёж — не блокирующий сигнал сам по себе (это
  // и есть нормальный юзкейс маркетплейса), но стоит показать staff для
  // информации при разборе других флагов по этому же заказу/клиенту.
  if (event.payload.amount < 2000) return null;
  return toFlag({
    eventName: event.name,
    userId: event.payload.payerId,
    orderId: event.payload.orderId,
    riskScore: 15,
    reasons: [`large_single_payment:$${event.payload.amount}`],
  });
}

export async function scoreEscrowLocked(prisma: PrismaClient, event: EscrowLockedEvent): Promise<FraudFlagPayload | null> {
  const client = await prisma.user.findUnique({ where: { id: event.payload.clientId } });
  if (!client) return null;

  const isNewAccount = Date.now() - client.createdAt.getTime() < 7 * DAY_MS;
  if (!isNewAccount) return null;

  const pastInvoices = await prisma.order.findMany({
    where: { clientId: event.payload.clientId, status: { not: 'DRAFT' } },
    select: { budgetMin: true },
  });
  const avgPast = pastInvoices.length > 1 ? pastInvoices.reduce((s, o) => s + Number(o.budgetMin), 0) / pastInvoices.length : null;

  if (avgPast === null || event.payload.amount < avgPast * 5) return null;

  return toFlag({
    eventName: event.name,
    userId: event.payload.clientId,
    orderId: event.payload.orderId,
    riskScore: 35,
    reasons: ['unusually_large_escrow_for_new_account'],
  });
}

export async function scoreEscrowReleased(redis: IORedis, event: EscrowReleasedEvent): Promise<FraudFlagPayload | null> {
  const count = await checkVelocity(redis, `escrow-release:${event.payload.toFreelancerId}`, HOUR_S);
  if (count <= 2) return null;

  return toFlag({
    eventName: event.name,
    userId: event.payload.toFreelancerId,
    orderId: event.payload.orderId,
    riskScore: Math.min(70, 20 + count * 10),
    reasons: [`rapid_escrow_release_velocity:${count}_in_1h`],
  });
}

export async function scoreWorkSubmitted(prisma: PrismaClient, event: WorkSubmittedEvent): Promise<FraudFlagPayload | null> {
  const order = await prisma.order.findUnique({
    where: { id: event.payload.orderId },
    include: { bids: { where: { status: 'ACCEPTED' } } },
  });
  const acceptedBid = order?.bids[0];
  if (!acceptedBid || !order) return null;

  const orderAge = Date.now() - order.createdAt.getTime();
  if (orderAge > 60 * 60 * 1000) return null; // сдано не в первый час после публикации — не подозрительно само по себе

  return toFlag({
    eventName: event.name,
    userId: event.payload.submittedById,
    orderId: event.payload.orderId,
    riskScore: 20,
    reasons: ['work_delivered_unusually_fast_after_order_created'],
  });
}

export async function scoreDisputeOpened(prisma: PrismaClient, redis: IORedis, event: DisputeOpenedEvent): Promise<FraudFlagPayload> {
  const order = await prisma.order.findUnique({
    where: { id: event.payload.orderId },
    include: { client: { include: { profile: true } }, disputes: true },
  });

  const reasons = ['dispute_opened'];
  let riskScore = 40;

  if ((order?.disputes.length ?? 0) > 1) {
    riskScore += 20;
    reasons.push('multiple_disputes_for_order');
  }
  if ((order?.client.profile?.disputesCount ?? 0) > 2) {
    riskScore += 20;
    reasons.push('client_has_many_profile_disputes');
  }

  const count = await checkVelocity(redis, `dispute-open:${event.payload.openedById}`, 30 * 24 * HOUR_S);
  if (count > 2) {
    riskScore += 25;
    reasons.push(`serial_dispute_opener:${count}_in_30d`);
  }

  return toFlag({ eventName: event.name, userId: event.payload.openedById, orderId: event.payload.orderId, riskScore, reasons });
}
