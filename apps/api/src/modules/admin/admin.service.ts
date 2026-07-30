import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';
import { sanitizeUser } from '../../common/utils/sanitize-user';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
  ) {}

  // --- Пользователи ---

  async banUser(userId: string) {
    const user = await this.prisma.user.update({ where: { id: userId }, data: { status: 'BANNED' } });
    return sanitizeUser(user);
  }

  async suspendUser(userId: string) {
    const user = await this.prisma.user.update({ where: { id: userId }, data: { status: 'SUSPENDED' } });
    return sanitizeUser(user);
  }

  async listUsers(status?: string) {
    const users = await this.prisma.user.findMany({
      where: status ? { status: status as any } : undefined,
      include: { profile: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return users.map(sanitizeUser);
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
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

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

    const totalGmvAgg = await this.prisma.invoice.aggregate({
      where: { status: 'PAID' },
      _sum: { amount: true },
    });

    const monthGmvAgg = await this.prisma.invoice.aggregate({
      where: { status: 'PAID', paidAt: { gte: startOfMonth } },
      _sum: { amount: true },
    });

    const avgOrderAgg = await this.prisma.invoice.aggregate({
      where: { status: 'PAID' },
      _avg: { amount: true },
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

    const acceptedBids90Days = await this.prisma.bid.findMany({
      where: { status: 'ACCEPTED', createdAt: { gte: ninetyDaysAgo } },
      include: { order: true },
    });
    let avgTimeToHireHours: number | null = null;
    if (acceptedBids90Days.length > 0) {
      const totalHours = acceptedBids90Days.reduce((acc, b) => {
        const diffMs = Math.max(0, b.createdAt.getTime() - b.order.createdAt.getTime());
        return acc + diffMs / (1000 * 60 * 60);
      }, 0);
      avgTimeToHireHours = Math.round((totalHours / acceptedBids90Days.length) * 100) / 100;
    }

    const resolvedDisputes = await this.prisma.dispute.findMany({
      where: { status: { in: ['RESOLVED_CLIENT', 'RESOLVED_FREELANCER', 'RESOLVED_SPLIT'] } },
    });
    let avgDisputeResolutionHours: number | null = null;
    if (resolvedDisputes.length > 0) {
      const totalHours = resolvedDisputes.reduce((acc, d) => {
        const endTime = d.resolvedAt ? d.resolvedAt.getTime() : now.getTime();
        const diffMs = Math.max(0, endTime - d.createdAt.getTime());
        return acc + diffMs / (1000 * 60 * 60);
      }, 0);
      avgDisputeResolutionHours = Math.round((totalHours / resolvedDisputes.length) * 100) / 100;
    }

    const expiredRecently = await this.prisma.subscription.count({
      where: {
        status: 'EXPIRED',
        expiresAt: { gte: thirtyDaysAgo },
      },
    });
    const totalPaidSubs30DaysAgo = await this.prisma.subscription.count({
      where: {
        startedAt: { lte: thirtyDaysAgo },
      },
    });
    const subscriptionChurnRate =
      totalPaidSubs30DaysAgo > 0 ? Math.round((expiredRecently / totalPaidSubs30DaysAgo) * 10000) / 100 : 0;

    return {
      revenue: {
        total: Number(totalRevenueAgg._sum.amount ?? 0),
        thisMonth: Number(monthRevenueAgg._sum.amount ?? 0),
      },
      gmv: {
        total: Number(totalGmvAgg._sum.amount ?? 0),
        thisMonth: Number(monthGmvAgg._sum.amount ?? 0),
      },
      avgOrderValue: Number(avgOrderAgg._avg.amount ?? 0),
      avgTimeToHireHours,
      avgDisputeResolutionHours,
      subscriptionChurnRate,
      activeDisputes,
      ordersByStatus,
      newUsersThisWeek,
      activeSubscriptionsByTier,
    };
  }

  async getRevenueTimeseries(days = 30) {
    const validDays = Math.min(Math.max(Number(days) || 30, 1), 365);
    const now = new Date();
    const systemWalletId = await this.walletService.getSystemWalletId();
    const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - validDays + 1);

    const [entries, paidInvoices, users, orders] = await Promise.all([
      this.prisma.ledgerEntry.findMany({
        where: { walletId: systemWalletId, direction: 'CREDIT', createdAt: { gte: startDate } },
      }),
      this.prisma.invoice.findMany({
        where: { status: 'PAID', createdAt: { gte: startDate } },
      }),
      this.prisma.user.findMany({
        where: { createdAt: { gte: startDate } },
        select: { createdAt: true },
      }),
      this.prisma.order.findMany({
        where: { createdAt: { gte: startDate } },
        select: { createdAt: true },
      }),
    ]);

    const resultMap = new Map<string, { date: string; revenue: number; gmv: number; newUsers: number; newOrders: number }>();

    for (let i = 0; i < validDays; i++) {
      const d = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      resultMap.set(dateStr, { date: dateStr, revenue: 0, gmv: 0, newUsers: 0, newOrders: 0 });
    }

    for (const e of entries) {
      const dateStr = e.createdAt.toISOString().split('T')[0];
      const item = resultMap.get(dateStr);
      if (item) item.revenue += Number(e.amount);
    }

    for (const inv of paidInvoices) {
      const dateStr = (inv.paidAt ?? inv.createdAt).toISOString().split('T')[0];
      const item = resultMap.get(dateStr);
      if (item) item.gmv += Number(inv.amount);
    }

    for (const u of users) {
      const dateStr = u.createdAt.toISOString().split('T')[0];
      const item = resultMap.get(dateStr);
      if (item) item.newUsers += 1;
    }

    for (const o of orders) {
      const dateStr = o.createdAt.toISOString().split('T')[0];
      const item = resultMap.get(dateStr);
      if (item) item.newOrders += 1;
    }

    return Array.from(resultMap.values()).map((r) => ({
      date: r.date,
      revenue: Math.round(r.revenue * 100) / 100,
      gmv: Math.round(r.gmv * 100) / 100,
      newUsers: r.newUsers,
      newOrders: r.newOrders,
    }));
  }

  async getFunnel(days = 30) {
    const validDays = Math.min(Math.max(Number(days) || 30, 1), 365);
    const now = new Date();
    const startDate = new Date(now.getTime() - validDays * 24 * 60 * 60 * 1000);

    const cohortUsers = await this.prisma.user.findMany({
      where: { createdAt: { gte: startDate } },
      select: { id: true },
    });
    const registered = cohortUsers.length;
    if (registered === 0) {
      return { registered: 0, onboarded: 0, postedOrRespondedFirst: 0, paidOrEarnedFirst: 0 };
    }

    const userIds = cohortUsers.map((u) => u.id);

    const onboardedCount = await this.prisma.profile.count({
      where: { userId: { in: userIds } },
    });

    const [clientsWithOrders, freelancersWithBids] = await Promise.all([
      this.prisma.order.findMany({
        where: { clientId: { in: userIds } },
        select: { clientId: true },
        distinct: ['clientId'],
      }),
      this.prisma.bid.findMany({
        where: { freelancerId: { in: userIds } },
        select: { freelancerId: true },
        distinct: ['freelancerId'],
      }),
    ]);

    const activeUserSet = new Set<string>();
    for (const o of clientsWithOrders) activeUserSet.add(o.clientId);
    for (const b of freelancersWithBids) activeUserSet.add(b.freelancerId);
    const postedOrRespondedFirst = activeUserSet.size;

    const [clientsWhoPaid, freelancersWithAcceptedBids] = await Promise.all([
      this.prisma.invoice.findMany({
        where: { payerId: { in: userIds }, status: 'PAID' },
        select: { payerId: true },
        distinct: ['payerId'],
      }),
      this.prisma.bid.findMany({
        where: { freelancerId: { in: userIds }, status: 'ACCEPTED' },
        select: { freelancerId: true },
        distinct: ['freelancerId'],
      }),
    ]);

    const paidOrEarnedSet = new Set<string>();
    for (const inv of clientsWhoPaid) paidOrEarnedSet.add(inv.payerId);
    for (const b of freelancersWithAcceptedBids) paidOrEarnedSet.add(b.freelancerId);
    const paidOrEarnedFirst = paidOrEarnedSet.size;

    return {
      registered,
      onboarded: onboardedCount,
      postedOrRespondedFirst,
      paidOrEarnedFirst,
    };
  }

  async getTopCategories(limit = 10) {
    const validLimit = Math.min(Math.max(Number(limit) || 10, 1), 100);

    const categories = await this.prisma.category.findMany({
      include: {
        orders: {
          include: {
            invoices: {
              where: { status: 'PAID' },
            },
          },
        },
      },
    });

    const result = categories.map((cat) => {
      const orderCount = cat.orders.length;
      let gmv = 0;
      for (const order of cat.orders) {
        for (const inv of order.invoices) {
          gmv += Number(inv.amount);
        }
      }
      return {
        categoryId: cat.id,
        categoryName: cat.name,
        orderCount,
        gmv: Math.round(gmv * 100) / 100,
      };
    });

    result.sort((a, b) => b.gmv - a.gmv);
    return result.slice(0, validLimit);
  }

  async getTopFreelancers(limit = 10) {
    const validLimit = Math.min(Math.max(Number(limit) || 10, 1), 100);

    const freelancers = await this.prisma.user.findMany({
      where: {
        OR: [{ primaryRole: 'FREELANCER' }, { roles: { has: 'FREELANCER' } }],
      },
      include: {
        profile: true,
        wallet: {
          include: {
            entries: {
              where: { balanceType: 'WITHDRAWABLE', direction: 'CREDIT' },
            },
          },
        },
        bids: {
          where: { status: 'ACCEPTED', order: { status: 'COMPLETED' } },
        },
        reviewsReceived: {
          select: { rating: true },
        },
      },
    });

    const result = freelancers.map((user) => {
      let earnings = 0;
      if (user.wallet?.entries) {
        for (const e of user.wallet.entries) {
          earnings += Number(e.amount);
        }
      }

      const ordersCompleted = user.bids.length;
      let avgRating: number | null = null;
      if (user.reviewsReceived.length > 0) {
        const sum = user.reviewsReceived.reduce((acc, r) => acc + r.rating, 0);
        avgRating = Math.round((sum / user.reviewsReceived.length) * 100) / 100;
      }

      return {
        userId: user.id,
        displayName: user.profile?.displayName ?? user.id,
        earnings: Math.round(earnings * 100) / 100,
        ordersCompleted,
        avgRating,
      };
    });

    result.sort((a, b) => b.earnings - a.earnings);
    return result.slice(0, validLimit);
  }

  async mergeSkill(sourceId: string, targetId: string) {
    const [source, target] = await Promise.all([
      this.prisma.skill.findUnique({ where: { id: sourceId } }),
      this.prisma.skill.findUnique({ where: { id: targetId } }),
    ]);
    if (!source || !target) {
      throw new NotFoundException('One or both skills not found');
    }

    await this.prisma.$transaction(async (tx) => {
      const profileSkills = await tx.profileSkill.findMany({ where: { skillId: sourceId } });
      for (const ps of profileSkills) {
        const existing = await tx.profileSkill.findUnique({
          where: { profileId_skillId: { profileId: ps.profileId, skillId: targetId } },
        });
        if (!existing) {
          await tx.profileSkill.create({
            data: { profileId: ps.profileId, skillId: targetId },
          });
        }
        await tx.profileSkill.delete({
          where: { profileId_skillId: { profileId: ps.profileId, skillId: sourceId } },
        });
      }

      await tx.skill.delete({ where: { id: sourceId } });
    });

    return { success: true };
  }

  async bulkSuspendUsers(staffUserId: string, userIds: string[], reason: string) {
    const validIds = userIds.filter((id) => id !== staffUserId);

    const staffUsers = await this.prisma.user.findMany({
      where: { id: { in: validIds }, isStaff: true },
      select: { id: true },
    });
    const staffIdSet = new Set(staffUsers.map((u) => u.id));
    const targetIds = validIds.filter((id) => !staffIdSet.has(id));

    if (targetIds.length > 0) {
      await this.prisma.user.updateMany({
        where: { id: { in: targetIds } },
        data: { status: 'SUSPENDED' },
      });
    }

    return { suspendedCount: targetIds.length };
  }

  async resetUser2FA(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { totpSecret: null, totpEnabled: false },
      });
      await (tx as any).totpBackupCode.deleteMany({ where: { userId } });
    });

    return { success: true };
  }

  // --- Модерация (CodexTZ 021) ---

  /**
   * Единая очередь на review — источники: открытые FraudFlag (риск-скоринг
   * fraud-service, см. FraudService) с orderId → тип ORDER, без orderId
   * (только userId) → тип PROFILE; заражённые файлы (антивирус, ClamAV) →
   * тип FILE; отзывы с низким рейтингом и текстом, ещё не разобранные —
   * тип REVIEW (эвристика, а не report-система: жалоб на отзывы в продукте
   * пока нет, но абьюзивный низкий отзыв — разумный сигнал для ручной проверки).
   */
  async getModerationQueue() {
    const [orderFlags, profileFlags, infectedFiles, flaggedReviews] = await Promise.all([
      this.prisma.fraudFlag.findMany({
        where: { status: 'OPEN', orderId: { not: null } },
        include: { order: { select: { id: true, title: true } }, user: { include: { profile: true } } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.fraudFlag.findMany({
        where: { status: 'OPEN', orderId: null },
        include: { user: { include: { profile: true } } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.fileAsset.findMany({
        where: { scanStatus: 'INFECTED', moderatedAt: null },
        include: { owner: { include: { profile: true } } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.review.findMany({
        where: { hiddenAt: null, moderatedAt: null, rating: { lte: 2 }, comment: { not: null } },
        include: { author: { include: { profile: true } }, target: { include: { profile: true } } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);

    const orders = orderFlags.map((f) => ({
      type: 'ORDER' as const,
      id: f.id,
      severity: f.severity,
      reasons: f.reasons,
      riskScore: f.riskScore,
      order: f.order,
      user: f.user ? { id: f.user.id, displayName: f.user.profile?.displayName ?? f.user.email } : null,
      createdAt: f.createdAt,
    }));

    const profiles = profileFlags.map((f) => ({
      type: 'PROFILE' as const,
      id: f.id,
      severity: f.severity,
      reasons: f.reasons,
      riskScore: f.riskScore,
      user: f.user ? { id: f.user.id, displayName: f.user.profile?.displayName ?? f.user.email } : null,
      createdAt: f.createdAt,
    }));

    const files = infectedFiles.map((file) => ({
      type: 'FILE' as const,
      id: file.id,
      url: file.url,
      mimeType: file.mimeType,
      kind: file.kind,
      owner: { id: file.owner.id, displayName: file.owner.profile?.displayName ?? file.owner.email },
      createdAt: file.createdAt,
    }));

    const reviews = flaggedReviews.map((r) => ({
      type: 'REVIEW' as const,
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      author: { id: r.author.id, displayName: r.author.profile?.displayName ?? r.author.email },
      target: { id: r.target.id, displayName: r.target.profile?.displayName ?? r.target.email },
      createdAt: r.createdAt,
    }));

    return { orders, profiles, files, reviews };
  }

  private fraudActionToStatus(action: 'APPROVE' | 'REJECT' | 'REQUEST_EDITS'): 'DISMISSED' | 'CONFIRMED' | 'REVIEWED' {
    if (action === 'APPROVE') return 'DISMISSED';
    if (action === 'REJECT') return 'CONFIRMED';
    return 'REVIEWED';
  }

  async resolveOrderOrProfileModeration(staffId: string, flagId: string, action: 'APPROVE' | 'REJECT' | 'REQUEST_EDITS', note?: string) {
    const flag = await this.prisma.fraudFlag.findUnique({ where: { id: flagId } });
    if (!flag) throw new NotFoundException('Moderation item not found');

    return this.prisma.fraudFlag.update({
      where: { id: flagId },
      data: { status: this.fraudActionToStatus(action), reviewNote: note, reviewedById: staffId, reviewedAt: new Date() },
    });
  }

  async resolveFileModeration(fileId: string) {
    const file = await this.prisma.fileAsset.findUnique({ where: { id: fileId } });
    if (!file) throw new NotFoundException('File not found');

    return this.prisma.fileAsset.update({ where: { id: fileId }, data: { moderatedAt: new Date() } });
  }

  async resolveReviewModeration(reviewId: string, action: 'APPROVE' | 'REJECT' | 'REQUEST_EDITS') {
    const review = await this.prisma.review.findUnique({ where: { id: reviewId } });
    if (!review) throw new NotFoundException('Review not found');

    return this.prisma.review.update({
      where: { id: reviewId },
      data: { moderatedAt: new Date(), hiddenAt: action === 'REJECT' ? new Date() : null },
    });
  }
}
