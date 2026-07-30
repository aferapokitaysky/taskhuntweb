import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

interface PublicStats {
  totalOrders: number;
  totalFreelancers: number;
  totalEscrowVolume: string;
}

const CACHE_TTL_MS = 5 * 60 * 1000;

// Публичный, без авторизации — три цифры соцдоказательства для лендинга.
// Не путать с /admin/metrics (авторизованная детальная аналитика).
@Controller('public')
export class StatsController {
  private cached: { data: PublicStats; expiresAt: number } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  @Get('stats')
  async getStats(): Promise<PublicStats> {
    if (this.cached && this.cached.expiresAt > Date.now()) {
      return this.cached.data;
    }

    const [totalOrders, totalFreelancers, escrowVolume] = await Promise.all([
      this.prisma.order.count(),
      this.prisma.user.count({ where: { OR: [{ primaryRole: 'FREELANCER' }, { roles: { has: 'FREELANCER' } }] } }),
      this.prisma.ledgerEntry.aggregate({
        where: { balanceType: 'ESCROW', direction: 'CREDIT' },
        _sum: { amount: true },
      }),
    ]);

    const data: PublicStats = {
      totalOrders,
      totalFreelancers,
      totalEscrowVolume: (escrowVolume._sum.amount ?? 0).toString(),
    };

    this.cached = { data, expiresAt: Date.now() + CACHE_TTL_MS };
    return data;
  }
}
