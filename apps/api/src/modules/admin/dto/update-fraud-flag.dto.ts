import { IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateFraudFlagDto {
  @IsIn(['REVIEWED', 'DISMISSED', 'CONFIRMED'])
  status!: 'REVIEWED' | 'DISMISSED' | 'CONFIRMED';

  @IsOptional()
  @IsString()
  note?: string;
}
