import { IsArray, IsDateString, IsNumber, IsOptional, IsPositive, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateOrderDto {
  @IsUUID()
  categoryId!: string;

  @IsString()
  @MinLength(5)
  title!: string;

  @IsString()
  @MinLength(20)
  description!: string;

  @IsNumber()
  @IsPositive()
  budgetMin!: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  budgetMax?: number;

  @IsOptional()
  @IsDateString()
  deadline?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
