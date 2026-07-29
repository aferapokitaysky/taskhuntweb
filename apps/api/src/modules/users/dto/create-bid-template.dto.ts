import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreateBidTemplateDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  message!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  defaultDeliveryDays?: number;
}
