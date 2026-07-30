import { Module } from '@nestjs/common';
import { MatchingModule } from '../matching/matching.module';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { FreelancersController } from './freelancers.controller';
import { ClientBlocksService } from './client-blocks.service';
import { ClientBlocksController } from './client-blocks.controller';

@Module({
  imports: [MatchingModule],
  controllers: [UsersController, FreelancersController, ClientBlocksController],
  providers: [UsersService, ClientBlocksService],
  exports: [UsersService, ClientBlocksService],
})
export class UsersModule {}
