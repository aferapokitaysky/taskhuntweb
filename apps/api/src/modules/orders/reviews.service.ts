import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(authorId: string, orderId: string, dto: CreateReviewDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { bids: { where: { status: 'ACCEPTED' } } },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status !== 'COMPLETED') {
      throw new BadRequestException('Reviews are only allowed after the order is completed');
    }

    const acceptedFreelancerId = order.bids[0]?.freelancerId;
    let targetId: string;
    if (order.clientId === authorId) {
      if (!acceptedFreelancerId) throw new BadRequestException('No freelancer to review on this order');
      targetId = acceptedFreelancerId;
    } else if (acceptedFreelancerId === authorId) {
      targetId = order.clientId;
    } else {
      throw new ForbiddenException('Not a participant of this order');
    }

    const existing = await this.prisma.review.findUnique({
      where: { orderId_authorId: { orderId, authorId } },
    });
    if (existing) throw new BadRequestException('You already left a review for this order');

    const review = await this.prisma.review.create({
      data: { orderId, authorId, targetId, rating: dto.rating, comment: dto.comment },
    });

    // Обновляем агрегаты профиля упрощённо — пересчёт среднего рейтинга/метрик
    // (successRate, completionRate и т.д.) полноценно делается фоновой
    // задачей в Phase 2; здесь просто счётчик отзывов не хранится отдельно,
    // среднее считается на лету при чтении профиля.

    return review;
  }

  async listForUser(userId: string) {
    return this.prisma.review.findMany({
      where: { targetId: userId },
      include: { author: { include: { profile: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
