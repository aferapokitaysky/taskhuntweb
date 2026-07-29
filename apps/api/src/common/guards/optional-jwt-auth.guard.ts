import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Как JwtAuthGuard, но не требует токена — если его нет/невалиден,
 * просто прокидывает user = null дальше, а не кидает 401. Нужен для
 * эндпоинтов, публичных по умолчанию, но с доп. данными для
 * залогиненных (например, % совпадения заказа с навыками фрилансера
 * в GET /orders).
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = any>(err: unknown, user: TUser): TUser {
    return (user ?? null) as TUser;
  }
}
