import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { CreateBidDto } from './dto/create-bid.dto';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  findMany(@Query('categoryId') categoryId?: string, @Query('status') status?: string) {
    return this.ordersService.findMany({ categoryId, status });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ordersService.findOne(id);
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
}
