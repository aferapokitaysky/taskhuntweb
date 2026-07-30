import { Controller, ForbiddenException, Get, NotFoundException, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { MatchingService } from './matching.service';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Публичный неймспейс матчинга (CODEX_CLAUDE_SYNC.md Request 004) —
 * explainable-ранжирование уже считает MatchingService (используется
 * внутри /freelancers/me/recommended-orders и
 * /orders/:id/recommended-freelancers), этот контроллер даёт фронту
 * стабильные `/matching/*` пути под то же самое. Owner-проверка для
 * freelancers-роута продублирована из OrdersService.getRankedBids (не
 * инжектим OrdersModule сюда, чтобы не заводить цикл MatchingModule <->
 * OrdersModule — OrdersModule и так импортирует MatchingModule).
 */
@Controller('matching')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MatchingController {
  constructor(
    private readonly matchingService: MatchingService,
    private readonly prisma: PrismaService,
  ) {}

  @Roles('FREELANCER')
  @Get('orders')
  matchOrders(@CurrentUser() user: AuthenticatedUser, @Query('limit') limit?: string) {
    const parsedLimit = limit ? Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50) : 20;
    return this.matchingService.recommendOrdersForFreelancer(user.id, parsedLimit);
  }

  @Roles('CLIENT')
  @Get('freelancers')
  async matchFreelancers(@CurrentUser() user: AuthenticatedUser, @Query('orderId') orderId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.clientId !== user.id) throw new ForbiddenException('Not your order');
    return this.matchingService.rankBidsForOrder(orderId);
  }
}
