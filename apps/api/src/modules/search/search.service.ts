import { Injectable } from '@nestjs/common';
import { OrdersService } from '../orders/orders.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class SearchService {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly usersService: UsersService,
  ) {}

  async search(query: string) {
    if (!query || query.trim().length < 2) {
      return { orders: [], freelancers: [] };
    }

    const trimmed = query.trim();

    const [orders, freelancers] = await Promise.all([
      this.ordersService.findMany({ search: trimmed }),
      this.usersService.findFreelancers({ search: trimmed }),
    ]);

    return {
      orders: orders.slice(0, 10),
      freelancers: freelancers.slice(0, 10),
    };
  }
}
