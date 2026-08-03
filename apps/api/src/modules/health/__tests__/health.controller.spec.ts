import { ServiceUnavailableException } from '@nestjs/common';
import IORedis from 'ioredis';
import { HealthController } from '../health.controller';

jest.mock('ioredis', () => ({ __esModule: true, default: jest.fn() }));

describe('HealthController', () => {
  let prisma: any;
  let redis: any;
  let config: any;
  let controller: HealthController;
  const redisConstructor = IORedis as unknown as jest.Mock;

  beforeEach(() => {
    prisma = { $queryRaw: jest.fn() };
    redis = {
      status: 'wait',
      connect: jest.fn(),
      disconnect: jest.fn(),
      ping: jest.fn(),
    };
    config = { get: jest.fn((_: string, fallback: unknown) => fallback) };
    redisConstructor.mockReturnValue(redis);
    controller = new HealthController(prisma, config);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('возвращает ok, когда база и redis отвечают', async () => {
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    redis.connect.mockResolvedValue(undefined);
    redis.ping.mockResolvedValue('PONG');

    await expect(controller.check()).resolves.toEqual({ status: 'ok', db: true, redis: true });
    expect(redisConstructor).toHaveBeenCalledWith(
      expect.objectContaining({
        lazyConnect: true,
        connectTimeout: 1000,
        commandTimeout: 1000,
        retryStrategy: expect.any(Function),
      }),
    );
  });

  it('быстро отдаёт 503, когда зависимости недоступны', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('db down'));
    redis.connect.mockRejectedValue(new Error('redis down'));
    redis.ping.mockRejectedValue(new Error('redis down'));

    await expect(controller.check()).rejects.toThrow(ServiceUnavailableException);
  });

  it('закрывает redis-соединение при shutdown', () => {
    controller.onModuleDestroy();

    expect(redis.disconnect).toHaveBeenCalled();
  });
});
