import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../common/events/event-bus.service';
import { DomainEventName } from '@taskhunt/shared-types';
import { MatchingService, compatibilityPercent } from '../matching/matching.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { CreateBidDto } from './dto/create-bid.dto';

import { UsersService } from '../users/users.service';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly matching: MatchingService,
    private readonly usersService: UsersService,
  ) {}

  private getStartOfMonth(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }

  private async checkOrderCreationLimit(clientId: string) {
    const activeSub = await this.prisma.subscription.findFirst({
      where: { userId: clientId, status: 'ACTIVE', expiresAt: { gt: new Date() } },
      include: { tier: true },
    });

    let maxLimit: number | null = 5; // STARTER default
    if (activeSub?.tier) {
      maxLimit = activeSub.tier.maxActiveOrdersPerMonth;
    }

    if (maxLimit !== null) {
      const count = await this.prisma.order.count({
        where: {
          clientId,
          createdAt: { gte: this.getStartOfMonth() },
        },
      });
      if (count >= maxLimit) {
        throw new BadRequestException('Достигнут лимит создания заказов на вашем тарифе, оформите Pro');
      }
    }
  }

  private async checkBidSubmissionLimit(freelancerId: string) {
    const activeSub = await this.prisma.subscription.findFirst({
      where: { userId: freelancerId, status: 'ACTIVE', expiresAt: { gt: new Date() } },
      include: { tier: true },
    });

    let maxLimit: number | null = 10; // STARTER default
    if (activeSub?.tier) {
      maxLimit = activeSub.tier.maxActiveBidsPerMonth;
    }

    if (maxLimit !== null) {
      const count = await this.prisma.bid.count({
        where: {
          freelancerId,
          createdAt: { gte: this.getStartOfMonth() },
        },
      });
      if (count >= maxLimit) {
        throw new BadRequestException('Достигнут лимит откликов на вашем тарифе, оформите Pro');
      }
    }
  }

  async create(clientId: string, dto: CreateOrderDto) {
    await this.checkOrderCreationLimit(clientId);

    const order = await this.prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        // dto.deadline приходит с фронта как "YYYY-MM-DD" (input type="date") —
        // Prisma требует полный ISO-8601 DateTime, голая дата валится с ошибкой.
        data: { ...dto, deadline: dto.deadline ? new Date(dto.deadline) : undefined, clientId, status: 'OPEN' },
      });
      await tx.orderVersion.create({
        data: { orderId: created.id, versionNumber: 1, snapshot: created as any, editedById: clientId },
      });
      return created;
    });

    await this.eventBus.publish(DomainEventName.OrderCreated, {
      orderId: order.id,
      clientId: order.clientId,
      categoryId: order.categoryId,
      budgetMin: Number(order.budgetMin),
      budgetMax: order.budgetMax ? Number(order.budgetMax) : null,
    });

    return order;
  }

  async findMany(filters: {
    categoryId?: string;
    status?: string;
    search?: string;
    tags?: string[];
    minBudget?: number;
    clientId?: string;
    requesterId?: string;
  }) {
    const and: Prisma.OrderWhereInput[] = [];

    if (filters.search) {
      and.push({
        OR: [
          { title: { contains: filters.search, mode: 'insensitive' } },
          { description: { contains: filters.search, mode: 'insensitive' } },
        ],
      });
    }

    if (filters.tags && filters.tags.length > 0) {
      and.push({ tags: { hasSome: filters.tags } });
    }

    if (filters.minBudget !== undefined && !Number.isNaN(filters.minBudget)) {
      // budgetMax может быть не указан ("бюджет открытый") — тогда сверяем
      // с budgetMin: заказ подходит, если сам минимум уже не ниже порога.
      and.push({
        OR: [{ budgetMax: { gte: filters.minBudget } }, { budgetMax: null, budgetMin: { gte: filters.minBudget } }],
      });
    }

    const where: Prisma.OrderWhereInput = {
      categoryId: filters.categoryId,
      clientId: filters.clientId,
      status: (filters.status as any) ?? { not: 'DRAFT' },
      ...(and.length > 0 && { AND: and }),
    };

    const orders = await this.prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { category: true, _count: { select: { bids: true } } },
    });

    const now = new Date();
    const activeOrderPromotions = await this.prisma.promotion.findMany({
      where: {
        entityType: 'ORDER',
        expiresAt: { gt: now },
        entityId: { in: orders.map((o) => o.id) },
      },
    });

    const promotedOrderIds = new Set(activeOrderPromotions.map((p) => p.entityId));

    const withPromotion = orders.map((order) => ({
      ...order,
      isPromoted: promotedOrderIds.has(order.id),
    }));

    const ranked = this.matching.rankOrdersForFeed(withPromotion);

    // % совпадения с навыками — только для залогиненного фрилансера
    // (OptionalJwtAuthGuard на контроллере), считаем один раз здесь,
    // не в персональной ленте (см. MatchingService.recommendOrdersForFreelancer,
    // тот путь остаётся отдельным — там ранжирование, тут просто отображение).
    if (filters.requesterId) {
      const requesterProfile = await this.prisma.profile.findUnique({
        where: { userId: filters.requesterId },
        include: { skills: { include: { skill: true } } },
      });
      const skillNames = requesterProfile?.skills.map((s) => s.skill.name) ?? [];
      if (skillNames.length > 0) {
        return ranked.map((order) => ({
          ...order,
          compatibilityPercent: compatibilityPercent(order.tags, skillNames),
        }));
      }
    }

    return ranked.map((order) => ({ ...order, compatibilityPercent: null as number | null }));
  }

  async getRankedBids(clientId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.clientId !== clientId) throw new ForbiddenException('Not your order');

    return this.matching.rankBidsForOrder(orderId);
  }

  async findOne(id: string) {
    // Инкремент счётчика просмотров тем же запросом, что и чтение — простая
    // метрика по аналогии с Profile.viewsCount, не защищена от накрутки
    // владельцем, это осознанно (см. TZ_CLAUDE_13.md, п.1).
    let order: any;
    try {
      const res = this.prisma.order.update({
        where: { id },
        data: { viewsCount: { increment: 1 } },
        include: {
          category: true,
          client: { include: { profile: true } },
          bids: { include: { freelancer: { include: { profile: true } } } },
          milestones: true,
          chatThreads: true,
          disputes: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      });
      order = res && typeof (res as any).then === 'function' ? await (res as any).catch(() => null) : res;
    } catch {
      order = null;
    }

    if (!order) {
      order = await (this.prisma.order.findUnique({
        where: { id },
        include: {
          category: true,
          client: { include: { profile: true } },
          bids: { include: { freelancer: { include: { profile: true } } } },
          milestones: true,
          chatThreads: true,
          disputes: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      }) as Promise<any>).catch(() => null);
    }

    if (!order) throw new NotFoundException('Order not found');

    const completedClientOrders = await this.prisma.order.count({
      where: { clientId: order.clientId, status: 'COMPLETED' },
    });
    const verifiedPayer = completedClientOrders > 0;
    const clientWithVerified = order.client ? { ...order.client, verifiedPayer } : null;

    const freelancerIds: string[] = Array.from(new Set(order.bids.map((b: any) => b.freelancerId)));

    if (freelancerIds.length > 0) {
      const reviewStats = (await (this.prisma.review as any).groupBy({
        by: ['targetId'],
        where: { targetId: { in: freelancerIds } },
        _avg: { rating: true },
        _count: { id: true },
      })) as any[];

      const statsMap = new Map<string, { avgRating: number | null; reviewsCount: number }>();
      for (const stat of reviewStats) {
        statsMap.set(stat.targetId, {
          avgRating: stat._avg?.rating ? Math.round(stat._avg.rating * 100) / 100 : null,
          reviewsCount: stat._count?.id ?? 0,
        });
      }

      const bidsWithStats = order.bids.map((bid: any) => {
        const stats = statsMap.get(bid.freelancerId) ?? { avgRating: null, reviewsCount: 0 };
        return {
          ...bid,
          freelancer: {
            ...bid.freelancer,
            avgRating: stats.avgRating,
            reviewsCount: stats.reviewsCount,
          },
        };
      });

      return {
        ...order,
        client: clientWithVerified,
        bids: bidsWithStats,
      };
    }

    return {
      ...order,
      client: clientWithVerified,
    };
  }

  async update(clientId: string, orderId: string, dto: UpdateOrderDto) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.clientId !== clientId) throw new ForbiddenException('Not your order');
    if (order.status !== 'OPEN' && order.status !== 'DRAFT') {
      throw new BadRequestException('Cannot edit order once work has started');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id: orderId },
        data: { ...dto, deadline: dto.deadline ? new Date(dto.deadline) : undefined },
      });

      const lastVersion = await tx.orderVersion.findFirst({
        where: { orderId },
        orderBy: { versionNumber: 'desc' },
      });

      await tx.orderVersion.create({
        data: {
          orderId,
          versionNumber: (lastVersion?.versionNumber ?? 0) + 1,
          snapshot: updated as any,
          editedById: clientId,
        },
      });

      return updated;
    });
  }

  async submitBid(freelancerId: string, orderId: string, dto: CreateBidDto) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status !== 'OPEN') throw new BadRequestException('Order is not accepting bids');
    if (order.clientId === freelancerId) throw new BadRequestException('Cannot bid on your own order');

    await this.checkBidSubmissionLimit(freelancerId);

    const bid = await this.prisma.bid.create({
      data: { orderId, freelancerId, ...dto },
    });

    // Если фрилансер был приглашён на этот заказ — считаем приглашение
    // отработанным, откликнулся он сам или по приглашению, не важно.
    await this.prisma.orderInvite
      .updateMany({ where: { orderId, freelancerId, status: 'PENDING' }, data: { status: 'ACCEPTED' } })
      .catch(() => undefined);

    await this.eventBus.publish(DomainEventName.BidSubmitted, {
      bidId: bid.id,
      orderId,
      freelancerId,
      amount: Number(bid.amount),
    });

    await this.usersService.recalculateAvgResponseTime(freelancerId);

    return bid;
  }

  async inviteFreelancer(clientId: string, orderId: string, freelancerId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.clientId !== clientId) throw new ForbiddenException('Not your order');
    if (order.status !== 'OPEN') throw new BadRequestException('Нельзя пригласить на закрытый заказ');

    const freelancer = await this.prisma.user.findUnique({ where: { id: freelancerId } });
    if (!freelancer || !freelancer.roles.includes('FREELANCER')) {
      throw new BadRequestException('Пользователь не является фрилансером');
    }

    try {
      const invite = await this.prisma.orderInvite.create({
        data: { orderId, freelancerId, clientId },
      });

      await this.eventBus.publish(DomainEventName.OrderInviteCreated, {
        inviteId: invite.id,
        orderId,
        orderTitle: order.title,
        freelancerId,
        clientId,
      });

      return invite;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new BadRequestException('Этот фрилансер уже приглашён на заказ');
      }
      throw err;
    }
  }

  async listMyInvites(freelancerId: string) {
    return this.prisma.orderInvite.findMany({
      where: { freelancerId, status: 'PENDING' },
      include: { order: { include: { category: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async acceptBid(clientId: string, orderId: string, bidId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.clientId !== clientId) throw new ForbiddenException('Not your order');
    if (order.status !== 'OPEN') throw new BadRequestException('Order is not open');

    const bid = await this.prisma.bid.findUnique({ where: { id: bidId } });
    if (!bid || bid.orderId !== orderId) throw new NotFoundException('Bid not found');

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.bid.update({ where: { id: bidId }, data: { status: 'ACCEPTED' } });
      await tx.bid.updateMany({
        where: { orderId, id: { not: bidId }, status: 'PENDING' },
        data: { status: 'REJECTED' },
      });
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: { status: 'IN_PROGRESS', acceptedBidId: bidId },
      });
      // Тред с этим фрилансером мог уже существовать из переписки до принятия отклика.
      await tx.chatThread.upsert({
        where: { orderId_freelancerId: { orderId, freelancerId: bid.freelancerId } },
        create: { orderId, freelancerId: bid.freelancerId },
        update: {},
      });
      return updatedOrder;
    });

    await this.eventBus.publish(DomainEventName.BidAccepted, {
      bidId,
      orderId,
      freelancerId: bid.freelancerId,
      clientId,
      amount: Number(bid.amount),
    });

    await this.usersService.recalculateSuccessMetrics(bid.freelancerId);

    return result;
  }

  async openDispute(userId: string, orderId: string, reason: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { bids: { where: { status: 'ACCEPTED' } } },
    });
    if (!order) throw new NotFoundException('Order not found');

    const isParticipant = order.clientId === userId || order.bids.some((b) => b.freelancerId === userId);
    if (!isParticipant) throw new ForbiddenException('Not a participant of this order');

    const dispute = await this.prisma.$transaction(async (tx) => {
      const created = await tx.dispute.create({ data: { orderId, openedById: userId, reason } });
      await tx.order.update({ where: { id: orderId }, data: { status: 'DISPUTED' } });
      return created;
    });

    const acceptedBid = order.bids[0];
    if (acceptedBid) {
      await this.usersService.incrementDisputesCount(acceptedBid.freelancerId);
      await this.usersService.recalculateSuccessMetrics(acceptedBid.freelancerId);
    }

    await this.eventBus.publish(DomainEventName.DisputeOpened, {
      disputeId: dispute.id,
      orderId,
      openedById: userId,
      reason,
    });

    return dispute;
  }

  async saveOrder(userId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, select: { id: true } });
    if (!order) throw new NotFoundException('Order not found');

    await this.prisma.savedOrder.upsert({
      where: { userId_orderId: { userId, orderId } },
      create: { userId, orderId },
      update: {},
    });
    return { saved: true };
  }

  async unsaveOrder(userId: string, orderId: string) {
    await this.prisma.savedOrder.deleteMany({ where: { userId, orderId } });
    return { saved: false };
  }

  async listSavedOrders(userId: string) {
    const saved = await this.prisma.savedOrder.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { order: { include: { category: true, _count: { select: { bids: true } } } } },
    });
    return saved.map((s) => s.order);
  }

  async findSimilar(orderId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');

    const candidates = await this.prisma.order.findMany({
      where: {
        id: { not: orderId },
        status: { notIn: ['CANCELLED', 'EXPIRED'] },
        OR: [
          { categoryId: order.categoryId },
          ...(order.tags.length > 0 ? [{ tags: { hasSome: order.tags } }] : []),
        ],
      },
      take: 20,
    });

    const skillSet = new Set(order.tags.map((t) => t.toLowerCase()));
    candidates.sort((a, b) => {
      const aOverlap = a.tags.filter((t) => skillSet.has(t.toLowerCase())).length;
      const bOverlap = b.tags.filter((t) => skillSet.has(t.toLowerCase())).length;
      if (bOverlap !== aOverlap) return bOverlap - aOverlap;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

    return candidates.slice(0, 5);
  }

  async cloneOrder(clientId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.clientId !== clientId) {
      throw new ForbiddenException('Вы не являетесь владельцем этого заказа');
    }

    return this.prisma.order.create({
      data: {
        clientId,
        categoryId: order.categoryId,
        title: `${order.title} (копия)`,
        description: order.description,
        tags: order.tags,
        budgetMin: order.budgetMin,
        budgetMax: order.budgetMax,
        currency: order.currency,
        status: 'DRAFT',
        deadline: null,
      },
    });
  }

  async endorseSkill(clientId: string, orderId: string, skillId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        bids: { where: { status: 'ACCEPTED' } },
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.clientId !== clientId) {
      throw new ForbiddenException('Только заказчик может подтверждать навыки');
    }
    if (order.status !== 'COMPLETED') {
      throw new BadRequestException('Навык можно подтвердить только для завершённого заказа');
    }
    const acceptedBid = order.bids[0];
    if (!acceptedBid) {
      throw new BadRequestException('У заказа нет принятого исполнителя');
    }

    const freelancerId = acceptedBid.freelancerId;

    const profileSkill = await this.prisma.profileSkill.findFirst({
      where: {
        profile: { userId: freelancerId },
        skillId,
      },
    });
    if (!profileSkill) {
      throw new BadRequestException('У фрилансера не указан этот навык');
    }

    return this.prisma.skillEndorsement.create({
      data: {
        endorserId: clientId,
        targetId: freelancerId,
        skillId,
        orderId,
      },
    });
  }
}
