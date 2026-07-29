import { SearchService } from '../search.service';

describe('SearchService', () => {
  let service: SearchService;
  let ordersService: any;
  let usersService: any;

  beforeEach(() => {
    ordersService = {
      findMany: jest.fn().mockResolvedValue([]),
    };
    usersService = {
      findFreelancers: jest.fn().mockResolvedValue([]),
    };

    service = new SearchService(ordersService, usersService);
  });

  it('возвращает пустые массивы без запросов к сервисам, если поисковая строка короче 2 символов', async () => {
    const res = await service.search('a');

    expect(res).toEqual({ orders: [], freelancers: [] });
    expect(ordersService.findMany).not.toHaveBeenCalled();
    expect(usersService.findFreelancers).not.toHaveBeenCalled();
  });

  it('выполняет параллельный поиск и обрезает результаты до 10 элементов для каждого списка', async () => {
    const mockOrders = Array.from({ length: 15 }, (_, i) => ({ id: `ord-${i}` }));
    const mockFreelancers = Array.from({ length: 12 }, (_, i) => ({ id: `free-${i}` }));

    ordersService.findMany.mockResolvedValue(mockOrders);
    usersService.findFreelancers.mockResolvedValue(mockFreelancers);

    const res = await service.search('react');

    expect(res.orders).toHaveLength(10);
    expect(res.freelancers).toHaveLength(10);
    expect(ordersService.findMany).toHaveBeenCalledWith({ search: 'react' });
    expect(usersService.findFreelancers).toHaveBeenCalledWith({ search: 'react' });
  });
});
