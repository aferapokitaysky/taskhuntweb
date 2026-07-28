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

  /**
   * Разрешение спора двигает реальные деньги — ищем последний оплаченный
   * инвойс по заказу и либо релизим эскроу фрилансеру, либо возвращаем
   * заказчику. RESOLVED_SPLIT (частичный сплит) — Phase 2.
   */
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

  // Открытие спора участником заказа — см. OrdersService.openDispute
  // (это staff-модуль, а открывать спор может любой участник сделки,
  // поэтому сама операция создания живёт в OrdersModule).

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
}
