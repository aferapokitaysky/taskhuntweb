import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import IORedis from 'ioredis';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('health')
export class HealthController {
  private readonly redis: IORedis;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.redis = new IORedis({
      host: config.get<string>('REDIS_HOST', 'localhost'),
      port: config.get<number>('REDIS_PORT', 6379),
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
  }

  @Get()
  async check() {
    let dbOk = false;
    let redisOk = false;

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbOk = true;
    } catch {
      dbOk = false;
    }

    try {
      await this.redis.connect().catch(() => {});
      const pong = await this.redis.ping();
      redisOk = pong === 'PONG';
    } catch {
      redisOk = false;
    }

    const isHealthy = dbOk && redisOk;

    if (!isHealthy) {
      throw new ServiceUnavailableException({
        status: 'error',
        db: dbOk,
        redis: redisOk,
      });
    }

    return {
      status: 'ok',
      db: dbOk,
      redis: redisOk,
    };
  }
}
