import { PartialType } from '@nestjs/mapped-types';
import { CreatePortfolioItemDto } from './create-portfolio-item.dto';

export class UpdatePortfolioItemDto extends PartialType(CreatePortfolioItemDto) {}
