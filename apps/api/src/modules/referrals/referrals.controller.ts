import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { ReferralsService } from './referrals.service';
import { RedeemReferralDto } from './dto/redeem-referral.dto';

@UseGuards(JwtAuthGuard)
@Controller('referrals')
export class ReferralsController {
  constructor(private readonly referralsService: ReferralsService) {}

  @Post('redeem')
  redeem(@CurrentUser() user: AuthenticatedUser, @Body() dto: RedeemReferralDto) {
    return this.referralsService.redeem(user.id, dto.code);
  }

  @Get('me')
  getMyReferralInfo(@CurrentUser() user: AuthenticatedUser) {
    return this.referralsService.getMyReferralInfo(user.id);
  }
}
