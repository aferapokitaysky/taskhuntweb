import type { BidAcceptedEvent, DisputeOpenedEvent, OrderCreatedEvent } from '@taskhunt/shared-types';
import type { PrismaClient } from '../../generated/prisma-client';

export interface RiskResult {
  orderId: string;
  riskScore: number;
  reasons: string[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

export async function scoreOrderCreated(prisma: PrismaClient, event: OrderCreatedEvent): Promise<RiskResult> {
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

  return { orderId: event.payload.orderId, riskScore: Math.min(riskScore, 100), reasons };
}

export async function scoreBidAccepted(prisma: PrismaClient, event: BidAcceptedEvent): Promise<RiskResult> {
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

  return { orderId: event.payload.orderId, riskScore: Math.min(riskScore, 100), reasons };
}

export async function scoreDisputeOpened(prisma: PrismaClient, event: DisputeOpenedEvent): Promise<RiskResult> {
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

  return { orderId: event.payload.orderId, riskScore: Math.min(riskScore, 100), reasons };
}

export async function saveRisk(prisma: PrismaClient, result: RiskResult) {
  await prisma.fraudSignal.upsert({
    where: { orderId: result.orderId },
    update: { riskScore: result.riskScore, reasons: result.reasons },
    create: result,
  });
  console.log('[FRAUD_SIGNAL]', JSON.stringify(result));
}
