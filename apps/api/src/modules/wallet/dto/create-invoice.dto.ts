import { IsNumber, IsOptional, IsPositive, IsString, IsUUID } from 'class-validator';

export class CreateInvoiceDto {
  @IsUUID()
  orderId!: string;

  @IsOptional()
  @IsUUID()
  milestoneId?: string;

  @IsNumber()
  @IsPositive()
  amount!: number;

  @IsOptional()
  @IsString()
  description?: string;
}
