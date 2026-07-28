import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { FreelancersController } from './freelancers.controller';

@Module({
  controllers: [UsersController, FreelancersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
