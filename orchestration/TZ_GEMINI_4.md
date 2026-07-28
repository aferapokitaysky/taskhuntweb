# TaskHunt — ТЗ для Gemini, раунд 4: инфраструктурный P0

Полный контекст и почему именно это приоритет — см.
[`docs/PRODUCTION_READINESS.md`](../docs/PRODUCTION_READINESS.md) (разделы
P0 №1, 2, 5-9). Здесь — конкретные шаги.

Прочитай `git log --oneline -10` перед стартом. Твоя зона — только бэкенд-
инфраструктура, оркестратор параллельно делает auth-флоу (email-
верификация/password reset) и фронтенд — те же файлы вы не трогаете
оба, но `auth.module.ts`/`auth.service.ts` в этом раунде тоже мои — не
редактируй их, если понадобится их изменить, опиши в
`STATUS_GEMINI_4.md`.

## 1. Prisma-миграции (все три сервиса)

Сейчас `apps/api/prisma/migrations/` не существует вообще — схема
никогда не проходила через нормальный migration workflow.

Для каждого из `apps/api`, `apps/notifications-service`,
`apps/fraud-service`:
```bash
cd apps/<service> && npx prisma migrate dev --name init
```
Закоммить получившуюся `prisma/migrations/`. **Важно:** у
notifications-service и fraud-service схемы — узкие read/own-таблицы
проекции на ту же БД, что и api (см. `docs/ARCHITECTURE.md` про
"shared database, separate schema per bounded context"). Если
`migrate dev` попытается создать/удалить таблицы, которыми не владеет
этот сервис (например notifications-service увидит отсутствие своих
`User`/`NotificationPreference` в его локальной "истории" и предложит их
создать, хотя они уже существуют, созданные миграцией api) — **не давай
ему это сделать** (`migrate dev` спросит подтверждение на разрушительные
операции, там где предлагает drop/create чужих таблиц — отвечай нет,
разберись руками или через `prisma migrate resolve --applied`). Опиши в
`STATUS_GEMINI_4.md`, как разрулил, если было неочевидно.

## 2. Воркер реального вывода денег (payout)

Сейчас `WalletService.requestWithdrawal()` (`apps/api/src/modules/wallet/wallet.service.ts`)
списывает `WITHDRAWABLE` через ledger и всё — крипта никуда не уходит.

Создай `apps/api/src/modules/wallet/payout.processor.ts` — BullMQ
`WorkerHost` (по образцу `apps/api/src/modules/files/scan.processor.ts` —
тот же паттерн `@Processor`/`process()`).

Флоу:
1. `WalletController.withdraw()` после `requestWithdrawal()` кладёт job
   в новую очередь `payout-queue` с `{ ledgerTransactionId, userId, amount, payoutAddress }`
   (адрес вывода — добавь поле `payoutAddress: string` в
   `WithdrawDto`, пользователь должен его прислать).
2. `PayoutProcessor.process()` — дёргает NOWPayments payout API (смотри
   `apps/api/src/modules/wallet/nowpayments.service.ts` как пример
   тонкого клиента поверх их REST — добавь туда метод `createPayout()`
   по аналогии с `createPayment()`).
3. Успех → ничего дополнительно двигать в ledger не нужно (деньги уже
   списаны при `requestWithdrawal`), просто залогировать/можно завести
   поле статуса на `LedgerTransaction` через `description` (не меняй
   схему ради этого — используй `description` с JSON или отдельное простое
   поле `payoutStatus String?` на `LedgerTransaction`, если действительно
   нужно — обсуди в STATUS-файле, если не уверен, стоит ли трогать схему).
4. **Неудача** (NOWPayments вернул ошибку, или воркер упал после
   retry-лимита) → обязательно откатить деньги обратно пользователю:
   новая `LedgerTransaction` типа `REFUND` через `LedgerService`,
   `DEBIT system.MAIN` / `CREDIT userWallet.WITHDRAWABLE` на ту же сумму.
   Деньги никогда не должны "зависать" неопределённо — это самое важное
   свойство этой задачи, ровно как идемпотентность в `ReferralsService`
   на прошлом раунде.

