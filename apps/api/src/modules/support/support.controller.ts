import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { IsString } from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PermissionCode } from '@taskhunt/shared-types';
import { SupportService } from './support.service';
import { CreateTicketDto } from './dto/create-ticket.dto';

class AddMessageDto {
  @IsString()
  body!: string;
}

@UseGuards(JwtAuthGuard)
@Controller('support/tickets')
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateTicketDto) {
    return this.supportService.createTicket(user.id, dto);
  }

  @Get('mine')
  listMine(@CurrentUser() user: AuthenticatedUser) {
    return this.supportService.listMyTickets(user.id);
  }

  @Get(':id')
  getTicket(@CurrentUser() user: AuthenticatedUser, @Param('id') ticketId: string) {
    return this.supportService.getTicket(ticketId, user.id, user.isStaff);
  }

  @Post(':id/messages')
  addMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') ticketId: string,
    @Body() dto: AddMessageDto,
  ) {
    return this.supportService.addMessage(ticketId, user.id, user.isStaff, dto.body);
  }

  // --- Staff-only ---

  @UseGuards(PermissionsGuard)
  @RequirePermissions(PermissionCode.DisputeView) // очередь поддержки видят те же, кто видит споры (Support/Owner)
  @Get()
  listAll(@Query('status') status?: string) {
    return this.supportService.listAllTickets(status);
  }

  @UseGuards(PermissionsGuard)
  @RequirePermissions(PermissionCode.DisputeAssign)
  @Patch(':id/assign')
  assign(@CurrentUser() user: AuthenticatedUser, @Param('id') ticketId: string) {
    return this.supportService.assign(ticketId, user.id);
  }

  @UseGuards(PermissionsGuard)
  @RequirePermissions(PermissionCode.DisputeView)
  @Patch(':id/status')
  updateStatus(@Param('id') ticketId: string, @Body('status') status: 'OPEN' | 'PENDING' | 'RESOLVED' | 'CLOSED') {
    return this.supportService.updateStatus(ticketId, status);
  }
}
