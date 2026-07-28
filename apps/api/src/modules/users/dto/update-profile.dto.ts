import { IsArray, IsOptional, IsString, IsUrl } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsUrl()
  githubUrl?: string; // подключение GitHub-профиля, отображается на карточке

  @IsOptional()
  @IsUrl()
  websiteUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skillIds?: string[];
}
