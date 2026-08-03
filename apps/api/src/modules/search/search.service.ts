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

  /**
   * Для автокомплита в шапке (Codex, CODEX_CLAUDE_SYNC.md Request 003) —
   * лёгкий запрос без searchLog-записи (иначе лог засорялся бы на каждый
   * keystroke) и с маленькими лимитами на группу, чтобы укладываться в
   * бюджет ~150мс на локальных данных.
   */
  async suggest(query: string) {
    const trimmed = query.trim();
    if (trimmed.length < 1) {
      return { orders: [], skills: [], categories: [], freelancers: [] };
    }

    const [orders, skills, categories, freelancers] = await Promise.all([
      this.prisma.order.findMany({
        where: { status: 'OPEN', title: { contains: trimmed, mode: 'insensitive' }, client: { isStaff: false } },
        select: { id: true, title: true },
        take: 5,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.skill.findMany({
        where: { name: { contains: trimmed, mode: 'insensitive' } },
        select: { id: true, name: true, slug: true },
        take: 5,
      }),
      this.prisma.category.findMany({
        where: { name: { contains: trimmed, mode: 'insensitive' } },
        select: { id: true, name: true, slug: true },
        take: 5,
      }),
      this.usersService.findFreelancers({ search: trimmed }),
    ]);

    return {
      orders: orders.map((o) => ({ id: o.id, title: o.title })),
      skills,
      categories,
      freelancers: freelancers.slice(0, 5).map((f: any) => ({
        id: f.id,
        displayName: f.profile?.displayName ?? f.email,
        avatarUrl: f.profile?.avatarUrl ?? null,
      })),
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
