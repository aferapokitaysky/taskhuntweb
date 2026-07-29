import { PartialType } from '@nestjs/mapped-types';
import { CreateBidTemplateDto } from './create-bid-template.dto';

export class UpdateBidTemplateDto extends PartialType(CreateBidTemplateDto) {}
