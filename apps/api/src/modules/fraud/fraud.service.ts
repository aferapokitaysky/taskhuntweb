import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PermissionCode } from '@taskhunt/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateFraudFlagDto } from './dto/create-fraud-flag.dto';

const NOTIFY_SEVERITIES = new Set(['HIGH', 'CRITICAL']);

@Injectable()
export class FraudService {
  private readonly logger = new Logger(FraudService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Принимает результат скоринга от fraud-service. Никогда не блокирует и
   * не откатывает деньги сама — это осознанное решение: автоматическая
   * заморозка эскроу по эвристике с фиксированными порогами слишком легко
   * ловит ложные срабатывания (у нового клиента с маленьким заказом и так
   * будет высокий riskScore просто по возрасту аккаунта). Вместо этого —
   * флаг в очередь разбора + уведомление живому staff с правом fraud.review
   * на HIGH/CRITICAL, решение всегда принимает человек.
   */
  async createFlag(dto: CreateFraudFlagDto) {
    const flag = await this.prisma.fraudFlag.create({
      data: {
        eventName: dto.eventName,
        userId: dto.userId,
        orderId: dto.orderId,
        riskScore: dto.riskScore,
        severity: dto.severity,
        reasons: dto.reasons,
      },
    });

    if (NOTIFY_SEVERITIES.has(dto.severity)) {
      await this.notifyReviewers(flag);
    }

    return flag;
  }

  private async notifyReviewers(flag: { id: string; eventName: string; riskScore: number; severity: string }) {
    const reviewers = await this.prisma.user.findMany({
      where: {
        isStaff: true,
        staffRoles: { some: { role: { permissions: { some: { permission: { code: PermissionCode.FraudReview } } } } } },
      },
      select: { id: true },
    });

    if (reviewers.length === 0) {
      this.logger.warn(`FraudFlag ${flag.id} (${flag.severity}) created but no staff has fraud.review permission to notify`);
      return;
    }

    await this.prisma.notification.createMany({
      data: reviewers.map((r) => ({
        userId: r.id,
        title: `Фрод-флаг: ${flag.severity}`,
        message: `Событие "${flag.eventName}", риск-скор ${flag.riskScore}/100. Требует разбора.`,
        eventName: 'FraudFlagCreated',
      })),
    });
  }

  async list(filters: { status?: string; severity?: string; userId?: string; cursor?: string; limit?: number }) {
    const take = filters.limit ? Number(filters.limit) : 20;

    const items = await this.prisma.fraudFlag.findMany({
      where: {
        status: (filters.status as any) ?? undefined,
        severity: (filters.severity as any) ?? undefined,
        userId: filters.userId ?? undefined,
      },
      include: {
        user: { include: { profile: true } },
        order: { select: { id: true, title: true } },
      },
      take: take + 1,
      cursor: filters.cursor ? { id: filters.cursor } : undefined,
      skip: filters.cursor ? 1 : 0,
      orderBy: [{ createdAt: 'desc' }],
    });

    let nextCursor: string | null = null;
    if (items.length > take) {
      const nextItem = items.pop();
      nextCursor = nextItem?.id ?? null;
    }

    return { items, nextCursor };
  }

  async updateStatus(id: string, staffId: string, status: 'REVIEWED' | 'DISMISSED' | 'CONFIRMED', note?: string) {
    const flag = await this.prisma.fraudFlag.findUnique({ where: { id } });
    if (!flag) throw new NotFoundException('Fraud flag not found');

    return this.prisma.fraudFlag.update({
      where: { id },
      data: { status, reviewNote: note, reviewedById: staffId, reviewedAt: new Date() },
    });
  }
}
