import { IsNotEmpty, IsString } from 'class-validator';

export class CreatePayoutAddressDto {
  @IsString()
  @IsNotEmpty()
  label!: string;

  @IsString()
  @IsNotEmpty()
  network!: string;

  @IsString()
  @IsNotEmpty()
  address!: string;
}
