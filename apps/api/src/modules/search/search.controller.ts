import { Controller, Get, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { SearchService } from './search.service';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Get()
  search(@Query('q') q?: string) {
    return this.searchService.search(q ?? '');
  }

  @Get('trending')
  getTrending() {
    return this.searchService.getTrending();
  }

  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @Get('suggest')
  suggest(@Query('q') q?: string) {
    return this.searchService.suggest(q ?? '');
  }
}
