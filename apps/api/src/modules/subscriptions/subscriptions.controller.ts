import { BadRequestException, Body, Controller, Get, Headers, HttpCode, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { NowPaymentsService } from '../wallet/nowpayments.service';
import { SubscriptionsService } from './subscriptions.service';
import { CheckoutSubscriptionDto } from './dto/checkout-subscription.dto';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(
    private readonly subscriptionsService: SubscriptionsService,
    private readonly nowPayments: NowPaymentsService,
  ) {}

  @Get('tiers')
  listTiers() {
    return this.subscriptionsService.listTiers();
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMine(@CurrentUser() user: AuthenticatedUser) {
    return this.subscriptionsService.getMyEffectiveSubscription(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('checkout')
  checkout(@CurrentUser() user: AuthenticatedUser, @Body() dto: CheckoutSubscriptionDto) {
    return this.subscriptionsService.checkout(user.id, dto.tierName);
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('checkout/from-balance')
  checkoutFromBalance(@CurrentUser() user: AuthenticatedUser, @Body() dto: CheckoutSubscriptionDto) {
    return this.subscriptionsService.checkoutFromBalance(user.id, dto.tierName);
  }

  /** См. WalletModule/NowPaymentsController.handleIpn — тот же паттерн проверки подписи. */
  @Post('nowpayments/ipn')
  @HttpCode(200)
  async handleIpn(@Body() body: Record<string, unknown>, @Headers('x-nowpayments-sig') signature: string) {
    if (!signature || !this.nowPayments.verifyIpnSignature(body, signature)) {
      throw new BadRequestException('Invalid IPN signature');
    }

    const status = body.payment_status as string;
    const orderId = body.order_id as string;

    if (status === 'finished' || status === 'confirmed') {
      await this.subscriptionsService.confirmFromIpn(orderId);
    }

    return { received: true };
  }
}
