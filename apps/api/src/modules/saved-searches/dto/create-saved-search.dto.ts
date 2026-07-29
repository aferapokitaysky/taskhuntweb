import { IsArray, IsNumber, IsOptional, IsString, Length, Min } from 'class-validator';

export class CreateSavedSearchDto {
  @IsString()
  @Length(2, 60)
  label!: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  minBudget?: number;
}
