import { BadRequestException, Body, Controller, Get, Headers, HttpCode, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PromotedEntityType } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { NowPaymentsService } from '../wallet/nowpayments.service';
import { PromotionsService } from './promotions.service';
import { CheckoutPromotionDto } from './dto/checkout-promotion.dto';

@Controller('promotions')
export class PromotionsController {
  constructor(
    private readonly promotionsService: PromotionsService,
    private readonly nowPayments: NowPaymentsService,
  ) {}

  @Get('active')
  listActive(@Query('entityType') entityType: PromotedEntityType, @Query('entityId') entityId: string) {
    return this.promotionsService.listActive(entityType, entityId);
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('checkout')
  checkout(@CurrentUser() user: AuthenticatedUser, @Body() dto: CheckoutPromotionDto) {
    return this.promotionsService.checkout(user.id, dto.entityType, dto.entityId);
  }

  @Post('nowpayments/ipn')
  @HttpCode(200)
  async handleIpn(@Body() body: Record<string, unknown>, @Headers('x-nowpayments-sig') signature: string) {
    if (!signature || !this.nowPayments.verifyIpnSignature(body, signature)) {
      throw new BadRequestException('Invalid IPN signature');
    }

    const status = body.payment_status as string;
    const orderId = body.order_id as string;

    if (status === 'finished' || status === 'confirmed') {
      await this.promotionsService.confirmFromIpn(orderId);
    }

    return { received: true };
  }
}
