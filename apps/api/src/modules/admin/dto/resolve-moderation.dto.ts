import { IsIn, IsOptional, IsString } from 'class-validator';

export class ResolveModerationDto {
  @IsIn(['APPROVE', 'REJECT', 'REQUEST_EDITS'])
  action!: 'APPROVE' | 'REJECT' | 'REQUEST_EDITS';

  @IsOptional()
  @IsString()
  note?: string;
}
