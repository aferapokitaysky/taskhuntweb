import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../common/events/event-bus.service';
import { DomainEventName, PermissionCode } from '@taskhunt/shared-types';
import { MatchingService, compatibilityPercent } from '../matching/matching.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { CreateOrderDraftDto } from './dto/create-order-draft.dto';
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

  /**
   * Черновик (CodexTZ 023.011) — сохраняется уже после заполнения одной
   * категории, остальные поля дозаполняются автосейвом через update().
   * Не считается против checkOrderCreationLimit и не публикует OrderCreated
   * — это ещё не заказ, который видят фрилансеры, событие уйдёт при publish().
   */
  async createDraft(clientId: string, dto: CreateOrderDraftDto) {
    return this.prisma.order.create({
      data: {
        categoryId: dto.categoryId,
        title: dto.title ?? 'Черновик заказа',
        description: dto.description ?? '',
        budgetMin: dto.budgetMin ?? 0,
        budgetMax: dto.budgetMax,
        deadline: dto.deadline ? new Date(dto.deadline) : undefined,
        tags: dto.tags ?? [],
        clientId,
        status: 'DRAFT',
      },
    });
  }

  async listMyDrafts(clientId: string) {
    return this.prisma.order.findMany({
      where: { clientId, status: 'DRAFT' },
      include: { category: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  /**
   * DRAFT -> OPEN. Черновик мог быть создан с пустыми title/description/
   * budgetMin (см. createDraft) — то, что сходило с рук черновику, не
   * годится для реального заказа, поэтому здесь та же валидация по сути,
   * что и в CreateOrderDto, только выполняется вручную (DTO уже не при чём,
   * данные читаются из БД, а не из тела запроса).
   */
  async publishDraft(clientId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.clientId !== clientId) throw new ForbiddenException('Not your order');
    if (order.status !== 'DRAFT') throw new BadRequestException('Order is not a draft');

    if (order.title.length < 5) throw new BadRequestException('Заполните заголовок заказа (минимум 5 символов)');
    if (order.description.length < 20) throw new BadRequestException('Заполните описание заказа (минимум 20 символов)');
    if (Number(order.budgetMin) <= 0) throw new BadRequestException('Укажите бюджет заказа');

    await this.checkOrderCreationLimit(clientId);

    const published = await this.prisma.order.update({ where: { id: orderId }, data: { status: 'OPEN' } });

    await this.eventBus.publish(DomainEventName.OrderCreated, {
      orderId: published.id,
      clientId: published.clientId,
      categoryId: published.categoryId,
      budgetMin: Number(published.budgetMin),
      budgetMax: published.budgetMax ? Number(published.budgetMax) : null,
    });

    return published;
  }

  async deleteDraft(clientId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.clientId !== clientId) throw new ForbiddenException('Not your order');
    if (order.status !== 'DRAFT') throw new BadRequestException('Order is not a draft');

    await this.prisma.order.delete({ where: { id: orderId } });
  }

  // Лента ранжируется в памяти составным скором (свежесть с экспоненциальным
  // затуханием, срочность дедлайна, буст продвижения — см.
  // MatchingService.rankOrdersForFeed), это нельзя выразить SQL ORDER BY.
  // Поэтому не тащим из БД весь таблицу целиком на каждый запрос: берём
  // ограниченный пул кандидатов (последние по дате, с запасом на неточность
  // ranking), ранжируем его в памяти, страницы режем уже по готовому
  // отранжированному списку. Тот же паттерн, что у Reddit/HN — "hot"-лента
  // не поддерживает бесконечную глубокую пагинацию, только разумные первые
  // страницы, что для ленты заказов ожидаемо (никто не листает до конца).
  private static readonly FEED_CANDIDATE_POOL_SIZE = 300;
  private static readonly FEED_DEFAULT_PAGE_SIZE = 20;

  async findMany(filters: {
    categoryId?: string;
    status?: string;
    search?: string;
    tags?: string[];
    minBudget?: number;
    clientId?: string;
    requesterId?: string;
    page?: number;
    limit?: number;
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
      // Скрываем заказы staff/admin-аккаунтов из публичного браузинга — но
      // только когда явно НЕ запрошены заказы конкретного клиента (clientId
      // используется, например, для "пригласить на свой открытый заказ" —
      // там staff должен видеть свои же заказы, см. FreelancerProfileClient).
      ...(!filters.clientId && { client: { isStaff: false } }),
      ...(and.length > 0 && { AND: and }),
    };

    const page = filters.page && filters.page > 0 ? Number(filters.page) : 1;
    const limit =
      filters.limit && filters.limit > 0
        ? Math.min(Number(filters.limit), OrdersService.FEED_CANDIDATE_POOL_SIZE)
        : OrdersService.FEED_DEFAULT_PAGE_SIZE;

    const [total, orders] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        take: OrdersService.FEED_CANDIDATE_POOL_SIZE,
        orderBy: { createdAt: 'desc' },
        include: { category: true, _count: { select: { bids: true } } },
      }),
    ]);

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

    let processed: any[] = ranked;
    if (filters.requesterId) {
      const requesterProfile = await this.prisma.profile.findUnique({
        where: { userId: filters.requesterId },
        include: { skills: { include: { skill: true } } },
      });
      const skillNames = requesterProfile?.skills.map((s) => s.skill.name) ?? [];
      if (skillNames.length > 0) {
        processed = ranked.map((order) => ({
          ...order,
          compatibilityPercent: compatibilityPercent(order.tags, skillNames),
        }));
      } else {
        processed = ranked.map((order) => ({ ...order, compatibilityPercent: null as number | null }));
      }
    } else {
      processed = ranked.map((order) => ({ ...order, compatibilityPercent: null as number | null }));
    }

    const skip = (page - 1) * limit;
    const items = processed.slice(skip, skip + limit);
    const hasMore = skip + items.length < total;

    return {
      items,
      total,
      page,
      limit,
      hasMore,
    };
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

    const block = this.prisma.clientBlock?.findUnique
      ? await this.prisma.clientBlock.findUnique({
          where: { clientId_freelancerId: { clientId: order.clientId, freelancerId } },
        })
      : null;
    if (block) {
      throw new ForbiddenException('Вы не можете откликаться на заказы этого клиента');
    }

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

  /**
   * Отклики фрилансера по всем заказам сразу (CodexTZ dashboard unification —
   * раньше единственный способ узнать статус своего отклика был открыть
   * каждый заказ отдельно).
   */
  async listMyBids(freelancerId: string) {
    return this.prisma.bid.findMany({
      where: { freelancerId },
      include: { order: { include: { category: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listMyInvites(freelancerId: string) {
    return this.prisma.orderInvite.findMany({
      where: { freelancerId, status: 'PENDING' },
      include: { order: { include: { category: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async respondToInvite(freelancerId: string, inviteId: string, accept: boolean) {
    const invite = await this.prisma.orderInvite.findUnique({
      where: { id: inviteId },
      include: { order: { select: { title: true } } },
    });
    if (!invite) throw new NotFoundException('Invite not found');
    if (invite.freelancerId !== freelancerId) throw new ForbiddenException('Not your invite');
    if (invite.status !== 'PENDING') throw new BadRequestException('Приглашение уже обработано');

    const updated = await this.prisma.orderInvite.update({
      where: { id: inviteId },
      data: { status: accept ? 'ACCEPTED' : 'DECLINED' },
    });

    await this.eventBus.publish(DomainEventName.OrderInviteResponded, {
      inviteId,
      orderId: invite.orderId,
      orderTitle: invite.order.title,
      freelancerId,
      clientId: invite.clientId,
      accepted: accept,
    });

    return updated;
  }

  async acceptBid(clientId: string, orderId: string, bidId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.clientId !== clientId) throw new ForbiddenException('Not your order');
    if (order.status !== 'OPEN') throw new BadRequestException('Order is not open');

    const bid = await this.prisma.bid.findUnique({ where: { id: bidId } });
    if (!bid || bid.orderId !== orderId) throw new NotFoundException('Bid not found');

    const result = await this.prisma.$transaction(async (tx) => {
      const rejectedBids = await tx.bid.findMany({
        where: { orderId, id: { not: bidId }, status: 'PENDING' },
        select: { id: true, freelancerId: true },
      });
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
      if (rejectedBids.length > 0) {
        await tx.notification.createMany({
          data: rejectedBids.map((rejectedBid) => ({
            userId: rejectedBid.freelancerId,
            title: 'Отклик закрыт',
            message: `Заказчик выбрал другого исполнителя по заказу «${order.title}». Ваш отклик закрыт автоматически.`,
            eventName: 'BidRejected',
            metadata: {
              orderId,
              bidId: rejectedBid.id,
              acceptedBidId: bidId,
              href: `/orders/${orderId}`,
            },
          })),
        });
      }
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

    const acceptedBidForThread = order.bids[0];
    const chatThread = acceptedBidForThread
      ? await this.prisma.chatThread.findUnique({
          where: { orderId_freelancerId: { orderId, freelancerId: acceptedBidForThread.freelancerId } },
        })
      : null;

    const { dispute, ticket } = await this.prisma.$transaction(async (tx) => {
      const createdDispute = await tx.dispute.create({
        data: { orderId, openedById: userId, reason, chatThreadId: chatThread?.id ?? null },
      });
      await tx.order.update({ where: { id: orderId }, data: { status: 'DISPUTED' } });
      // Открывая спор, пользователь автоматически получает тикет поддержки
      // по нему — раньше спор был "немым" (только reason/resolutionNotes,
      // без переписки), пользователю было некуда написать арбитру, кроме
      // как ждать решения вслепую.
      const createdTicket = await tx.supportTicket.create({
        data: {
          userId,
          disputeId: createdDispute.id,
          subject: `Спор по заказу «${order.title}»`,
          priority: 'HIGH',
          messages: { create: { senderId: userId, body: reason } },
        },
      });
      return { dispute: createdDispute, ticket: createdTicket };
    });

    const supportStaff = await this.prisma.user.findMany({
      where: {
        isStaff: true,
        staffRoles: { some: { role: { permissions: { some: { permission: { code: PermissionCode.DisputeView } } } } } },
      },
      select: { id: true },
    });
    if (supportStaff.length > 0) {
      await this.prisma.notification.createMany({
        data: supportStaff.map((staff) => ({
          userId: staff.id,
          title: 'Новый спор — открыт тикет поддержки',
          message: `Спор по заказу "${order.title}" автоматически завёл тикет поддержки.`,
          eventName: 'SupportTicketCreated',
          metadata: {
            ticketId: ticket.id,
            disputeId: dispute.id,
            chatThreadId: chatThread?.id ?? null,
            href: `/admin?tab=support&ticketId=${ticket.id}`,
          },
        })),
      });
    }

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

  async attachFileToDispute(userId: string, orderId: string, disputeId: string, fileId: string) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
      include: { order: { include: { bids: { where: { status: 'ACCEPTED' } } } } },
    });
    if (!dispute || dispute.orderId !== orderId) {
      throw new NotFoundException('Dispute not found');
    }

    const acceptedFreelancerId = dispute.order.bids[0]?.freelancerId;
    const isParticipant = dispute.openedById === userId || dispute.order.clientId === userId || acceptedFreelancerId === userId;
    if (!isParticipant) {
      throw new ForbiddenException('Вы не являетесь участником спора');
    }

    const fileAsset = await this.prisma.fileAsset.findUnique({ where: { id: fileId } });
    if (!fileAsset) throw new NotFoundException('File asset not found');
    if (fileAsset.ownerId !== userId) {
      throw new ForbiddenException('Можно приложить только собственный файл');
    }
    if (fileAsset.scanStatus !== 'CLEAN') {
      throw new BadRequestException('Файл еще не прошёл проверку антивирусом или заблокирован');
    }

    return this.prisma.disputeFile.create({
      data: {
        disputeId,
        fileId,
      },
    });
  }

  async listDisputeFiles(userId: string, disputeId: string) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
      include: { order: { include: { bids: { where: { status: 'ACCEPTED' } } } } },
    });
    if (!dispute) throw new NotFoundException('Dispute not found');

    const acceptedFreelancerId = dispute.order.bids[0]?.freelancerId;
    const isParticipant = dispute.openedById === userId || dispute.order.clientId === userId || acceptedFreelancerId === userId;
    if (!isParticipant) {
      throw new ForbiddenException('Вы не являетесь участником спора');
    }

    const disputeFiles = await this.prisma.disputeFile.findMany({
      where: { disputeId },
      include: { file: true },
    });

    return disputeFiles.map((df) => df.file);
  }

  async requestDeadlineExtension(freelancerId: string, orderId: string, dto: { newDeadline: string; reason?: string }) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { bids: { where: { status: 'ACCEPTED' } } },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status !== 'IN_PROGRESS') {
      throw new BadRequestException('Продление дедлайна возможно только для выполняющихся заказов');
    }
    const acceptedFreelancerId = order.bids[0]?.freelancerId;
    if (acceptedFreelancerId !== freelancerId) {
      throw new ForbiddenException('Только выбранный исполнитель может просить продление дедлайна');
    }

    const request = await this.prisma.deadlineExtensionRequest.create({
      data: {
        orderId,
        requestedBy: freelancerId,
        newDeadline: new Date(dto.newDeadline),
        reason: dto.reason,
      },
    });

    await this.eventBus.publish(DomainEventName.DeadlineExtensionRequested as any, {
      requestId: request.id,
      orderId,
      freelancerId,
      clientId: order.clientId,
      newDeadline: dto.newDeadline,
    });

    return request;
  }

  async respondDeadlineExtension(clientId: string, orderId: string, requestId: string, approve: boolean) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.clientId !== clientId) throw new ForbiddenException('Not your order');

    const request = await this.prisma.deadlineExtensionRequest.findUnique({ where: { id: requestId } });
    if (!request || request.orderId !== orderId) throw new NotFoundException('Request not found');
    if (request.status !== 'PENDING') throw new BadRequestException('Request is already processed');

    const updated = await this.prisma.$transaction(async (tx) => {
      const reqStatus = approve ? 'APPROVED' : 'DECLINED';
      const updatedReq = await tx.deadlineExtensionRequest.update({
        where: { id: requestId },
        data: { status: reqStatus },
      });

      if (approve) {
        await tx.order.update({
          where: { id: orderId },
          data: { deadline: request.newDeadline },
        });
      }

      return updatedReq;
    });

    await this.eventBus.publish(DomainEventName.DeadlineExtensionResponded as any, {
      requestId,
      orderId,
      clientId,
      freelancerId: request.requestedBy,
      approved: approve,
    });

    return updated;
  }

  async rejectBid(clientId: string, orderId: string, bidId: string, reason?: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.clientId !== clientId) throw new ForbiddenException('Not your order');

    const bid = await this.prisma.bid.findUnique({ where: { id: bidId } });
    if (!bid || bid.orderId !== orderId) throw new NotFoundException('Bid not found');
    if (bid.status !== 'PENDING') throw new BadRequestException('Bid is not pending');

    const updated = await this.prisma.bid.update({
      where: { id: bidId },
      data: { status: 'REJECTED', rejectionReason: reason ?? null },
    });

    await this.prisma.notification.create({
      data: {
        userId: bid.freelancerId,
        title: 'Отклик отклонён',
        message: `Ваш отклик на заказ «${order.title}» отклонён.${reason ? ` Причина: ${reason}` : ''}`,
        eventName: 'BidRejected',
        metadata: {
          orderId,
          bidId,
          href: `/orders/${orderId}`,
        },
      },
    });

    return updated;
  }
}
