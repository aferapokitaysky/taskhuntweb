import { SearchService } from '../search.service';

describe('SearchService', () => {
  let service: SearchService;
  let ordersService: any;
  let usersService: any;

  beforeEach(() => {
    ordersService = {
      findMany: jest.fn().mockResolvedValue({ items: [], total: 0, page: 1, limit: 10, hasMore: false }),
    };
    usersService = {
      findFreelancers: jest.fn().mockResolvedValue([]),
    };

    const prisma = {
      searchLog: {
        create: jest.fn().mockResolvedValue({ id: '1' }),
        groupBy: jest.fn().mockResolvedValue([]),
      },
    };

    service = new SearchService(prisma as any, ordersService, usersService);
  });

  it('возвращает пустые массивы без запросов к сервисам, если поисковая строка короче 2 символов', async () => {
    const res = await service.search('a');

    expect(res).toEqual({ orders: [], freelancers: [] });
    expect(ordersService.findMany).not.toHaveBeenCalled();
    expect(usersService.findFreelancers).not.toHaveBeenCalled();
  });

  it('выполняет параллельный поиск, заказы уже обрезаны до 10 на уровне OrdersService.findMany (limit)', async () => {
    // Обрезка списка заказов теперь на стороне OrdersService (limit в
    // запросе), не в SearchService — мок отдаёт уже готовую страницу.
    const mockOrders = Array.from({ length: 10 }, (_, i) => ({ id: `ord-${i}` }));
    const mockFreelancers = Array.from({ length: 12 }, (_, i) => ({ id: `free-${i}` }));

    ordersService.findMany.mockResolvedValue({ items: mockOrders, total: 15, page: 1, limit: 10, hasMore: true });
    usersService.findFreelancers.mockResolvedValue(mockFreelancers);

    const res = await service.search('react');

    expect(res.orders).toHaveLength(10);
    expect(res.freelancers).toHaveLength(10);
    expect(ordersService.findMany).toHaveBeenCalledWith({ search: 'react', limit: 10 });
    expect(usersService.findFreelancers).toHaveBeenCalledWith({ search: 'react' });
  });
});
