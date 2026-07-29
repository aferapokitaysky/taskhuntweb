import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PayoutAddressesService } from './payout-addresses.service';
import { CreatePayoutAddressDto } from './dto/create-payout-address.dto';
import { UpdatePayoutAddressDto } from './dto/update-payout-address.dto';

@UseGuards(JwtAuthGuard)
@Controller('wallet/payout-addresses')
export class PayoutAddressesController {
  constructor(private readonly payoutAddressesService: PayoutAddressesService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.payoutAddressesService.list(user.id);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreatePayoutAddressDto) {
    return this.payoutAddressesService.create(user.id, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdatePayoutAddressDto,
  ) {
    return this.payoutAddressesService.update(user.id, id, dto);
  }

  @Delete(':id')
  delete(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.payoutAddressesService.delete(user.id, id);
  }
}
