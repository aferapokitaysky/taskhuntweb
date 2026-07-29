import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdatePayoutAddressDto {
  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
