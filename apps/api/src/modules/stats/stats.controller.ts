import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SearchService } from '../search/search.service';
import { MatchingService } from '../matching/matching.service';

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
  private homeFeedCache: { data: unknown; expiresAt: number } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly searchService: SearchService,
    private readonly matchingService: MatchingService,
  ) {}

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

  // Тонкий алиас над SearchService.getTrending() под путём, который просит
  // CodexTZ 023.006 — сама логика/searchLog-агрегация не дублируется.
  @Get('trending-searches')
  getTrendingSearches() {
    return this.searchService.getTrending();
  }

  /**
   * Один запрос для главной страницы (CodexTZ 005.014/005.016, 023.007) —
   * без него лендингу пришлось бы делать 3 отдельных похода (заказы,
   * категории, статистика) до первой отрисовки.
   */
  @Get('home-feed')
  async getHomeFeed() {
    if (this.homeFeedCache && this.homeFeedCache.expiresAt > Date.now()) {
      return this.homeFeedCache.data;
    }

    const [recentOpenOrders, categories, openOrdersByCategory, stats] = await Promise.all([
      this.prisma.order.findMany({
        where: { status: 'OPEN' },
        include: { category: true, _count: { select: { bids: true } } },
        orderBy: { createdAt: 'desc' },
        take: 60,
      }),
      this.prisma.category.findMany({
        where: { parentId: null },
        select: { id: true, name: true, slug: true },
      }),
      this.prisma.order.groupBy({ by: ['categoryId'], where: { status: 'OPEN' }, _count: { _all: true } }),
      this.getStats(),
    ]);
    const openCountByCategory = new Map(openOrdersByCategory.map((row) => [row.categoryId, row._count._all]));

    const activePromotions = await this.prisma.promotion.findMany({
      where: { entityType: 'ORDER', expiresAt: { gt: new Date() }, entityId: { in: recentOpenOrders.map((o) => o.id) } },
    });
    const promotedOrderIds = new Set(activePromotions.map((p) => p.entityId));
    const withPromotion = recentOpenOrders.map((order) => ({ ...order, isPromoted: promotedOrderIds.has(order.id) }));

    const featuredOrders = this.matchingService
      .rankOrdersForFeed(withPromotion)
      .slice(0, 6)
      .map((order) => ({
        id: order.id,
        title: order.title,
        budgetMin: order.budgetMin,
        budgetMax: order.budgetMax,
        currency: order.currency,
        category: order.category ? { id: order.category.id, name: order.category.name, slug: order.category.slug } : null,
        bidsCount: order._count.bids,
        isPromoted: order.isPromoted,
      }));

    const topCategories = categories
      .map((c) => ({ id: c.id, name: c.name, slug: c.slug, openOrdersCount: openCountByCategory.get(c.id) ?? 0 }))
      .sort((a, b) => b.openOrdersCount - a.openOrdersCount)
      .slice(0, 8);

    const data = { featuredOrders, topCategories, stats };
    this.homeFeedCache = { data, expiresAt: Date.now() + CACHE_TTL_MS };
    return data;
  }
}
