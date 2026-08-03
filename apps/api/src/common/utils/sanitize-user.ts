// Секретные поля User, которые не должны покидать бэкенд ни при каких
// обстоятельствах — ни в /users/me, ни в /admin/*. Единая точка правды,
// а не повторять список руками в каждом сервисе (найдено 2026-07-30:
// /admin/users, /admin/users/:id/ban, /admin/users/:id/suspend отдавали
// passwordHash/totpSecret/токены целиком через прямой возврат объекта
// Prisma — тот же класс бага, что чинили в раунде 13 для /users/me).
const SENSITIVE_USER_FIELDS = ['passwordHash', 'totpSecret', 'emailVerificationToken', 'passwordResetToken'] as const;

type SensitiveUserFields = (typeof SENSITIVE_USER_FIELDS)[number];

export function sanitizeUser<T extends Partial<Record<SensitiveUserFields, unknown>>>(
  user: T,
): Omit<T, SensitiveUserFields> {
  const clean = { ...user };
  for (const field of SENSITIVE_USER_FIELDS) {
    delete clean[field];
  }
  return clean;
}
