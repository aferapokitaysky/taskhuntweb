import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { PermissionCode } from '@taskhunt/shared-types';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AuditLog } from '../../common/decorators/audit-log.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { FraudService } from '../fraud/fraud.service';
import { AdminService } from './admin.service';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';
import { UpdateFraudFlagDto } from './dto/update-fraud-flag.dto';
import { ResolveModerationDto } from './dto/resolve-moderation.dto';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly fraudService: FraudService,
  ) {}

  // --- Metrics ---

  @RequirePermissions(PermissionCode.FinanceViewReports)
  @Get('metrics')
  getMetrics() {
    return this.adminService.getMetrics();
  }

  @RequirePermissions(PermissionCode.FinanceViewReports)
  @Get('metrics/revenue-timeseries')
  getRevenueTimeseries(@Query('days') days?: string) {
    return this.adminService.getRevenueTimeseries(days ? Number(days) : 30);
  }

  @RequirePermissions(PermissionCode.FinanceViewReports)
  @Get('metrics/funnel')
  getFunnel(@Query('days') days?: string) {
    return this.adminService.getFunnel(days ? Number(days) : 30);
  }

  @RequirePermissions(PermissionCode.FinanceViewReports)
  @Get('metrics/top-categories')
  getTopCategories(@Query('limit') limit?: string) {
    return this.adminService.getTopCategories(limit ? Number(limit) : 10);
  }

  @RequirePermissions(PermissionCode.FinanceViewReports)
  @Get('metrics/top-freelancers')
  getTopFreelancers(@Query('limit') limit?: string) {
    return this.adminService.getTopFreelancers(limit ? Number(limit) : 10);
  }

  // --- Users ---

  @RequirePermissions(PermissionCode.UserView)
  @Get('users')
  listUsers(@Query('status') status?: string) {
    return this.adminService.listUsers(status);
  }

  @RequirePermissions(PermissionCode.UserBan)
  @AuditLog('USER_BANNED', 'User')
  @Post('users/:id/ban')
  banUser(@Param('id') id: string) {
    return this.adminService.banUser(id);
  }

  @RequirePermissions(PermissionCode.UserBan)
  @AuditLog('USER_SUSPENDED', 'User')
  @Post('users/:id/suspend')
  suspendUser(@Param('id') id: string) {
    return this.adminService.suspendUser(id);
  }

  // --- Disputes ---

  @RequirePermissions(PermissionCode.DisputeView)
  @Get('disputes')
  listDisputes(@Query('status') status?: string) {
    return this.adminService.listDisputes(status);
  }

  @RequirePermissions(PermissionCode.DisputeAssign)
  @AuditLog('DISPUTE_ASSIGNED', 'Dispute')
  @Patch('disputes/:id/assign')
  assignDispute(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.adminService.assignDispute(id, user.id);
  }

  @RequirePermissions(PermissionCode.DisputeResolve, PermissionCode.EscrowRelease)
  @AuditLog('DISPUTE_RESOLVED', 'Dispute')
  @Patch('disputes/:id/resolve')
  resolveDispute(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ResolveDisputeDto,
  ) {
    return this.adminService.resolveDispute(id, user.id, dto);
  }

  // --- Feature flags ---

  @RequirePermissions(PermissionCode.FeatureFlagToggle)
  @Get('feature-flags')
  listFeatureFlags() {
    return this.adminService.listFeatureFlags();
  }

  @RequirePermissions(PermissionCode.FeatureFlagToggle)
  @AuditLog('FEATURE_FLAG_TOGGLED', 'FeatureFlag')
  @Patch('feature-flags/:key')
  toggleFeatureFlag(@Param('key') key: string, @Body('enabled') enabled: boolean) {
    return this.adminService.toggleFeatureFlag(key, enabled);
  }

  // --- Commission rules ---

  @RequirePermissions(PermissionCode.FinanceConfigureCommissions)
  @Get('commission-rules')
  listCommissionRules() {
    return this.adminService.listCommissionRules();
  }

  @RequirePermissions(PermissionCode.FinanceConfigureCommissions)
  @AuditLog('COMMISSION_RULE_UPDATED', 'CommissionRule')
  @Patch('commission-rules/:type')
  updateCommissionRule(
    @Param('type') type: string,
    @Body('percentage') percentage?: number,
    @Body('fixedAmount') fixedAmount?: number,
  ) {
    return this.adminService.updateCommissionRule(type, percentage, fixedAmount);
  }

  // --- Categories CRUD ---

  @RequirePermissions(PermissionCode.CatalogManage)
  @AuditLog('CATEGORY_CREATED', 'Category')
  @Post('categories')
  createCategory(@Body() body: { name: string; slug: string; description?: string }) {
    return this.adminService.createCategory(body);
  }

  @RequirePermissions(PermissionCode.CatalogManage)
  @AuditLog('CATEGORY_UPDATED', 'Category')
  @Patch('categories/:id')
  updateCategory(
    @Param('id') id: string,
    @Body() body: { name?: string; slug?: string; description?: string },
  ) {
    return this.adminService.updateCategory(id, body);
  }

  @RequirePermissions(PermissionCode.CatalogManage)
  @AuditLog('CATEGORY_DELETED', 'Category')
  @Delete('categories/:id')
  deleteCategory(@Param('id') id: string) {
    return this.adminService.deleteCategory(id);
  }

  // --- Skills CRUD ---

  @RequirePermissions(PermissionCode.CatalogManage)
  @AuditLog('SKILL_CREATED', 'Skill')
  @Post('skills')
  createSkill(@Body() body: { name: string; slug: string; categoryId?: string }) {
    return this.adminService.createSkill(body);
  }

  @RequirePermissions(PermissionCode.CatalogManage)
  @AuditLog('SKILL_UPDATED', 'Skill')
  @Patch('skills/:id')
  updateSkill(
    @Param('id') id: string,
    @Body() body: { name?: string; slug?: string; categoryId?: string },
  ) {
    return this.adminService.updateSkill(id, body);
  }

  @RequirePermissions(PermissionCode.CatalogManage)
  @AuditLog('SKILL_DELETED', 'Skill')
  @Delete('skills/:id')
  deleteSkill(@Param('id') id: string) {
    return this.adminService.deleteSkill(id);
  }

  @RequirePermissions(PermissionCode.CatalogManage)
  @AuditLog('SKILL_MERGED', 'Skill')
  @Post('skills/:id/merge-into/:targetId')
  mergeSkill(@Param('id') id: string, @Param('targetId') targetId: string) {
    return this.adminService.mergeSkill(id, targetId);
  }

  // --- Анти-фрод ---

  @RequirePermissions(PermissionCode.FraudReview)
  @Get('fraud-flags')
  listFraudFlags(
    @Query('status') status?: string,
    @Query('severity') severity?: string,
    @Query('userId') userId?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.fraudService.list({ status, severity, userId, cursor, limit: limit ? Number(limit) : undefined });
  }

  @RequirePermissions(PermissionCode.FraudReview)
  @AuditLog('FRAUD_FLAG_REVIEWED', 'FraudFlag')
  @Patch('fraud-flags/:id')
  updateFraudFlag(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateFraudFlagDto) {
    return this.fraudService.updateStatus(id, user.id, dto.status, dto.note);
  }

  // --- Модерация (CodexTZ 021) ---

  @RequirePermissions(PermissionCode.ContentModerate)
  @Get('moderation-queue')
  getModerationQueue() {
    return this.adminService.getModerationQueue();
  }

  @RequirePermissions(PermissionCode.OrderModerate)
  @AuditLog('ORDER_FLAG_MODERATED', 'FraudFlag')
  @Patch('moderation-queue/orders/:id')
  resolveOrderModeration(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: ResolveModerationDto) {
    return this.adminService.resolveOrderOrProfileModeration(user.id, id, dto.action, 'ORDER', dto.note);
  }

  @RequirePermissions(PermissionCode.ContentModerate)
  @AuditLog('PROFILE_FLAG_MODERATED', 'FraudFlag')
  @Patch('moderation-queue/profiles/:id')
  resolveProfileModeration(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: ResolveModerationDto) {
    return this.adminService.resolveOrderOrProfileModeration(user.id, id, dto.action, 'PROFILE', dto.note);
  }

  @RequirePermissions(PermissionCode.ContentModerate)
  @AuditLog('REVIEW_MODERATED', 'Review')
  @Patch('moderation-queue/reviews/:id')
  resolveReviewModeration(@Param('id') id: string, @Body() dto: ResolveModerationDto) {
    return this.adminService.resolveReviewModeration(id, dto.action);
  }

  @RequirePermissions(PermissionCode.UserBan)
  @AuditLog('USERS_BULK_SUSPENDED', 'User')
  @Post('users/bulk-suspend')
  bulkSuspend(
    @CurrentUser() user: AuthenticatedUser,
    @Body('userIds') userIds: string[],
    @Body('reason') reason: string,
  ) {
    return this.adminService.bulkSuspendUsers(user.id, userIds ?? [], reason ?? '');
  }

  @RequirePermissions(PermissionCode.UserBan)
  @AuditLog('USER_2FA_RESET', 'User')
  @Post('users/:id/reset-2fa')
  reset2FA(@Param('id') id: string) {
    return this.adminService.resetUser2FA(id);
  }

  // --- Финансы ---

  @RequirePermissions(PermissionCode.FinanceViewReports)
  @Get('finance/overview')
  getFinanceOverview() {
    return this.adminService.getFinanceOverview();
  }

  // --- Подписки ---

  @RequirePermissions(PermissionCode.FinanceViewReports)
  @Get('subscriptions')
  listSubscriptions(@Query('tierName') tierName?: string) {
    return this.adminService.listSubscriptions(tierName);
  }

  @RequirePermissions(PermissionCode.WalletAdjust)
  @AuditLog('SUBSCRIPTION_GRANTED', 'Subscription', 'userId')
  @Post('subscriptions/:userId/grant')
  grantSubscription(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId') userId: string,
    @Body('tierName') tierName: 'PRO' | 'PREMIUM',
    @Body('days') days?: number,
  ) {
    return this.adminService.grantSubscription(user.id, userId, tierName, days ?? 30);
  }

  @RequirePermissions(PermissionCode.WalletAdjust)
  @AuditLog('SUBSCRIPTION_REVOKED', 'Subscription', 'userId')
  @Post('subscriptions/:userId/revoke')
  revokeSubscription(@Param('userId') userId: string) {
    return this.adminService.revokeSubscription(userId);
  }

  // --- Логи действий staff ---

  @RequirePermissions(PermissionCode.FinanceViewReports)
  @Get('audit-logs')
  listAuditLogs(
    @Query('cursor') cursor?: string,
    @Query('actorId') actorId?: string,
    @Query('targetType') targetType?: string,
  ) {
    return this.adminService.listAuditLogs({ cursor, actorId, targetType });
  }

  // --- Просмотр чатов (арбитраж) ---

  @RequirePermissions(PermissionCode.DisputeView)
  @Get('chats')
  searchChatThreads(@Query('orderId') orderId?: string, @Query('userId') userId?: string) {
    return this.adminService.searchChatThreads({ orderId, userId });
  }

  @RequirePermissions(PermissionCode.DisputeView)
  @AuditLog('CHAT_THREAD_VIEWED', 'ChatThread')
  @Get('chats/:threadId/messages')
  getChatThreadMessages(@Param('threadId') threadId: string) {
    return this.adminService.getChatThreadMessages(threadId);
  }
}
