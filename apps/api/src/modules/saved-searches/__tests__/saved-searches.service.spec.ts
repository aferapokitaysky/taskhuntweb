import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SavedSearchesService, MAX_SAVED_SEARCHES_PER_USER } from '../saved-searches.service';

describe('SavedSearchesService', () => {
  let prisma: any;
  let service: SavedSearchesService;

  beforeEach(() => {
    prisma = {
      savedSearch: {
        count: jest.fn(),
        create: jest.fn(),
        findFirst: jest.fn(),
        delete: jest.fn(),
        findMany: jest.fn(),
      },
    };
    service = new SavedSearchesService(prisma);
  });

  describe('create', () => {
    it(`бросает BadRequestException при достижении лимита в ${MAX_SAVED_SEARCHES_PER_USER} подписок`, async () => {
      prisma.savedSearch.count.mockResolvedValue(MAX_SAVED_SEARCHES_PER_USER);

      await expect(service.create('user-1', { label: 'React заказы' })).rejects.toThrow(BadRequestException);
      expect(prisma.savedSearch.create).not.toHaveBeenCalled();
    });

    it('создаёт подписку с дефолтным пустым массивом тэгов', async () => {
      prisma.savedSearch.count.mockResolvedValue(0);
      prisma.savedSearch.create.mockImplementation(({ data }: any) => Promise.resolve({ id: 'search-1', ...data }));

      const result = await service.create('user-1', { label: 'React заказы' });

      expect(prisma.savedSearch.create).toHaveBeenCalledWith({
        data: { userId: 'user-1', label: 'React заказы', categoryId: undefined, tags: [], minBudget: undefined },
      });
      expect(result.id).toBe('search-1');
    });
  });

  describe('delete', () => {
    it('бросает NotFoundException при попытке удалить чужую или несуществующую подписку', async () => {
      prisma.savedSearch.findFirst.mockResolvedValue(null);
      await expect(service.delete('user-1', 'search-999')).rejects.toThrow(NotFoundException);
      expect(prisma.savedSearch.delete).not.toHaveBeenCalled();
    });

    it('удаляет подписку владельца', async () => {
      prisma.savedSearch.findFirst.mockResolvedValue({ id: 'search-1', userId: 'user-1' });
      const result = await service.delete('user-1', 'search-1');
      expect(prisma.savedSearch.delete).toHaveBeenCalledWith({ where: { id: 'search-1' } });
      expect(result).toEqual({ deleted: true });
    });
  });
});
