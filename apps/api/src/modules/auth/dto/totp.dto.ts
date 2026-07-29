import { IsString, Length } from 'class-validator';

export class ConfirmTotpDto {
  @IsString()
  @Length(6, 6)
  code!: string;
}

export class DisableTotpDto {
  @IsString()
  password!: string;
}

export class VerifyTotpDto {
  @IsString()
  totpToken!: string;

  @IsString()
  code!: string;
}
