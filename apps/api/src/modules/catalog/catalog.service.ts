import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}-]+/gu, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async listCategories() {
    const [categories, orderCounts] = await Promise.all([
      this.prisma.category.findMany({
        where: { parentId: null },
        include: { children: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.order.groupBy({
        by: ['categoryId'],
        where: { status: 'OPEN' },
        _count: { id: true },
      }),
    ]);

    const countMap = new Map<string, number>();
    for (const group of orderCounts) {
      countMap.set(group.categoryId, group._count.id);
    }

    return categories.map((parent) => ({
      ...parent,
      orderCount: countMap.get(parent.id) ?? 0,
      children: parent.children.map((child) => ({
        ...child,
        orderCount: countMap.get(child.id) ?? 0,
      })),
    }));
  }

  async listSkills() {
    const [skills, usageCounts] = await Promise.all([
      this.prisma.skill.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.profileSkill.groupBy({
        by: ['skillId'],
        _count: { skillId: true },
      }),
    ]);

    const countMap = new Map<string, number>();
    for (const group of usageCounts) {
      countMap.set(group.skillId, group._count.skillId);
    }

    return skills.map((skill) => ({
      ...skill,
      usageCount: countMap.get(skill.id) ?? 0,
    }));
  }

  /**
   * Пользовательские навыки (не только из каталога, который наполняет
   * админ) — фрилансер может вписать своё. Чтобы это не превратилось в
   * дыру для спама/DoS по таблице skills: 1) только для авторизованных
   * (см. guard в контроллере), 2) отдельный жёсткий throttle там же,
   * 3) find-or-create по имени без учёта регистра — "React"/"react"/
   * "REACT" схлопываются в одну запись, а не плодят дубли, 4) обвязка
   * updateProfile сверху ограничивает число навыков на профиль.
   */
  async findOrCreateSkill(rawName: string) {
    const name = rawName.trim().replace(/\s+/g, ' ');

    const existing = await this.prisma.skill.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
    });
    if (existing) return existing;

    const baseSlug = slugify(name);
    if (!baseSlug) {
      throw new BadRequestException('Название навыка должно содержать буквы или цифры');
    }

    for (let attempt = 0; attempt < 5; attempt++) {
      const slug = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`;
      try {
        return await this.prisma.skill.create({ data: { name, slug } });
      } catch (err) {
        // P2002 = unique constraint violation — либо slug, либо name (гонка
        // двух параллельных запросов с одинаковым названием); в обоих
        // случаях повторный поиск по имени найдёт запись, которую только
        // что создал конкурентный запрос.
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          const race = await this.prisma.skill.findFirst({ where: { name: { equals: name, mode: 'insensitive' } } });
          if (race) return race;
          continue;
        }
        throw err;
      }
    }
    throw new BadRequestException('Не удалось создать навык, попробуйте другое название');
  }
}
