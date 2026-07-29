import { IsBoolean, IsIn } from 'class-validator';

export class SetPreferenceDto {
  @IsIn(['PUSH', 'EMAIL', 'TELEGRAM', 'IN_APP', 'SMS'])
  channel!: 'PUSH' | 'EMAIL' | 'TELEGRAM' | 'IN_APP' | 'SMS';

  @IsBoolean()
  enabled!: boolean;
}
