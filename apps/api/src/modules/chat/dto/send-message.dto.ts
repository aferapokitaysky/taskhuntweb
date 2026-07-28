import { IsOptional, IsString, IsUUID } from 'class-validator';

export class SendMessageDto {
  @IsString()
  body!: string;
}

export class SendFileMessageDto {
  @IsUUID()
  fileId!: string;

  @IsOptional()
  @IsString()
  body?: string;
}
