import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

// Секретные поля User, которые не должны покидать бэкенд ни при каких
// обстоятельствах, в каком бы вложенном объекте (bid.freelancer,
// chatThread.freelancer, order.client, message.sender...) они ни оказались.
// sanitizeUser() чистит их только там, где сервис явно об этом позаботился —
// на практике это регулярно забывают в новых include (найдено 2026-07-30:
// GET /orders/:id и GET /orders/:id/chat/threads отдавали bid.freelancer /
// thread.freelancer целиком, с passwordHash и токенами, хотя точечный фикс
// для /admin/users уже был). Этот интерцептор — сеть безопасности на уровне
// всего приложения: рекурсивно вычищает эти ключи из любого JSON-ответа,
// на каком бы уровне вложенности объект ни лежал.
const SENSITIVE_FIELDS = new Set(['passwordHash', 'totpSecret', 'emailVerificationToken', 'passwordResetToken']);

function sanitizeDeep<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== 'object') return value;
  // Date/Buffer/стримы (PDF-чеки, файловые скачивания) — не JSON-объекты
  // в смысле этой функции, трогать их нельзя: Buffer превратился бы в
  // {"0":.., "1":..}, стрим потерял бы методы .pipe()/.read().
  if (value instanceof Date || Buffer.isBuffer(value)) return value;
  if (typeof (value as { pipe?: unknown }).pipe === 'function') return value;
  if (seen.has(value as object)) return value;
  seen.add(value as object);

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeDeep(item, seen)) as unknown as T;
  }

  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_FIELDS.has(key)) continue;
    result[key] = sanitizeDeep(val, seen);
  }
  return result as T;
}

@Injectable()
export class SanitizeResponseInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map((data) => sanitizeDeep(data)));
  }
}
