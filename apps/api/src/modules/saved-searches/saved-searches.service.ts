import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSavedSearchDto } from './dto/create-saved-search.dto';

export const MAX_SAVED_SEARCHES_PER_USER = 5;

@Injectable()
export class SavedSearchesService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.savedSearch.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
  }

  async create(userId: string, dto: CreateSavedSearchDto) {
    const count = await this.prisma.savedSearch.count({ where: { userId } });
    if (count >= MAX_SAVED_SEARCHES_PER_USER) {
      throw new BadRequestException(`Можно сохранить не больше ${MAX_SAVED_SEARCHES_PER_USER} подписок на заказы`);
    }

    return this.prisma.savedSearch.create({
      data: {
        userId,
        label: dto.label,
        categoryId: dto.categoryId,
        tags: dto.tags ?? [],
        minBudget: dto.minBudget,
      },
    });
  }

  async delete(userId: string, id: string) {
    const search = await this.prisma.savedSearch.findFirst({ where: { id, userId } });
    if (!search) throw new NotFoundException('Saved search not found');

    await this.prisma.savedSearch.delete({ where: { id } });
    return { deleted: true };
  }
}
