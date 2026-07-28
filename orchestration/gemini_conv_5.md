# Отчёт и журнал работы Gemini (Раунд 5, Сессия 5)

## 📌 Загруженный контекст
Прочитаны документы [`orchestration/STATUS_GEMINI_5.md`](./STATUS_GEMINI_5.md), [`orchestration/TZ_GEMINI_5.md`](./TZ_GEMINI_5.md) и [`docs/MONETIZATION.md`](../docs/MONETIZATION.md).

---

## 📋 Статус задач (TODO)

### 1. Комиссия за вывод средств (P0, удерживание WITHDRAWAL_FEE)
- [x] [`apps/api/src/modules/wallet/wallet.service.ts`](file:///Users/korova/Desktop/freelance/apps/api/src/modules/wallet/wallet.service.ts) — реализация удержания `WITHDRAWAL_FEE` (1% по дефолту) при вызове `requestWithdrawal()`. Формируются 3 сбалансированных проводки: `DEBIT user.WITHDRAWABLE(amount)`, `CREDIT system.MAIN(netAmount)` и `CREDIT system.MAIN(fee)`.
- [x] [`apps/api/src/modules/wallet/payout.processor.ts`](file:///Users/korova/Desktop/freelance/apps/api/src/modules/wallet/payout.processor.ts) — отправка в NOWPayments payout API чистого значения `netAmount = amount - fee`. При ошибке NOWPayments пользователю возвращается полная сумма `amount`.
- [x] [`apps/api/src/modules/wallet/wallet.controller.ts`](file:///Users/korova/Desktop/freelance/apps/api/src/modules/wallet/wallet.controller.ts) — передача `netAmount` и `fee` в `payoutQueue` и клиенту в ответе.
- [x] [`apps/api/src/modules/wallet/__tests__/wallet.service.spec.ts`](file:///Users/korova/Desktop/freelance/apps/api/src/modules/wallet/__tests__/wallet.service.spec.ts) — юнит-тесты удержания `WITHDRAWAL_FEE`.

### 2. Комиссия по тиру подписки в releaseEscrow
- [x] [`apps/api/src/modules/wallet/wallet.service.ts`](file:///Users/korova/Desktop/freelance/apps/api/src/modules/wallet/wallet.service.ts) — проверка наличия активной `Subscription` у фрилансера (`freelancerId`). При наличии `ACTIVE` подписки используется `tier.commissionPercent` (например, 7% для Pro) вместо дефолтного 10%.
- [x] [`apps/api/src/modules/wallet/__tests__/wallet.service.spec.ts`](file:///Users/korova/Desktop/freelance/apps/api/src/modules/wallet/__tests__/wallet.service.spec.ts) — юнит-тест применения комиссии Pro-тира.

### 3. Enforcement лимитов на отклики и заказы
- [x] [`apps/api/src/modules/orders/orders.service.ts`](file:///Users/korova/Desktop/freelance/apps/api/src/modules/orders/orders.service.ts) — проверка месячных лимитов откликов `maxActiveBidsPerMonth` (10 на STARTER) и заказов `maxActiveOrdersPerMonth` (5 на STARTER). При превышении лимита — `BadRequestException` с понятным текстом ("Достигнут лимит откликов на вашем тарифе, оформите Pro").
- [x] [`apps/api/src/modules/orders/__tests__/orders.service.spec.ts`](file:///Users/korova/Desktop/freelance/apps/api/src/modules/orders/__tests__/orders.service.spec.ts) — тесты лимитирования откликов и проверка совместимости со старыми тестами.

### 4. Сортировка заказов с учётом Promotion
- [x] [`apps/api/src/modules/orders/orders.service.ts`](file:///Users/korova/Desktop/freelance/apps/api/src/modules/orders/orders.service.ts) — метод `findMany` в `GET /orders` помечает продвинутые заказы полем `isPromoted: boolean` и ставит их первыми в выдаче.
- [x] [`apps/api/src/modules/orders/__tests__/orders.service.spec.ts`](file:///Users/korova/Desktop/freelance/apps/api/src/modules/orders/__tests__/orders.service.spec.ts) — юнит-тест приоритизации `isPromoted` заказов.

### 5. Фоновая джоба истечения подписок & события
- [x] [`packages/shared-types/src/events.ts`](file:///Users/korova/Desktop/freelance/packages/shared-types/src/events.ts) — добавлено событие `SubscriptionExpiringSoon`.
- [x] [`apps/api/src/modules/subscriptions/subscription-expiration.processor.ts`](file:///Users/korova/Desktop/freelance/apps/api/src/modules/subscriptions/subscription-expiration.processor.ts) — BullMQ repeatable job (`subscription-check-hourly`), переводит истёкшие подписки в `EXPIRED` и публикует `SubscriptionExpiringSoon` для подписок, истекающих в течение 3 дней.
- [x] [`apps/api/src/modules/subscriptions/__tests__/subscription-expiration.processor.spec.ts`](file:///Users/korova/Desktop/freelance/apps/api/src/modules/subscriptions/__tests__/subscription-expiration.processor.spec.ts) — юнит-тесты работы воркера подписок.

### 6. Проверки
- [x] `pnpm --filter @taskhunt/api test` — 61/61 тестов проходят
- [x] `pnpm --filter @taskhunt/api build` — чистая сборка бэкенда
