import { Controller, Get, OnModuleDestroy, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import IORedis from 'ioredis';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('health')
export class HealthController implements OnModuleDestroy {
  private readonly redis: IORedis;
  private readonly checkTimeoutMs = 1000;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.redis = new IORedis({
      host: config.get<string>('REDIS_HOST', 'localhost'),
      port: config.get<number>('REDIS_PORT', 6379),
      lazyConnect: true,
      connectTimeout: this.checkTimeoutMs,
      commandTimeout: this.checkTimeoutMs,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
    });
  }

  onModuleDestroy() {
    this.redis.disconnect();
  }

  @Get()
  async check() {
    let dbOk = false;
    let redisOk = false;

    try {
      await this.withTimeout(this.prisma.$queryRaw`SELECT 1`, this.checkTimeoutMs);
      dbOk = true;
    } catch {
      dbOk = false;
    }

    try {
      if (this.redis.status === 'wait' || this.redis.status === 'end' || this.redis.status === 'close') {
        await this.withTimeout(this.redis.connect(), this.checkTimeoutMs).catch(() => {});
      }
      const pong = await this.withTimeout(this.redis.ping(), this.checkTimeoutMs);
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

  private withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
    let timeout: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<T>((_, reject) => {
      timeout = setTimeout(() => reject(new Error('Health check timed out')), timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]).finally(() => {
      if (timeout) clearTimeout(timeout);
    });
  }
}
