import type IORedis from 'ioredis';

/**
 * Скользящее окно по счётчику в Redis (INCR + EXPIRE-если-новый). Не
 * скользящий лог, а фиксированное окно — для анти-фрод эвристик этого
 * достаточно (нам не нужна миллисекундная точность), а INCR/EXPIRE —
 * O(1) и не требует ничего кроме Redis, который у сервиса и так есть
 * для BullMQ.
 */
export async function checkVelocity(
  redis: IORedis,
  key: string,
  windowSeconds: number,
): Promise<number> {
  const fullKey = `fraud:velocity:${key}`;
  const count = await redis.incr(fullKey);
  if (count === 1) {
    await redis.expire(fullKey, windowSeconds);
  }
  return count;
}
