import { IsIn, IsNotEmpty, IsString } from 'class-validator';
import { PAYOUT_NETWORKS } from '@taskhunt/shared-types';

export class CreatePayoutAddressDto {
  @IsString()
  @IsNotEmpty()
  label!: string;

  @IsIn(PAYOUT_NETWORKS)
  network!: string;

  @IsString()
  @IsNotEmpty()
  address!: string;
}
