import { IsArray, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class DeliverWorkDto {
  @IsString()
  @MinLength(5)
  description!: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  fileIds?: string[];
}
