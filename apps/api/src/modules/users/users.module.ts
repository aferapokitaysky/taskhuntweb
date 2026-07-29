import { Module } from '@nestjs/common';
import { MatchingModule } from '../matching/matching.module';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { FreelancersController } from './freelancers.controller';

@Module({
  imports: [MatchingModule],
  controllers: [UsersController, FreelancersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
