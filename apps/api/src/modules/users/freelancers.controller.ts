import { Controller, Get, Query } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('freelancers')
export class FreelancersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findFreelancers(
    @Query('categoryId') categoryId?: string,
    @Query('skillId') skillId?: string,
    @Query('search') search?: string,
  ) {
    return this.usersService.findFreelancers({ categoryId, skillId, search });
  }
}
