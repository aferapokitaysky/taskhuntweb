import { IsIn, IsString } from 'class-validator';

export class CheckoutPromotionDto {
  @IsIn(['ORDER', 'PROFILE'])
  entityType!: 'ORDER' | 'PROFILE';

  @IsString()
  entityId!: string;
}
