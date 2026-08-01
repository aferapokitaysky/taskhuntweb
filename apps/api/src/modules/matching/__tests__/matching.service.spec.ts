import { MatchingService } from '../matching.service';

describe('MatchingService', () => {
  let prisma: any;
  let service: MatchingService;
  const now = new Date('2026-07-29T12:00:00.000Z');

  beforeEach(() => {
    prisma = {
      bid: { findMany: jest.fn() },
      onboardingResponse: { findUnique: jest.fn() },
      order: { findMany: jest.fn(), findUniqueOrThrow: jest.fn() },
      portfolioItem: { count: jest.fn().mockResolvedValue(0) },
      profile: { findUnique: jest.fn() },
    };
    service = new MatchingService(prisma);
  });

  describe('rankOrdersForFeed', () => {
    it('промо-заказ не перебивает намного более свежий органический заказ (потолок буста)', () => {
      const result = service.rankOrdersForFeed(
        [
          {
            id: 'stale-promoted',
            createdAt: new Date(now.getTime() - 200 * 60 * 60 * 1000), // 200ч назад
            deadline: null,
            budgetMax: null,
            isPromoted: true,
          },
          {
            id: 'fresh-organic',
            createdAt: new Date(now.getTime() - 1 * 60 * 60 * 1000), // 1ч назад
            deadline: null,
            budgetMax: 500,
            isPromoted: false,
          },
        ],
        now,
      );

      expect(result[0].id).toBe('fresh-organic');
    });

    it('при прочих равных промо-заказ идёт выше органического', () => {
      const result = service.rankOrdersForFeed(
        [
          { id: 'normal', createdAt: now, deadline: null, budgetMax: null, isPromoted: false },
          { id: 'promoted', createdAt: now, deadline: null, budgetMax: null, isPromoted: true },
        ],
        now,
      );

      expect(result[0].id).toBe('promoted');
      expect(result[0].matchReasons).toContain('Продвигается');
    });

    it('заказ с дедлайном через день получает бонус срочности', () => {
      const result = service.rankOrdersForFeed(
        [
          { id: 'far-deadline', createdAt: now, deadline: new Date(now.getTime() + 200 * 60 * 60 * 1000), budgetMax: null, isPromoted: false },
          { id: 'urgent', createdAt: now, deadline: new Date(now.getTime() + 24 * 60 * 60 * 1000), budgetMax: null, isPromoted: false },
        ],
        now,
      );

      expect(result[0].id).toBe('urgent');
    });
  });

  describe('rankFreelancers', () => {
    it('новый фрилансер без истории не получает штраф за отсутствие данных (нейтральный балл)', () => {
      const result = service.rankFreelancers([
        {
          id: 'newbie',
          profile: { successRate: null, completionRate: null, avgResponseMins: null, disputesCount: 0, lateDeliveries: 0 },
          subscriptionTier: 'STARTER',
        },
        {
          id: 'bad-track-record',
          profile: { successRate: 20, completionRate: 20, avgResponseMins: 2000, disputesCount: 5, lateDeliveries: 5 },
          subscriptionTier: 'STARTER',
        },
      ]);

      expect(result[0].id).toBe('newbie');
    });

    it('высокий рейтинг и премиум-подписка перебивают штраф за пару поздних доставок', () => {
      const result = service.rankFreelancers([
        {
          id: 'star-performer',
          profile: { successRate: 98, completionRate: 95, avgResponseMins: 10, disputesCount: 0, lateDeliveries: 1 },
          subscriptionTier: 'PREMIUM',
        },
        {
          id: 'average',
          profile: { successRate: null, completionRate: null, avgResponseMins: null, disputesCount: 0, lateDeliveries: 0 },
          subscriptionTier: 'STARTER',
        },
      ]);

      expect(result[0].id).toBe('star-performer');
      expect(result[0].matchReasons).toContain('Активная подписка PREMIUM');
    });

    it('много споров перевешивает премиум-подписку', () => {
      const result = service.rankFreelancers([
        {
          id: 'disputed-premium',
          profile: { successRate: 50, completionRate: 50, avgResponseMins: 500, disputesCount: 6, lateDeliveries: 6 },
          subscriptionTier: 'PREMIUM',
        },
        {
          id: 'clean-starter',
          profile: { successRate: 80, completionRate: 80, avgResponseMins: 60, disputesCount: 0, lateDeliveries: 0 },
          subscriptionTier: 'STARTER',
        },
      ]);

      expect(result[0].id).toBe('clean-starter');
    });
  });

  describe('recommendOrdersForFreelancer', () => {
    it('без принятых бидов возвращает заказы без категорийного скоринга (не пустая лента)', async () => {
      prisma.bid.findMany.mockResolvedValue([]);
      prisma.onboardingResponse.findUnique.mockResolvedValue(null);
      prisma.profile.findUnique.mockResolvedValue(null);
      prisma.order.findMany.mockResolvedValue([
        { id: 'order-1', createdAt: now, deadline: null, categoryId: 'cat-1', budgetMin: 100, budgetMax: 200, tags: [] },
      ]);

      const result = await service.recommendOrdersForFreelancer('freelancer-1');

      expect(result).toHaveLength(1);
      expect(result[0].matchReasons).not.toContain('Категория, в которой вы уже успешно работали');
    });

    it('заказ в знакомой категории ранжируется выше заказа в незнакомой', async () => {
      prisma.bid.findMany.mockResolvedValue([
        { order: { categoryId: 'cat-known' } },
        { order: { categoryId: 'cat-known' } },
      ]);
      prisma.onboardingResponse.findUnique.mockResolvedValue(null);
      prisma.profile.findUnique.mockResolvedValue(null);
      prisma.order.findMany.mockResolvedValue([
        { id: 'unknown-cat', createdAt: now, deadline: null, categoryId: 'cat-unknown', budgetMin: 100, budgetMax: 200, tags: [] },
        { id: 'known-cat', createdAt: now, deadline: null, categoryId: 'cat-known', budgetMin: 100, budgetMax: 200, tags: [] },
      ]);

      const result = await service.recommendOrdersForFreelancer('freelancer-1');

      expect(result[0].id).toBe('known-cat');
    });
  });

  describe('rankBidsForOrder', () => {
    it('бид в рамках бюджета ранжируется выше более дорогого при прочих равных', async () => {
      prisma.order.findUniqueOrThrow.mockResolvedValue({
        id: 'order-1',
        categoryId: 'cat-1',
        budgetMin: 100,
        budgetMax: 200,
      });
      prisma.bid.findMany
        .mockResolvedValueOnce([
          {
            id: 'bid-cheap',
            freelancerId: 'freelancer-cheap',
            amount: 150,
            deliveryDays: 5,
            freelancer: { profile: { displayName: 'Cheap', successRate: null, completionRate: null, avgResponseMins: null, disputesCount: 0, lateDeliveries: 0 }, subscription: null },
          },
          {
            id: 'bid-expensive',
            freelancerId: 'freelancer-expensive',
            amount: 500,
            deliveryDays: 5,
            freelancer: { profile: { displayName: 'Expensive', successRate: null, completionRate: null, avgResponseMins: null, disputesCount: 0, lateDeliveries: 0 }, subscription: null },
          },
        ])
        .mockResolvedValueOnce([]); // acceptedBids lookup

      const result = await service.rankBidsForOrder('order-1');

      expect(result[0].id).toBe('freelancer-cheap');
      expect(result[0].matchReasons).toContain('Цена в рамках бюджета');
    });

    it('считает % совпадения тэгов заказа с навыками фрилансера', async () => {
      prisma.order.findUniqueOrThrow.mockResolvedValue({
        id: 'order-1',
        categoryId: 'cat-1',
        budgetMin: 100,
        budgetMax: 200,
        tags: ['React', 'Node.js'],
      });
      prisma.bid.findMany
        .mockResolvedValueOnce([
          {
            id: 'bid-1',
            freelancerId: 'freelancer-1',
            amount: 150,
            deliveryDays: 5,
            freelancer: {
              profile: {
                displayName: 'Dev',
                successRate: null,
                completionRate: null,
                avgResponseMins: null,
                disputesCount: 0,
                lateDeliveries: 0,
                skills: [{ skill: { name: 'React' } }, { skill: { name: 'Vue' } }],
              },
              subscription: null,
            },
          },
        ])
        .mockResolvedValueOnce([]);

      const result = await service.rankBidsForOrder('order-1');

      expect(result[0].compatibilityPercent).toBe(50);
    });

    it('возвращает null для compatibilityPercent, если у заказа нет тэгов', async () => {
      prisma.order.findUniqueOrThrow.mockResolvedValue({
        id: 'order-1',
        categoryId: 'cat-1',
        budgetMin: 100,
        budgetMax: 200,
        tags: [],
      });
      prisma.bid.findMany
        .mockResolvedValueOnce([
          {
            id: 'bid-1',
            freelancerId: 'freelancer-1',
            amount: 150,
            deliveryDays: 5,
            freelancer: { profile: null, subscription: null },
          },
        ])
        .mockResolvedValueOnce([]);

      const result = await service.rankBidsForOrder('order-1');

      expect(result[0].compatibilityPercent).toBeNull();
    });
  });
});
