import { Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { ClientBlocksService } from './client-blocks.service';

@Controller('users/me/blocks')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('CLIENT')
export class ClientBlocksController {
  constructor(private readonly clientBlocksService: ClientBlocksService) {}

  @Post(':freelancerId')
  blockFreelancer(@CurrentUser() user: AuthenticatedUser, @Param('freelancerId') freelancerId: string) {
    return this.clientBlocksService.blockFreelancer(user.id, freelancerId);
  }

  @Delete(':freelancerId')
  unblockFreelancer(@CurrentUser() user: AuthenticatedUser, @Param('freelancerId') freelancerId: string) {
    return this.clientBlocksService.unblockFreelancer(user.id, freelancerId);
  }

  @Get()
  listBlockedFreelancers(@CurrentUser() user: AuthenticatedUser) {
    return this.clientBlocksService.listBlockedFreelancers(user.id);
  }
}