Тесты по образцу `wallet.service.spec.ts`/`ledger.service.spec.ts` —
обязательны, это снова денежный путь.

## 3. Rate limiting

Добавь `@nestjs/throttler`. Глобально — разумный дефолт (например 100
запросов/минуту на IP), точечно ужесточи на:
- `POST /auth/login`, `POST /auth/register` — например 5/минуту на IP
  (brute-force защита)
- `POST /wallet/invoices` — например 10/минуту на пользователя (защита
  от спама инвойсами)

Подключается через `ThrottlerModule.forRoot()` в `app.module.ts` (это
общий файл — просто добавь импорт рядом с остальными, не переписывай
структуру) + `@Throttle()` декоратор точечно на нужных методах
контроллеров.

## 4. Health-check эндпоинт

`GET /health` — простой, без auth. Проверяет реальную доступность
Postgres (`prisma.$queryRaw\`SELECT 1\``) и Redis (ping через ioredis).
Возвращает `{ status: 'ok', db: true, redis: true }` или 503 при сбое
одной из зависимостей. Можно на голом контроллере без отдельного модуля
(`apps/api/src/modules/health/health.controller.ts`) — не нужен весь
`@nestjs/terminus`, если не хочется тащить лишнюю зависимость (но можно
и его, на твой выбор).

Добавь `healthcheck` для сервиса `api` в `docker-compose.yml` по образцу
уже существующих у `postgres`/`redis`/`clamav` — **сюда допускается
править сам** (curl на `http://localhost:3001/health`), это чисто
добавление блока для твоего же сервиса, не пересекается ни с кем.

## 5. CORS

- `apps/api/src/main.ts` — сейчас `origin: process.env.WEB_PUBLIC_URL ?? '*'`.
  Убери фолбэк на `*`: если `WEB_PUBLIC_URL` не задан — падать явно при
  старте (`throw` в `main.ts` до `app.listen()`) лучше, чем молча
  разрешать любой origin в проде.
- `apps/api/src/modules/chat/chat.gateway.ts` — `cors: { origin: '*' }`
  на WebSocket-неймспейсе — тот же фикс, брать origin из
  `process.env.WEB_PUBLIC_URL`.

## 6. Structured logging

Замени голый `console.log`/Nest `Logger` на `nestjs-pino` (пакет
`nestjs-pino` + `pino-http`). Подключить как `LoggerModule.forRoot()` в
`app.module.ts`. Не обязательно переписывать все существующие
`this.logger.log(...)` по всему коду — pino подхватывает стандартный
Nest `Logger` интерфейс прозрачно, если настроить как замену дефолтного
логгера через `app.useLogger(app.get(Logger))` в `main.ts`. Добавь
`requestId` (pino-http делает это из коробки) — это то, чего сейчас нет
вообще и что нужнее всего для дебага в проде.

## Definition of done

- [ ] `prisma/migrations/` закоммичены во всех трёх сервисах
- [ ] `payout.processor.ts` + тесты, ручной сценарий описан в STATUS
      (что произойдёт при фейле NOWPayments — деньги должны вернуться)
- [ ] Rate limiting настроен и виден в `app.module.ts`
- [ ] `GET /health` отвечает, healthcheck в `docker-compose.yml` для `api`
- [ ] CORS без фолбэка на `*` нигде (main.ts + chat.gateway.ts)
- [ ] Structured logging подключён, `requestId` присутствует в логах
- [ ] `pnpm --filter @taskhunt/api test` — всё зелёное (старые + новые)
- [ ] `pnpm --filter @taskhunt/api build` — чисто

## Как отчитываться

[`STATUS_GEMINI_4.md`](./STATUS_GEMINI_4.md) — дописывай секции, не
перезаписывай файл целиком.
