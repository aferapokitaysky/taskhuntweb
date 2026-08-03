import { IsArray, IsDateString, IsNumber, IsOptional, IsPositive, IsString, IsUUID, MinLength } from 'class-validator';

// Черновик — автосейв в процессе заполнения формы (CodexTZ 023.011), поэтому
// в отличие от CreateOrderDto почти всё опционально: заказ должен сохраняться
// уже после первого поля, не после того, как форма заполнена целиком.
// categoryId остаётся обязательным — это NOT NULL foreign key в БД, сделать
// его опциональным для черновика означало бы миграцию схемы ради состояния,
// которое всё равно долго не живёт (публикация требует его заполнения).
export class CreateOrderDraftDto {
  @IsUUID()
  categoryId!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  budgetMin?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  budgetMax?: number;

  @IsOptional()
  @IsDateString()
  deadline?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
