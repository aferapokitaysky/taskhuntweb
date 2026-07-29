import { IsIn } from 'class-validator';

export class SetDigestDto {
  @IsIn(['NONE', 'DAILY', 'WEEKLY'])
  frequency!: 'NONE' | 'DAILY' | 'WEEKLY';
}
