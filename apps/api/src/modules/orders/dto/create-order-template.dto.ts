import { IsArray, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export enum OrderTemplateFrequency {
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
}

export class CreateOrderTemplateDto {
  @IsString()
  @IsNotEmpty()
  categoryId: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsNumber()
  @Min(1)
  budgetMin: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  budgetMax?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsEnum(OrderTemplateFrequency)
  frequency: OrderTemplateFrequency;
}
