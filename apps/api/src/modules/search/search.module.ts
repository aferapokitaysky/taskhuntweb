import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { UsersModule } from '../users/users.module';
import { SearchService } from './search.service';
import { SearchController } from './search.controller';

@Module({
  imports: [OrdersModule, UsersModule],
  controllers: [SearchController],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
