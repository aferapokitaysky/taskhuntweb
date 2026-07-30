import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { OrderTemplateFrequency } from './create-order-template.dto';

// Раньше PATCH принимал сырой inline-литерал типа (Partial<{...}>) — у такого
// параметра рантайм-метатип Object, и глобальный ValidationPipe
// (whitelist/forbidNonWhitelisted) его молча пропускает без валидации:
// TypeScript decorator metadata не сохраняет структуру для литеральных
// типов, только для классов. Итог — тело запроса летело в Prisma
// нефильтрованным (mass assignment: clientId/categoryId/budgetMin и т.д.
// можно было подменить). Настоящий класс-DTO чинит это в первую очередь.
export class UpdateOrderTemplateDto {
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsEnum(OrderTemplateFrequency)
  frequency?: OrderTemplateFrequency;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
