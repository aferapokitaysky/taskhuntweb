import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { UsersService } from './users.service';

@Controller('freelancers')
export class FreelancersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findFreelancers(
    @Query('categoryId') categoryId?: string,
    @Query('skillId') skillId?: string,
    @Query('search') search?: string,
  ) {
    return this.usersService.findFreelancers({ categoryId, skillId, search });
  }

  // Персональная лента заказов — до /:вроде-ничего-нет здесь не нужен, но
  // регистрируем ДО любого будущего '/:id' в этом контроллере, если он
  // появится, иначе 'me' будет перехвачен параметром.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('FREELANCER')
  @Get('me/recommended-orders')
  getRecommendedOrders(@CurrentUser() user: AuthenticatedUser, @Query('limit') limit?: string) {
    const parsedLimit = limit ? Math.min(50, Math.max(1, parseInt(limit, 10) || 20)) : 20;
    return this.usersService.getRecommendedOrders(user.id, parsedLimit);
  }
}
