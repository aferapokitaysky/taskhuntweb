import { IsString, Length, Matches } from 'class-validator';

// Разрешаем буквы (в т.ч. кириллицу/юникод), цифры, пробел и небольшой
// набор символов, нужных для реальных названий стека: C++, C#, .NET, UI/UX.
const SKILL_NAME_PATTERN = /^[\p{L}\p{N} +#./-]+$/u;

export class CreateSkillDto {
  @IsString()
  @Length(2, 40)
  @Matches(SKILL_NAME_PATTERN, { message: 'Название навыка содержит недопустимые символы' })
  name!: string;
}
