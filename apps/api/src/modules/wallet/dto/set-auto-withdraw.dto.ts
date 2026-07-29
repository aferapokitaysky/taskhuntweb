import { IsNumber, IsOptional, IsPositive, IsUUID } from 'class-validator';

export class SetAutoWithdrawDto {
  @IsOptional()
  @IsNumber()
  @IsPositive()
  threshold?: number | null;

  @IsOptional()
  @IsUUID()
  savedAddressId?: string;
}
