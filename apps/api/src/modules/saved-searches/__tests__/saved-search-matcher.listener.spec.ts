import { SavedSearchMatcherListener } from '../saved-search-matcher.listener';
import { DomainEventName } from '@taskhunt/shared-types';

function baseOrder(overrides: Partial<any> = {}) {
  return {
    id: 'order-1',
    clientId: 'client-1',
    categoryId: 'cat-1',
    title: 'Нужен сайт на React',
    tags: ['React', 'Node.js'],
    budgetMin: 100,
    budgetMax: 500,
    ...overrides,
  };
}

describe('SavedSearchMatcherListener', () => {
  let prisma: any;
  let notifications: any;
  let listener: SavedSearchMatcherListener;

  beforeEach(() => {
    prisma = {
      order: { findUnique: jest.fn() },
      savedSearch: { findMany: jest.fn(), updateMany: jest.fn() },
    };
    notifications = { createForUser: jest.fn().mockResolvedValue(undefined) };
    listener = new SavedSearchMatcherListener(prisma, notifications);
  });

  function fireEvent(orderId = 'order-1') {
    return listener.handleOrderCreated({
      name: DomainEventName.OrderCreated,
      occurredAt: new Date().toISOString(),
      payload: { orderId, clientId: 'client-1', categoryId: 'cat-1', budgetMin: 100, budgetMax: 500 },
    } as any);
  }

  it('ничего не делает, если заказ не найден (событие устарело/гонка)', async () => {
    prisma.order.findUnique.mockResolvedValue(null);
    await fireEvent();
    expect(prisma.savedSearch.findMany).not.toHaveBeenCalled();
  });

  it('исключает заказчика из кандидатов через userId: not в запросе', async () => {
    prisma.order.findUnique.mockResolvedValue(baseOrder());
    prisma.savedSearch.findMany.mockResolvedValue([]);

    await fireEvent();

    const call = prisma.savedSearch.findMany.mock.calls[0][0];
    expect(call.where.userId).toEqual({ not: 'client-1' });
  });

  it('не совпадает, если тэги фильтра не пересекаются с тэгами заказа', async () => {
    prisma.order.findUnique.mockResolvedValue(baseOrder({ tags: ['Python'] }));
    prisma.savedSearch.findMany.mockResolvedValue([
      { id: 'search-1', userId: 'user-1', label: 'React', tags: ['React'], minBudget: null },
    ]);

    await fireEvent();

    expect(notifications.createForUser).not.toHaveBeenCalled();
    expect(prisma.savedSearch.updateMany).not.toHaveBeenCalled();
  });

  it('не совпадает, если бюджет заказа ниже минимума фильтра', async () => {
    prisma.order.findUnique.mockResolvedValue(baseOrder({ tags: [], budgetMax: 50, budgetMin: 20 }));
    prisma.savedSearch.findMany.mockResolvedValue([
      { id: 'search-1', userId: 'user-1', label: 'Дорогие заказы', tags: [], minBudget: 200 },
    ]);

    await fireEvent();

    expect(notifications.createForUser).not.toHaveBeenCalled();
  });

  it('отправляет одно уведомление на юзера, даже если совпало несколько его подписок', async () => {
    prisma.order.findUnique.mockResolvedValue(baseOrder());
    prisma.savedSearch.findMany.mockResolvedValue([
      { id: 'search-1', userId: 'user-1', label: 'React-заказы', tags: ['React'], minBudget: null },
      { id: 'search-2', userId: 'user-1', label: 'Node-заказы', tags: ['Node.js'], minBudget: null },
      { id: 'search-3', userId: 'user-2', label: 'Всё подряд', tags: [], minBudget: null },
    ]);

    await fireEvent();

    expect(notifications.createForUser).toHaveBeenCalledTimes(2);
    const userIds = notifications.createForUser.mock.calls.map((c: any) => c[0].userId);
    expect(userIds.sort()).toEqual(['user-1', 'user-2']);

    const user1Call = notifications.createForUser.mock.calls.find((c: any) => c[0].userId === 'user-1')[0];
    expect(user1Call.message).toContain('React-заказы');
    expect(user1Call.message).toContain('Node-заказы');

    expect(prisma.savedSearch.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['search-1', 'search-2', 'search-3'] } },
      data: { lastMatchedAt: expect.any(Date) },
    });
  });

  it('продолжает уведомлять остальных юзеров, если создание одного уведомления упало', async () => {
    prisma.order.findUnique.mockResolvedValue(baseOrder());
    prisma.savedSearch.findMany.mockResolvedValue([
      { id: 'search-1', userId: 'user-1', label: 'A', tags: [], minBudget: null },
      { id: 'search-2', userId: 'user-2', label: 'B', tags: [], minBudget: null },
    ]);
    notifications.createForUser.mockRejectedValueOnce(new Error('db down')).mockResolvedValueOnce(undefined);

    await fireEvent();

    expect(notifications.createForUser).toHaveBeenCalledTimes(2);
    expect(prisma.savedSearch.updateMany).toHaveBeenCalled();
  });
});
