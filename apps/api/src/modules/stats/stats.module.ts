import { Module } from '@nestjs/common';
import { SearchModule } from '../search/search.module';
import { MatchingModule } from '../matching/matching.module';
import { StatsController } from './stats.controller';

@Module({
  imports: [SearchModule, MatchingModule],
  controllers: [StatsController],
})
export class StatsModule {}
