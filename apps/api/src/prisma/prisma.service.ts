import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    // avatarData — сырые байты картинки, десятки-сотни КБ на профиль. Без
    // глобального omit они бы улетали в JSON каждого ответа, где где-то
    // в цепочке include затянут profile (чат, заказы, admin, отзывы —
    // мест много, см. grep по `profile: true`). Явно запрашиваем байты
    // только в UsersService.getAvatar через omit: { avatarData: false }.
    super({ omit: { profile: { avatarData: true } } });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
