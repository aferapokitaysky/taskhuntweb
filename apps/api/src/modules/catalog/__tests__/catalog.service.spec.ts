import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CatalogService } from '../catalog.service';

describe('CatalogService', () => {
  let prisma: any;
  let service: CatalogService;

  beforeEach(() => {
    prisma = {
      skill: { findFirst: jest.fn(), create: jest.fn(), findMany: jest.fn() },
      category: { findMany: jest.fn() },
      order: { groupBy: jest.fn() },
      profileSkill: { groupBy: jest.fn() },
    };
    service = new CatalogService(prisma);
  });

  describe('listCategories', () => {
    it('обогащает категории и подкатегории показателем orderCount', async () => {
      prisma.category.findMany.mockResolvedValue([
        {
          id: 'cat-1',
          name: 'Development',
          parentId: null,
          children: [{ id: 'cat-11', name: 'Frontend' }],
        },
      ]);
      prisma.order.groupBy.mockResolvedValue([
        { categoryId: 'cat-11', _count: { id: 3 } },
      ]);

      const res = await service.listCategories();

      expect(res[0].orderCount).toBe(0);
      expect(res[0].children[0].orderCount).toBe(3);
    });
  });

  describe('listSkills', () => {
    it('обогащает навыки показателем usageCount из ProfileSkill', async () => {
      prisma.skill.findMany.mockResolvedValue([
        { id: 'skill-1', name: 'React' },
        { id: 'skill-2', name: 'Vue' },
      ]);
      prisma.profileSkill.groupBy.mockResolvedValue([
        { skillId: 'skill-1', _count: { skillId: 5 } },
      ]);

      const res = await service.listSkills();

      expect(res[0].usageCount).toBe(5);
      expect(res[1].usageCount).toBe(0);
    });
  });

  describe('findOrCreateSkill', () => {
    it('возвращает существующий навык без учёта регистра, не создавая дубль', async () => {
      prisma.skill.findFirst.mockResolvedValue({ id: 'skill-1', name: 'React', slug: 'react' });

      const result = await service.findOrCreateSkill('react');

      expect(result).toEqual({ id: 'skill-1', name: 'React', slug: 'react' });
      expect(prisma.skill.create).not.toHaveBeenCalled();
    });

    it('создаёт новый навык, если совпадений нет', async () => {
      prisma.skill.findFirst.mockResolvedValue(null);
      prisma.skill.create.mockResolvedValue({ id: 'skill-2', name: 'Figma Plugins', slug: 'figma-plugins' });

      const result = await service.findOrCreateSkill('  Figma   Plugins  ');

      expect(prisma.skill.create).toHaveBeenCalledWith({ data: { name: 'Figma Plugins', slug: 'figma-plugins' } });
      expect(result).toEqual({ id: 'skill-2', name: 'Figma Plugins', slug: 'figma-plugins' });
    });

    it('отклоняет название без букв и цифр (пустой slug)', async () => {
      prisma.skill.findFirst.mockResolvedValue(null);

      await expect(service.findOrCreateSkill('+++')).rejects.toThrow(BadRequestException);
      expect(prisma.skill.create).not.toHaveBeenCalled();
    });

    it('при гонке параллельных запросов (P2002 по slug) возвращает запись конкурента', async () => {
      prisma.skill.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'skill-3', name: 'Rust', slug: 'rust' });

      const conflictError = new Prisma.PrismaClientKnownRequestError('Unique constraint', {
        code: 'P2002',
        clientVersion: '5.22.0',
      });
      prisma.skill.create.mockRejectedValue(conflictError);

      const result = await service.findOrCreateSkill('Rust');

      expect(result).toEqual({ id: 'skill-3', name: 'Rust', slug: 'rust' });
    });
  });
});
