import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CatalogService } from './catalog.service';
import { CreateSkillDto } from './dto/create-skill.dto';

@Controller()
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('categories')
  listCategories() {
    return this.catalogService.listCategories();
  }

  @Get('skills')
  listSkills() {
    return this.catalogService.listSkills();
  }

  // Только для авторизованных + отдельный жёсткий лимит поверх глобального
  // троттлера — см. комментарий в CatalogService.findOrCreateSkill.
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 8, ttl: 60000 } })
  @Post('skills')
  createSkill(@Body() dto: CreateSkillDto) {
    return this.catalogService.findOrCreateSkill(dto.name);
  }
}
