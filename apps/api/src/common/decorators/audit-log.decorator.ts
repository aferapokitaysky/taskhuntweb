import { SetMetadata } from '@nestjs/common';

export const AUDIT_LOG_ACTION_KEY = 'audit_log_action';

/**
 * Вешается на контроллер-метод, чьё выполнение должно попасть в AuditLog.
 * targetType — имя сущности ("Order", "Wallet", "Dispute"), targetIdParam —
 * имя route-параметра, откуда взять targetId (например "id").
 */
export const AuditLog = (action: string, targetType: string, targetIdParam = 'id') =>
  SetMetadata(AUDIT_LOG_ACTION_KEY, { action, targetType, targetIdParam });
