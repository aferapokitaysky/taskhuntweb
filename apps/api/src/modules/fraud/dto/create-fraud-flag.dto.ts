import { IsArray, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class CreateFraudFlagDto {
  @IsString()
  eventName!: string;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsUUID()
  orderId?: string;

  @IsInt()
  @Min(0)
  @Max(100)
  riskScore!: number;

  @IsIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
  severity!: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

  @IsArray()
  @IsString({ each: true })
  reasons!: string[];
}
