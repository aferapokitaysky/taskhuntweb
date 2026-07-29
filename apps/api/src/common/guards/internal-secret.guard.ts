import { CanActivate, ExecutionContext, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';

/**
 * Защита для service-to-service эндпоинтов (сейчас — только приём фрод-флагов
 * от fraud-service). Не JWT: это не пользовательский запрос, а вызов от
 * другого сервиса внутри доверенного периметра (Docker-сети/VPC), поэтому
 * общий секрет в заголовке, сверяемый с ENV. Если секрет не настроен —
 * эндпоинт недоступен целиком (503), а не тихо открыт всем.
 */
@Injectable()
export class InternalSecretGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const expected = process.env.FRAUD_INTERNAL_SECRET;
    if (!expected) {
      throw new ServiceUnavailableException('FRAUD_INTERNAL_SECRET is not configured');
    }

    const request = context.switchToHttp().getRequest();
    const provided = request.headers['x-internal-secret'];
    if (provided !== expected) {
      throw new UnauthorizedException('Invalid internal secret');
    }

    return true;
  }
}
