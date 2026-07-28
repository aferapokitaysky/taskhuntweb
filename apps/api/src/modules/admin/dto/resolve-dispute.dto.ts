import { IsIn, IsOptional, IsString } from 'class-validator';

export class ResolveDisputeDto {
  @IsIn(['RESOLVED_CLIENT', 'RESOLVED_FREELANCER'])
  resolution!: 'RESOLVED_CLIENT' | 'RESOLVED_FREELANCER'; // сплит (RESOLVED_SPLIT) — Phase 2, требует частичного refund/release

  @IsOptional()
  @IsString()
  notes?: string;
}
