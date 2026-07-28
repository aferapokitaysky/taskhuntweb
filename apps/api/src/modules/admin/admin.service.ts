import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
  ) {}

  // --- Пользователи ---

  async banUser(userId: string) {
    return this.prisma.user.update({ where: { id: userId }, data: { status: 'BANNED' } });
  }

  async suspendUser(userId: string) {
    return this.prisma.user.update({ where: { id: userId }, data: { status: 'SUSPENDED' } });
  }

  async listUsers(status?: string) {
    return this.prisma.user.findMany({
      where: status ? { status: status as any } : undefined,
      include: { profile: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  // --- Споры ---

  async listDisputes(status?: string) {
    return this.prisma.dispute.findMany({
      where: status ? { status: status as any } : undefined,
      include: { order: true, openedBy: { include: { profile: true } }, assignedTo: { include: { profile: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async assignDispute(disputeId: string, arbitratorId: string) {
    return this.prisma.dispute.update({
      where: { id: disputeId },
      data: { assignedToId: arbitratorId, status: 'UNDER_REVIEW' },
    });
  }

  async resolveDispute(disputeId: string, staffId: string, dto: ResolveDisputeDto) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
      include: { order: { include: { client: { include: { wallet: true } } } } },
    });
    if (!dispute) throw new NotFoundException('Dispute not found');

    const acceptedBid = await this.prisma.bid.findFirst({
      where: { orderId: dispute.orderId, status: 'ACCEPTED' },
      include: { freelancer: { include: { wallet: true } } },
    });
    const paidInvoice = await this.prisma.invoice.findFirst({
      where: { orderId: dispute.orderId, status: 'PAID' },
      orderBy: { paidAt: 'desc' },
    });

    if (!paidInvoice || !dispute.order.client.wallet) {
      throw new BadRequestException('No escrowed funds found for this order');
    }

    if (dto.resolution === 'RESOLVED_FREELANCER') {
      if (!acceptedBid?.freelancer.wallet) throw new BadRequestException('Freelancer wallet missing');
      await this.walletService.releaseEscrow({
        clientWalletId: dispute.order.client.wallet.id,
        freelancerWalletId: acceptedBid.freelancer.wallet.id,
        amount: Number(paidInvoice.amount),
        invoiceId: paidInvoice.id,
        orderId: dispute.orderId,
        freelancerId: acceptedBid.freelancerId,
      });
    } else {
      await this.walletService.refundEscrow({
        clientWalletId: dispute.order.client.wallet.id,
        amount: Number(paidInvoice.amount),
        invoiceId: paidInvoice.id,
      });
    }

    return this.prisma.dispute.update({
      where: { id: disputeId },
      data: {
        status: dto.resolution,
        resolutionNotes: dto.notes,
        resolvedAt: new Date(),
      },
    });
  }

  // --- Feature flags ---

  async listFeatureFlags() {
    return this.prisma.featureFlag.findMany();
  }

  async toggleFeatureFlag(key: string, enabled: boolean) {
    return this.prisma.featureFlag.update({ where: { key }, data: { enabled } });
  }

  // --- Commission rules ---

  async listCommissionRules() {
    return this.prisma.commissionRule.findMany();
  }

  async updateCommissionRule(type: string, percentage?: number, fixedAmount?: number) {
    return this.prisma.commissionRule.update({
      where: { type: type as any },
      data: { percentage, fixedAmount },
    });
  }

  // --- Categories CRUD ---

  async createCategory(data: { name: string; slug: string; description?: string }) {
    return this.prisma.category.create({ data });
  }

  async updateCategory(id: string, data: { name?: string; slug?: string; description?: string }) {
    return this.prisma.category.update({ where: { id }, data });
  }

  async deleteCategory(id: string) {
    return this.prisma.category.delete({ where: { id } });
  }

  // --- Skills CRUD ---

  async createSkill(data: { name: string; slug: string; categoryId?: string }) {
    return this.prisma.skill.create({ data });
  }

  async updateSkill(id: string, data: { name?: string; slug?: string; categoryId?: string }) {
    return this.prisma.skill.update({ where: { id }, data });
  }

  async deleteSkill(id: string) {
    return this.prisma.skill.delete({ where: { id } });
  }

  // --- Metrics ---

  async getMetrics() {
    const systemWalletId = await this.walletService.getSystemWalletId();
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const totalRevenueAgg = await this.prisma.ledgerEntry.aggregate({
      where: {
        walletId: systemWalletId,
        direction: 'CREDIT',
      },
      _sum: { amount: true },
    });

    const monthRevenueAgg = await this.prisma.ledgerEntry.aggregate({
      where: {
        walletId: systemWalletId,
        direction: 'CREDIT',
        createdAt: { gte: startOfMonth },
      },
      _sum: { amount: true },
    });

    const activeDisputes = await this.prisma.dispute.count({
      where: { status: { in: ['OPEN', 'UNDER_REVIEW'] } },
    });

    const ordersGrouped = await this.prisma.order.groupBy({
      by: ['status'],
      _count: { id: true },
    });
    const ordersByStatus: Record<string, number> = {
      DRAFT: 0,
      OPEN: 0,
      IN_PROGRESS: 0,
      IN_REVIEW: 0,
      COMPLETED: 0,
      CANCELLED: 0,
      DISPUTED: 0,
    };
    for (const g of ordersGrouped) {
      ordersByStatus[g.status] = g._count.id;
    }

    const newUsersThisWeek = await this.prisma.user.count({
      where: { createdAt: { gte: sevenDaysAgo } },
    });

    const activeSubs = await this.prisma.subscription.findMany({
      where: { status: 'ACTIVE', expiresAt: { gt: now } },
      include: { tier: true },
    });

    const activeSubscriptionsByTier: Record<string, number> = {
      STARTER: 0,
      PRO: 0,
      PREMIUM: 0,
    };

    for (const sub of activeSubs) {
      if (sub.tier?.name) {
        activeSubscriptionsByTier[sub.tier.name] = (activeSubscriptionsByTier[sub.tier.name] || 0) + 1;
      }
    }

    const totalUsers = await this.prisma.user.count();
    const activeSubUsersCount = activeSubs.length;
    activeSubscriptionsByTier.STARTER = Math.max(0, totalUsers - activeSubUsersCount);

    return {
      revenue: {
        total: Number(totalRevenueAgg._sum.amount ?? 0),
        thisMonth: Number(monthRevenueAgg._sum.amount ?? 0),
      },
      activeDisputes,
      ordersByStatus,
      newUsersThisWeek,
      activeSubscriptionsByTier,
    };
  }
}
