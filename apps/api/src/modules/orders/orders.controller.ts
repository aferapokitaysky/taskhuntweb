import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { OrdersService } from './orders.service';
import { MilestonesService } from './milestones.service';
import { ReviewsService } from './reviews.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { CreateBidDto } from './dto/create-bid.dto';
import { CreateMilestoneDto } from './dto/create-milestone.dto';
import { DeliverWorkDto } from './dto/deliver-work.dto';
import { CreateReviewDto } from './dto/create-review.dto';

@Controller('orders')
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly milestonesService: MilestonesService,
    private readonly reviewsService: ReviewsService,
  ) {}

  @Get()
  findMany(
    @Query('categoryId') categoryId?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.ordersService.findMany({ categoryId, status, search });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ordersService.findOne(id);
  }

  // Ранжированные отклики ("Best Match") — видит только заказчик этого заказа,
  // в откликах видны суммы бидов, это не публичные данные.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CLIENT')
  @Get(':id/recommended-freelancers')
  getRecommendedFreelancers(@CurrentUser() user: AuthenticatedUser, @Param('id') orderId: string) {
    return this.ordersService.getRankedBids(user.id, orderId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CLIENT')
  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateOrderDto) {
    return this.ordersService.create(user.id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CLIENT')
  @Patch(':id')
  update(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateOrderDto) {
    return this.ordersService.update(user.id, id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('FREELANCER')
  @Post(':id/bids')
  submitBid(@CurrentUser() user: AuthenticatedUser, @Param('id') orderId: string, @Body() dto: CreateBidDto) {
    return this.ordersService.submitBid(user.id, orderId, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CLIENT')
  @Post(':id/bids/:bidId/accept')
  acceptBid(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') orderId: string,
    @Param('bidId') bidId: string,
  ) {
    return this.ordersService.acceptBid(user.id, orderId, bidId);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/disputes')
  openDispute(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') orderId: string,
    @Body('reason') reason: string,
  ) {
    return this.ordersService.openDispute(user.id, orderId, reason);
  }

  // --- Milestones ---

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CLIENT')
  @Post(':id/milestones')
  createMilestone(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') orderId: string,
    @Body() dto: CreateMilestoneDto,
  ) {
    return this.milestonesService.create(user.id, orderId, dto);
  }

  @Get(':id/milestones')
  listMilestones(@Param('id') orderId: string) {
    return this.milestonesService.list(orderId);
  }

  // --- Delivery (сдача работы) ---
  // Без milestoneId — сдача заказа целиком, если этапы не заводили.

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('FREELANCER')
  @Post(':id/deliver')
  deliverOrder(@CurrentUser() user: AuthenticatedUser, @Param('id') orderId: string, @Body() dto: DeliverWorkDto) {
    return this.milestonesService.deliver(user.id, orderId, null, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('FREELANCER')
  @Post(':id/milestones/:milestoneId/deliver')
  deliverMilestone(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') orderId: string,
    @Param('milestoneId') milestoneId: string,
    @Body() dto: DeliverWorkDto,
  ) {
    return this.milestonesService.deliver(user.id, orderId, milestoneId, dto);
  }

  // --- Approve (приёмка работы клиентом — двигает эскроу) ---

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CLIENT')
  @Post(':id/approve')
  approveOrder(@CurrentUser() user: AuthenticatedUser, @Param('id') orderId: string) {
    return this.milestonesService.approve(user.id, orderId, null);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CLIENT')
  @Post(':id/milestones/:milestoneId/approve')
  approveMilestone(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') orderId: string,
    @Param('milestoneId') milestoneId: string,
  ) {
    return this.milestonesService.approve(user.id, orderId, milestoneId);
  }

  // --- Reviews ---

  @UseGuards(JwtAuthGuard)
  @Post(':id/reviews')
  createReview(@CurrentUser() user: AuthenticatedUser, @Param('id') orderId: string, @Body() dto: CreateReviewDto) {
    return this.reviewsService.create(user.id, orderId, dto);
  }

  @Get('reviews/:userId')
  listReviewsForUser(@Param('userId') userId: string) {
    return this.reviewsService.listForUser(userId);
  }
}
