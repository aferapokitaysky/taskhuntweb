import { IsArray, IsIn, IsNumber, IsObject, IsOptional, IsString } from 'class-validator';

// Анкета при регистрации. Общая форма для обеих ролей — фронт показывает
// разные шаги в зависимости от роли пользователя, но пишет всё сюда же.
export class OnboardingDto {
  @IsOptional()
  @IsIn(['junior', 'middle', 'senior'])
  experienceLevel?: string; // только для FREELANCER

  @IsOptional()
  @IsString()
  primaryGoal?: string; // "hire" | "find_work" | "hire_team" | ...

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  interestedCategoryIds?: string[];

  @IsOptional()
  @IsNumber()
  expectedBudgetMin?: number; // только для CLIENT

  @IsOptional()
  @IsNumber()
  expectedRateMin?: number; // только для FREELANCER

  @IsOptional()
  @IsIn(['full_time', 'part_time', 'occasional'])
  availability?: string;

  @IsOptional()
  @IsObject()
  structuredAnswers?: Record<string, unknown>; // доп. вопросы квиза, свободная форма
}
