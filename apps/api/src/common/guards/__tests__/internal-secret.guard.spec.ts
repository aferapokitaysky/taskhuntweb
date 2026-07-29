import { ServiceUnavailableException, UnauthorizedException, ExecutionContext } from '@nestjs/common';
import { InternalSecretGuard } from '../internal-secret.guard';

function makeContext(headers: Record<string, string>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers }),
    }),
  } as any;
}

describe('InternalSecretGuard', () => {
  const originalEnv = process.env.FRAUD_INTERNAL_SECRET;
  let guard: InternalSecretGuard;

  beforeEach(() => {
    guard = new InternalSecretGuard();
  });

  afterEach(() => {
    process.env.FRAUD_INTERNAL_SECRET = originalEnv;
  });

  it('бросает ServiceUnavailableException, если секрет не настроен на сервере (fail closed, не открыт всем)', () => {
    delete process.env.FRAUD_INTERNAL_SECRET;
    expect(() => guard.canActivate(makeContext({ 'x-internal-secret': 'anything' }))).toThrow(ServiceUnavailableException);
  });

  it('бросает UnauthorizedException при неверном секрете', () => {
    process.env.FRAUD_INTERNAL_SECRET = 'real-secret';
    expect(() => guard.canActivate(makeContext({ 'x-internal-secret': 'wrong' }))).toThrow(UnauthorizedException);
  });

  it('бросает UnauthorizedException при отсутствующем заголовке', () => {
    process.env.FRAUD_INTERNAL_SECRET = 'real-secret';
    expect(() => guard.canActivate(makeContext({}))).toThrow(UnauthorizedException);
  });

  it('пропускает при верном секрете', () => {
    process.env.FRAUD_INTERNAL_SECRET = 'real-secret';
    expect(guard.canActivate(makeContext({ 'x-internal-secret': 'real-secret' }))).toBe(true);
  });
});
