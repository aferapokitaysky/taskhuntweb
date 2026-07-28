import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';
import { AUDIT_LOG_ACTION_KEY } from '../decorators/audit-log.decorator';
import { AuthenticatedUser } from '../types/authenticated-user';

/**
 * Пишет запись в AuditLog ПОСЛЕ успешного выполнения запроса, помеченного
 * @AuditLog(...). Пишется асинхронно и не должно блокировать/ломать ответ
 * пользователю, даже если сам audit-запрос упадёт.
 */
@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const meta = this.reflector.getAllAndOverride<{
      action: string;
      targetType: string;
      targetIdParam: string;
    }>(AUDIT_LOG_ACTION_KEY, [context.getHandler(), context.getClass()]);

    if (!meta) return next.handle();

    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedUser | undefined = request.user;
    const targetId = request.params?.[meta.targetIdParam] ?? null;
    const ip = request.ip ?? request.headers['x-forwarded-for'] ?? null;
    const userAgent = request.headers['user-agent'] ?? null;

    return next.handle().pipe(
      tap(() => {
        this.prisma.auditLog
          .create({
            data: {
              actorId: user?.id ?? null,
              action: meta.action,
              targetType: meta.targetType,
              targetId,
              metadata: { body: request.body ?? {} },
              ip,
              userAgent,
            },
          })
          .catch(() => {
            // audit-логирование не должно валить основной запрос
          });
      }),
    );
  }
}
