import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CatalogService } from '../catalog.service';

describe('CatalogService', () => {
  let prisma: any;
  let service: CatalogService;

  beforeEach(() => {
    prisma = {
      skill: { findFirst: jest.fn(), create: jest.fn() },
    };
    service = new CatalogService(prisma);
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
        .mockResolvedValueOnce(null) // первичный поиск — ничего не нашли
        .mockResolvedValueOnce({ id: 'skill-3', name: 'Rust', slug: 'rust' }); // после конфликта — нашли то, что создал конкурент

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
