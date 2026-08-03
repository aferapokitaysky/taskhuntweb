import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { EventBusService } from '../../common/events/event-bus.service';
import { DomainEventName } from '@taskhunt/shared-types';
import { CreateMilestoneDto } from './dto/create-milestone.dto';
import { DeliverWorkDto } from './dto/deliver-work.dto';
import { UsersService } from '../users/users.service';

@Injectable()
export class MilestonesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
    private readonly eventBus: EventBusService,
    private readonly usersService: UsersService,
  ) {}

  async create(clientId: string, orderId: string, dto: CreateMilestoneDto) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.clientId !== clientId) throw new ForbiddenException('Not your order');

    return this.prisma.milestone.create({
      data: {
        orderId,
        title: dto.title,
        amount: dto.amount,
        position: dto.position,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      },
    });
  }

  async list(orderId: string) {
    return this.prisma.milestone.findMany({ where: { orderId }, orderBy: { position: 'asc' } });
  }

  private async assertAcceptedFreelancer(orderId: string, userId: string) {
    const bid = await this.prisma.bid.findFirst({ where: { orderId, status: 'ACCEPTED' } });
    if (!bid || bid.freelancerId !== userId) {
      throw new ForbiddenException('Only the accepted freelancer can deliver work on this order');
    }
    return bid;
  }

  /**
   * Сдача работы — либо по конкретному этапу (milestoneId), либо по заказу
   * целиком (milestoneId = null), если этапы вообще не заводили.
   */
  async deliver(freelancerId: string, orderId: string, milestoneId: string | null, dto: DeliverWorkDto) {
    await this.assertAcceptedFreelancer(orderId, freelancerId);

    if (milestoneId) {
      const milestone = await this.prisma.milestone.findUnique({ where: { id: milestoneId } });
      if (!milestone || milestone.orderId !== orderId) throw new NotFoundException('Milestone not found');
      if (milestone.status !== 'FUNDED' && milestone.status !== 'IN_PROGRESS') {
        throw new BadRequestException(`Cannot deliver milestone in status ${milestone.status}`);
      }
    }

    const lastDelivery = await this.prisma.delivery.findFirst({
      where: { orderId, milestoneId: milestoneId ?? null },
      orderBy: { versionNumber: 'desc' },
    });

    const delivery = await this.prisma.$transaction(async (tx) => {
      const created = await tx.delivery.create({
        data: {
          orderId,
          milestoneId: milestoneId ?? undefined,
          submittedById: freelancerId,
          description: dto.description,
          notes: dto.notes,
          versionNumber: (lastDelivery?.versionNumber ?? 0) + 1,
          files: dto.fileIds ? { create: dto.fileIds.map((fileId) => ({ fileId })) } : undefined,
        },
      });

      if (milestoneId) {
        await tx.milestone.update({ where: { id: milestoneId }, data: { status: 'DELIVERED' } });
      } else {
        await tx.order.update({ where: { id: orderId }, data: { status: 'IN_REVIEW' } });
      }

      return created;
    });

    const order = await this.prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    if (order.deadline && new Date() > order.deadline) {
      await this.usersService.incrementLateDeliveries(freelancerId);
    }

    await this.eventBus.publish(DomainEventName.WorkSubmitted, {
      orderId,
      deliveryId: delivery.id,
      submittedById: freelancerId,
      clientId: order.clientId,
    });

    return delivery;
  }

  /**
   * Приёмка работы клиентом — двигает реальные деньги: находит оплаченный
   * инвойс, привязанный к этапу (или к заказу целиком), и релизит эскроу
   * фрилансеру. Когда все этапы заказа релизнуты — заказ переходит в COMPLETED.
   */
  async approve(clientId: string, orderId: string, milestoneId: string | null) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { client: { include: { wallet: true } } },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.clientId !== clientId) throw new ForbiddenException('Not your order');
    if (!order.client.wallet) throw new BadRequestException('Client wallet missing');
    if (order.status === 'DISPUTED' || order.status === 'CANCELLED' || order.status === 'COMPLETED') {
      throw new BadRequestException('Заказ уже завершён или находится в споре — приёмка недоступна');
    }

    const acceptedBid = await this.prisma.bid.findFirst({
      where: { orderId, status: 'ACCEPTED' },
      include: { freelancer: { include: { wallet: true } } },
    });
    if (!acceptedBid?.freelancer.wallet) throw new BadRequestException('Freelancer wallet missing');

    const invoice = await this.prisma.invoice.findFirst({
      where: { orderId, status: 'PAID', milestoneId: milestoneId ?? null, escrowSettledAt: null },
      orderBy: { paidAt: 'desc' },
    });
    if (!invoice) throw new BadRequestException('No paid invoice found for this order/milestone');

    // Атомарно "застолбить" инвойс перед движением денег: если два запроса
    // на приёмку прилетят одновременно (двойной клик, повтор запроса), второй
    // получит claimed.count === 0 и остановится ДО releaseEscrow — иначе один
    // и тот же эскроу можно было релизнуть дважды (см. комментарий у поля
    // escrowSettledAt в schema.prisma).
    const claimed = await this.prisma.invoice.updateMany({
      where: { id: invoice.id, escrowSettledAt: null },
      data: { escrowSettledAt: new Date() },
    });
    if (claimed.count === 0) throw new BadRequestException('Эскроу по этому счёту уже обработано');

    await this.wallet.releaseEscrow({
      clientWalletId: order.client.wallet.id,
      freelancerWalletId: acceptedBid.freelancer.wallet.id,
      amount: Number(invoice.amount),
      invoiceId: invoice.id,
      orderId,
      freelancerId: acceptedBid.freelancerId,
    });

    if (milestoneId) {
      await this.prisma.milestone.update({ where: { id: milestoneId }, data: { status: 'RELEASED' } });

      const remaining = await this.prisma.milestone.count({
        where: { orderId, status: { not: 'RELEASED' } },
      });
      if (remaining === 0) {
        await this.prisma.order.update({ where: { id: orderId }, data: { status: 'COMPLETED' } });
      }
    } else {
      await this.prisma.order.update({ where: { id: orderId }, data: { status: 'COMPLETED' } });
    }

    const updatedOrder = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (updatedOrder?.status === 'COMPLETED') {
      await this.usersService.recalculateSuccessMetrics(acceptedBid.freelancerId);
    }

    return { released: true, invoiceId: invoice.id };
  }
}
