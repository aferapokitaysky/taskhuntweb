import { reportFlag, severityFromScore } from '../lib/report';

describe('severityFromScore', () => {
  it.each([
    [0, 'LOW'],
    [29, 'LOW'],
    [30, 'MEDIUM'],
    [59, 'MEDIUM'],
    [60, 'HIGH'],
    [84, 'HIGH'],
    [85, 'CRITICAL'],
    [100, 'CRITICAL'],
  ])('%i -> %s', (score, expected) => {
    expect(severityFromScore(score)).toBe(expected);
  });
});

describe('reportFlag', () => {
  const originalEnv = process.env;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    process.env = { ...originalEnv, API_INTERNAL_URL: 'http://api:3001', FRAUD_INTERNAL_SECRET: 'test-secret' };
    fetchMock = jest.fn().mockResolvedValue({ ok: true, text: async () => '' });
    (global as any).fetch = fetchMock;
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  it('не делает запрос для null', async () => {
    await reportFlag(null);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('не делает запрос для riskScore <= 0', async () => {
    await reportFlag({ eventName: 'OrderCreated', riskScore: 0, severity: 'LOW', reasons: [] });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('шлёт POST с секретом в заголовке при положительном риске', async () => {
    await reportFlag({ eventName: 'OrderCreated', riskScore: 40, severity: 'MEDIUM', reasons: ['x'] });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://api:3001/internal/fraud/flags',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'X-Internal-Secret': 'test-secret' }),
      }),
    );
  });

  it('не падает, если API_INTERNAL_URL/FRAUD_INTERNAL_SECRET не настроены', async () => {
    process.env.API_INTERNAL_URL = '';
    await expect(
      reportFlag({ eventName: 'OrderCreated', riskScore: 40, severity: 'MEDIUM', reasons: [] }),
    ).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
