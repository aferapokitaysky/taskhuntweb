import { SubscriptionAwareThrottlerGuard } from '../subscription-aware-throttler.guard';

describe('SubscriptionAwareThrottlerGuard', () => {
  let guard: SubscriptionAwareThrottlerGuard;

  beforeEach(() => {
    guard = new SubscriptionAwareThrottlerGuard(
      { options: { throttlers: [{ ttl: 60000, limit: 100 }] } } as any,
      {} as any,
      {} as any,
    );
  });

  it('возвращает 1x лимит для пользователя без подписки (STARTER)', async () => {
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { subscription: null },
        }),
      }),
    } as any;

    const limit = await (guard as any).getLimit(mockContext, { limit: 100 });
    expect(limit).toBe(100);
  });

  it('возвращает 2x лимит для пользователя с подпиской PRO', async () => {
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { subscription: { tier: { name: 'PRO' } } },
        }),
      }),
    } as any;

    const limit = await (guard as any).getLimit(mockContext, { limit: 100 });
    expect(limit).toBe(200);
  });

  it('возвращает 4x лимит для пользователя с подпиской PREMIUM', async () => {
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { subscription: { tier: { name: 'PREMIUM' } } },
        }),
      }),
    } as any;

    const limit = await (guard as any).getLimit(mockContext, { limit: 100 });
    expect(limit).toBe(400);
  });
});
