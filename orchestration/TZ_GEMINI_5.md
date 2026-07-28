# TaskHunt — ТЗ для Gemini, раунд 5: монетизация — бэкенд-логика

Полный контекст и бизнес-модель (цены/лимиты/тиры) — см.
[`docs/MONETIZATION.md`](../docs/MONETIZATION.md), прочитай целиком
перед стартом. Схему (`SubscriptionTier`/`Subscription`/`Promotion`) и
миграцию добавляю я — **дождись коммита со схемой** (проверь
`git log --oneline` на наличие коммита с этими моделями перед тем, как
писать код, использующий их — если схемы ещё нет, начни с пунктов,
которые от неё не зависят, см. порядок ниже).

Твоя зона в этом раунде — только `apps/api`, конкретные файлы указаны
по каждому пункту. Не трогай `apps/web`, `notifications-service` (кроме
пункта 4, где нужно только новое событие в `packages/shared-types`,
сам handler в notifications-service — по желанию, не обязателен).

## 1. Комиссия за вывод средств (P0, это баг, не фича)

`WITHDRAWAL_FEE` (1%, засеян в `prisma/seed.ts` ещё в Phase 1) нигде не
применяется. `WalletService.requestWithdrawal()` и `PayoutProcessor`
(`apps/api/src/modules/wallet/`) списывают у пользователя ровно `amount`
и на выплату по NOWPayments уходит тоже `amount` — комиссия платформы
никак не удерживается.

Нужно: при `requestWithdrawal()` — считать `fee = amount * WITHDRAWAL_FEE.percent / 100`
(тот же паттерн, что уже есть в `WalletService.releaseEscrow()` для
`MARKETPLACE_FEE` — используй его как образец), пользователю на выплату
уходит `amount - fee`, `fee` — отдельной проводкой `CREDIT system.MAIN`
в той же сбалансированной `LedgerTransaction` (три entries вместо двух,
как в `releaseEscrow`). Обнови `payout.processor.ts`, чтобы
NOWPayments payout API дёргался на `amount - fee`, а не на полный `amount`.

Обнови/добавь тесты в `wallet.service.spec.ts`/`payout.processor.spec.ts`
на удержание комиссии.

## 2. Комиссия по тиру подписки вместо плоского MARKETPLACE_FEE

**Зависит от схемы (дождись её).** В `WalletService.releaseEscrow()`
сейчас процент берётся только из `CommissionRule.MARKETPLACE_FEE`
(приватный метод `getMarketplaceFeePercent()`). Нужно: перед этим —
проверить, есть ли у **фрилансера** (не у клиента — комиссия платформы
берётся с того, кто получает деньги) активная `Subscription`
(`status: ACTIVE`, `expiresAt > now()`) — если да, использовать
`subscription.tier.commissionPercent` вместо дефолтного. Если подписки
нет — прежнее поведение (дефолт/`CommissionRule`).

## 3. Enforcement лимитов на отклики/заказы

**Зависит от схемы.** `SubscriptionTier.maxActiveBidsPerMonth` (для
фрилансера, на `OrdersService.submitBid()`) и
`maxActiveOrdersPerMonth` (для клиента, на `OrdersService.create()`,
`apps/api/src/modules/orders/orders.service.ts`).

Логика: посчитать, сколько у пользователя откликов/заказов за текущий
календарный месяц (`createdAt >= начало месяца`), сравнить с лимитом
его тира (эффективный тир = `STARTER`, если нет активной подписки —
у `STARTER` лимиты 10 откликов / 5 заказов, см. таблицу в
`docs/MONETIZATION.md`). Превышение → `BadRequestException` с понятным
сообщением ("Достигнут лимит откликов на вашем тарифе, оформите Pro").
`PREMIUM`/тир с `null` в лимите — без ограничений.

Тесты — обязательны, это меняет поведение существующих
`orders.service.spec.ts` тестов (там сейчас `submitBid`/`create`
вызываются без учёта лимитов — проверь, что старые тесты не сломались,
и добавь новые на сам лимит).

## 4. Сортировка заказов с учётом Promotion

**Зависит от схемы.** `OrdersService.findMany()` (`GET /orders`) — заказы
с активным `Promotion` (`entityType: ORDER`, `entityId: order.id`,
`expiresAt > now()`) должны идти первыми в списке (в рамках остальной
сортировки по `createdAt desc` — то есть сначала все продвинутые
отсортированные по дате, потом остальные). Добавь в ответ `GET /orders`
поле `isPromoted: boolean` на каждый заказ, чтобы фронт мог показать
бейдж.

## 5. Фоновая джоба истечения подписок

**Зависит от схемы.** BullMQ repeatable job (по образцу существующих
`Processor`/`WorkerHost` — смотри `payout.processor.ts` за паттерном,
только тут не событийный воркер, а `@Cron`-подобный: используй
`bullmq`'s repeatable job через `queue.add(name, data, { repeat: { pattern: '0 * * * *' } })`,
раз в час):

- Находит `Subscription` с `status: ACTIVE` и `expiresAt < now()` →
  переводит в `status: EXPIRED` (пользователь автоматически падает на
  эффективный `STARTER`, т.к. код везде проверяет `status: ACTIVE`)
- Находит `Subscription` с `status: ACTIVE` и `expiresAt` в интервале
  "через 3 дня" → публикует новое событие `SubscriptionExpiringSoon`
  (добавь в `packages/shared-types/src/events.ts`, payload
  `{ userId, tierName, expiresAt }`) — обработчик в
  notifications-service делать не обязательно в этом раунде (просто
  событие публикуется, письмо можно добавить отдельным раундом), но
  само событие должно существовать и публиковаться корректно.

## Definition of done

- [ ] Комиссия за вывод реально удерживается (тест на конкретную сумму)
- [ ] `releaseEscrow` использует тир фрилансера, если подписка активна
- [ ] Лимиты на отклики/заказы применяются, старые тесты
      `orders.service.spec.ts` не сломаны
- [ ] `GET /orders` возвращает `isPromoted`, продвинутые заказы первые
- [ ] Джоба экспирации подписок + событие `SubscriptionExpiringSoon`
- [ ] `pnpm --filter @taskhunt/api test` — всё зелёное
- [ ] `pnpm --filter @taskhunt/api build` — чисто

## Как отчитываться

[`STATUS_GEMINI_5.md`](./STATUS_GEMINI_5.md) — дописывай секции, не
перезаписывай файл целиком.
