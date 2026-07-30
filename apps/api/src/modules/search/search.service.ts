import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OrdersService } from '../orders/orders.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ordersService: OrdersService,
    private readonly usersService: UsersService,
  ) {}

  async search(query: string) {
    if (!query || query.trim().length < 2) {
      return { orders: [], freelancers: [] };
    }

    const trimmed = query.trim();

    // Fire-and-forget logging to search_logs
    this.prisma.searchLog
      .create({
        data: { query: trimmed.toLowerCase() },
      })
      .catch(() => undefined);

    const [ordersPage, freelancers] = await Promise.all([
      this.ordersService.findMany({ search: trimmed, limit: 10 }),
      this.usersService.findFreelancers({ search: trimmed }),
    ]);

    return {
      orders: ordersPage.items,
      freelancers: freelancers.slice(0, 10),
    };
  }

  async getTrending() {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const logs = (await (this.prisma.searchLog as any).groupBy({
      by: ['query'],
      where: { createdAt: { gte: sevenDaysAgo } },
      _count: { query: true },
      orderBy: { _count: { query: 'desc' } },
      take: 10,
    })) as Array<{ query: string; _count: { query: number } }>;

    return logs.map((item) => ({
      query: item.query,
      count: item._count?.query ?? 0,
    }));
  }
}
