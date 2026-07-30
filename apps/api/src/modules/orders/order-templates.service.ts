import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateOrderTemplateDto, OrderTemplateFrequency } from './dto/create-order-template.dto';
import { UpdateOrderTemplateDto } from './dto/update-order-template.dto';

@Injectable()
export class OrderTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(clientId: string, dto: CreateOrderTemplateDto) {
    const category = await this.prisma.category.findUnique({ where: { id: dto.categoryId } });
    if (!category) throw new NotFoundException('Category not found');

    const now = new Date();
    const nextRunAt = new Date(
      now.getTime() + (dto.frequency === OrderTemplateFrequency.WEEKLY ? 7 : 30) * 24 * 60 * 60 * 1000,
    );

    return this.prisma.orderTemplate.create({
      data: {
        clientId,
        categoryId: dto.categoryId,
        title: dto.title,
        description: dto.description,
        budgetMin: dto.budgetMin,
        budgetMax: dto.budgetMax ?? null,
        tags: dto.tags ?? [],
        frequency: dto.frequency,
        nextRunAt,
        active: true,
      },
    });
  }

  async list(clientId: string) {
    return this.prisma.orderTemplate.findMany({
      where: { clientId },
      include: { category: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(clientId: string, id: string, dto: UpdateOrderTemplateDto) {
    const template = await this.prisma.orderTemplate.findUnique({ where: { id } });
    if (!template) throw new NotFoundException('Order template not found');
    if (template.clientId !== clientId) throw new ForbiddenException('Not your template');

    // Явный whitelist полей вместо спреда dto — второй рубеж защиты поверх
    // DTO-валидации (см. историю бага в комментарии к UpdateOrderTemplateDto):
    // даже если у ValidationPipe снова появится дыра для какого-то параметра,
    // здесь физически невозможно записать что-то кроме этих четырёх полей.
    return this.prisma.orderTemplate.update({
      where: { id, clientId },
      data: {
        active: dto.active,
        frequency: dto.frequency,
        title: dto.title,
        description: dto.description,
      },
    });
  }

  async remove(clientId: string, id: string) {
    const template = await this.prisma.orderTemplate.findUnique({ where: { id } });
    if (!template) throw new NotFoundException('Order template not found');
    if (template.clientId !== clientId) throw new ForbiddenException('Not your template');

    await this.prisma.orderTemplate.delete({ where: { id } });
    return { success: true };
  }
}
