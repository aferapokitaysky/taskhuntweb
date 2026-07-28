import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../common/events/event-bus.service';
import { DomainEventName } from '@taskhunt/shared-types';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { CreateBidDto } from './dto/create-bid.dto';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
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
        data: { ...dto, clientId, status: 'OPEN' },
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

  async findMany(filters: { categoryId?: string; status?: string; search?: string }) {
    const where: Prisma.OrderWhereInput = {
      categoryId: filters.categoryId,
      status: (filters.status as any) ?? { not: 'DRAFT' },
    };

    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

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

    const result = orders.map((order) => ({
      ...order,
      isPromoted: promotedOrderIds.has(order.id),
    }));

    result.sort((a, b) => {
      if (a.isPromoted && !b.isPromoted) return -1;
      if (!a.isPromoted && b.isPromoted) return 1;
      return 0;
    });

    return result;
  }

  async findOne(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        category: true,
        bids: { include: { freelancer: { include: { profile: true } } } },
        milestones: true,
        chatThread: true,
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async update(clientId: string, orderId: string, dto: UpdateOrderDto) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.clientId !== clientId) throw new ForbiddenException('Not your order');
    if (order.status !== 'OPEN' && order.status !== 'DRAFT') {
      throw new BadRequestException('Cannot edit order once work has started');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({ where: { id: orderId }, data: dto });

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

    await this.eventBus.publish(DomainEventName.BidSubmitted, {
      bidId: bid.id,
      orderId,
      freelancerId,
      amount: Number(bid.amount),
    });

    return bid;
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
      await tx.chatThread.create({ data: { orderId } });
      return updatedOrder;
    });

    await this.eventBus.publish(DomainEventName.BidAccepted, {
      bidId,
      orderId,
      freelancerId: bid.freelancerId,
      clientId,
      amount: Number(bid.amount),
    });

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

    await this.eventBus.publish(DomainEventName.DisputeOpened, {
      disputeId: dispute.id,
      orderId,
      openedById: userId,
      reason,
    });

    return dispute;
  }
}
