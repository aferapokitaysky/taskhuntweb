import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { SavedSearchesService } from './saved-searches.service';
import { SavedSearchesController } from './saved-searches.controller';
import { SavedSearchMatcherListener } from './saved-search-matcher.listener';

@Module({
  imports: [NotificationsModule],
  controllers: [SavedSearchesController],
  providers: [SavedSearchesService, SavedSearchMatcherListener],
})
export class SavedSearchesModule {}
