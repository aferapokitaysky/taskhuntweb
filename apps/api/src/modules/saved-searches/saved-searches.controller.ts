import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { SavedSearchesService } from './saved-searches.service';
import { CreateSavedSearchDto } from './dto/create-saved-search.dto';

@UseGuards(JwtAuthGuard)
@Controller('saved-searches')
export class SavedSearchesController {
  constructor(private readonly savedSearchesService: SavedSearchesService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.savedSearchesService.list(user.id);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateSavedSearchDto) {
    return this.savedSearchesService.create(user.id, dto);
  }

  @Delete(':id')
  delete(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.savedSearchesService.delete(user.id, id);
  }
}
