import { IsIn } from 'class-validator';

export class CheckoutSubscriptionDto {
  @IsIn(['PRO', 'PREMIUM'])
  tierName!: 'PRO' | 'PREMIUM'; // STARTER бесплатный, оформлять через checkout незачем
}
