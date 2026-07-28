import { IsDateString, IsInt, IsNumber, IsOptional, IsPositive, IsString, Min, MinLength } from 'class-validator';

export class CreateMilestoneDto {
  @IsString()
  @MinLength(2)
  title!: string;

  @IsNumber()
  @IsPositive()
  amount!: number;

  @IsInt()
  @Min(0)
  position!: number; // порядок этапа: Design(0) -> Frontend(1) -> Backend(2) -> ...

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
