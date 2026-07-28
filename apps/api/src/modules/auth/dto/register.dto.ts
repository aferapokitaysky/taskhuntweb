import { IsEmail, IsEnum, IsString, MinLength } from 'class-validator';
import { MarketplaceRole } from '@prisma/client';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsEnum(MarketplaceRole)
  role!: MarketplaceRole; // выбор "заказчик" или "фрилансер" на форме регистрации

  @IsString()
  displayName!: string;
}
