import { IsArray, IsBoolean, IsDateString, IsOptional, IsString, IsUrl } from 'class-validator';

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
  githubUrl?: string;

  @IsOptional()
  @IsUrl()
  websiteUrl?: string;

  @IsOptional()
  @IsUrl()
  linkedinUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skillIds?: string[];

  @IsOptional()
  @IsBoolean()
  availableForWork?: boolean;

  @IsOptional()
  @IsDateString()
  vacationUntil?: string;
}
