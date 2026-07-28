// Системный "контрагент" для внешних движений денег (депозиты/выводы),
// нужен, чтобы каждая ledger-транзакция была строго сбалансирована
// (сумма DEBIT === сумма CREDIT), даже когда деньги приходят/уходят
// за пределы платформы (NOWPayments). Создаётся один раз в prisma/seed.ts.
export const SYSTEM_ACCOUNT_EMAIL = 'system@taskhunt.internal';

export const DEFAULT_MARKETPLACE_FEE_PERCENT = 10; // используется, если CommissionRule нет в БД
