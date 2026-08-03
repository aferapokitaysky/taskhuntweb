import { Body, Controller, Delete, Get, Header, Param, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { OrdersService } from './orders.service';
import { MilestonesService } from './milestones.service';
import { ReviewsService } from './reviews.service';
import { InvoiceService } from '../wallet/invoice.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { CreateOrderDraftDto } from './dto/create-order-draft.dto';
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
    private readonly invoiceService: InvoiceService,
  ) {}

  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  findMany(
    @CurrentUser() user: AuthenticatedUser | null,
    @Query('categoryId') categoryId?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('tags') tagsParam?: string,
    @Query('minBudget') minBudgetParam?: string,
    @Query('clientId') clientId?: string,
    @Query('page') pageParam?: string,
    @Query('limit') limitParam?: string,
  ) {
    const tags = tagsParam
      ?.split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    const minBudget = minBudgetParam !== undefined ? parseFloat(minBudgetParam) : undefined;
    const page = pageParam ? parseInt(pageParam, 10) : undefined;
    const limit = limitParam ? parseInt(limitParam, 10) : undefined;

    return this.ordersService.findMany({
      categoryId,
      status,
      search,
      tags,
      minBudget,
      clientId,
      requesterId: user?.id,
      page,
      limit,
    });
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser | null) {
    return this.ordersService.findOne(id, user?.id);
  }

  // Регистрируем ДО ':id', чтобы 'saved' не перехватился параметром — хотя
  // Nest и матчит ':id' только по одному сегменту пути, порядок здесь для
  // ясности (см. аналогичный комментарий в FreelancersController).
  @UseGuards(JwtAuthGuard)
  @Get('saved/mine')
  listSaved(@CurrentUser() user: AuthenticatedUser) {
    return this.ordersService.listSavedOrders(user.id);
  }

  // Тоже до ':id' — тот же приём, что 'saved/mine' строкой выше.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('FREELANCER')
  @Get('bids/mine')
  listMyBids(@CurrentUser() user: AuthenticatedUser) {
    return this.ordersService.listMyBids(user.id);
  }

  // Тоже до ':id' — тот же приём, что 'saved/mine' строкой выше.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CLIENT')
  @Get('drafts/mine')
  listMyDrafts(@CurrentUser() user: AuthenticatedUser) {
    return this.ordersService.listMyDrafts(user.id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CLIENT')
  @Post('drafts')
  createDraft(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateOrderDraftDto) {
    return this.ordersService.createDraft(user.id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CLIENT')
  @Post('drafts/:id/publish')
  publishDraft(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.ordersService.publishDraft(user.id, id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CLIENT')
  @Delete('drafts/:id')
  deleteDraft(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.ordersService.deleteDraft(user.id, id);
  }

  // Тоже до ':id' — тот же приём, что 'saved/mine' строкой выше.
  @UseGuards(JwtAuthGuard)
  @Get('invites/mine')
  listMyInvites(@CurrentUser() user: AuthenticatedUser) {
    return this.ordersService.listMyInvites(user.id);
  }

  // 3-сегментный путь — не конфликтует с ':id/invite' (POST, 2 сегмента)
  // выше и с ':id' catch-all роутами дальше.
  @UseGuards(JwtAuthGuard)
  @Patch('invites/:inviteId/respond')
  respondToInvite(
    @CurrentUser() user: AuthenticatedUser,
    @Param('inviteId') inviteId: string,
    @Body('accept') accept: boolean,
  ) {
    return this.ordersService.respondToInvite(user.id, inviteId, Boolean(accept));
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CLIENT')
  @Post(':id/invite')
  inviteFreelancer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') orderId: string,
    @Body('freelancerId') freelancerId: string,
  ) {
    return this.ordersService.inviteFreelancer(user.id, orderId, freelancerId);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/favorite')
  saveOrder(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.ordersService.saveOrder(user.id, id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id/favorite')
  unsaveOrder(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.ordersService.unsaveOrder(user.id, id);
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

  @Get(':id/similar')
  findSimilar(@Param('id') id: string) {
    return this.ordersService.findSimilar(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CLIENT')
  @Post(':id/clone')
  cloneOrder(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.ordersService.cloneOrder(user.id, id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/endorse')
  endorseSkill(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') orderId: string,
    @Body('skillId') skillId: string,
  ) {
    return this.ordersService.endorseSkill(user.id, orderId, skillId);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/disputes/:disputeId/attach')
  attachFileToDispute(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') orderId: string,
    @Param('disputeId') disputeId: string,
    @Body('fileId') fileId: string,
  ) {
    return this.ordersService.attachFileToDispute(user.id, orderId, disputeId, fileId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('disputes/:id/files')
  listDisputeFiles(@CurrentUser() user: AuthenticatedUser, @Param('id') disputeId: string) {
    return this.ordersService.listDisputeFiles(user.id, disputeId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('FREELANCER')
  @Post(':id/deadline-extension')
  requestDeadlineExtension(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') orderId: string,
    @Body() dto: { newDeadline: string; reason?: string },
  ) {
    return this.ordersService.requestDeadlineExtension(user.id, orderId, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CLIENT')
  @Post(':id/deadline-extension/:requestId/respond')
  respondDeadlineExtension(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') orderId: string,
    @Param('requestId') requestId: string,
    @Body('approve') approve: boolean,
  ) {
    return this.ordersService.respondDeadlineExtension(user.id, orderId, requestId, approve);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CLIENT')
  @Post(':id/bids/:bidId/reject')
  rejectBid(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') orderId: string,
    @Param('bidId') bidId: string,
    @Body('reason') reason?: string,
  ) {
    return this.ordersService.rejectBid(user.id, orderId, bidId, reason);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/invoices')
  listOrderInvoices(@CurrentUser() user: AuthenticatedUser, @Param('id') orderId: string) {
    return this.invoiceService.listOrderInvoices(user.id, orderId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/invoices/export.csv')
  async exportOrderInvoicesCsv(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') orderId: string,
    @Res() res: Response,
  ) {
    const csv = await this.invoiceService.exportOrderInvoicesCsv(user.id, orderId);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="invoices-order-${orderId}.csv"`);
    return res.send(csv);
  }
}
