import { checkVelocity } from '../lib/velocity';

describe('checkVelocity', () => {
  it('ставит TTL только на первый INCR (count === 1), не на последующие', async () => {
    const redis = {
      incr: jest.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(2),
      expire: jest.fn(),
    } as any;

    await checkVelocity(redis, 'key-1', 60);
    await checkVelocity(redis, 'key-1', 60);

    expect(redis.incr).toHaveBeenCalledTimes(2);
    expect(redis.expire).toHaveBeenCalledTimes(1);
    expect(redis.expire).toHaveBeenCalledWith('fraud:velocity:key-1', 60);
  });

  it('возвращает текущий счётчик', async () => {
    const redis = { incr: jest.fn().mockResolvedValue(5), expire: jest.fn() } as any;
    const count = await checkVelocity(redis, 'key-2', 60);
    expect(count).toBe(5);
  });
});
