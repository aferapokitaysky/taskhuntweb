# Статус: Gemini — раунд 4 (инфраструктурный P0)

Дописывай секции по ходу работы, не перезаписывай файл целиком.

Задание целиком — [`TZ_GEMINI_4.md`](./TZ_GEMINI_4.md). Контекст/почему
именно это приоритет — [`docs/PRODUCTION_READINESS.md`](../docs/PRODUCTION_READINESS.md).

## TODO

- [x] Prisma-миграции: `apps/api`
- [x] Prisma-миграции: `apps/notifications-service`
- [x] Prisma-миграции: `apps/fraud-service`
- [x] `payout.processor.ts` — реальный вывод через NOWPayments payout API
- [x] `NowPaymentsService.createPayout()`
- [x] Откат на REFUND при неудачном payout
- [x] Тесты на payout-флоу
- [x] `@nestjs/throttler` — глобально + точечно на auth/invoices
- [x] `GET /health` (Postgres + Redis)
- [x] healthcheck для `api` в `docker-compose.yml`
- [x] CORS: убрать фолбэк на `*` (main.ts + chat.gateway.ts)
- [x] `nestjs-pino` structured logging + requestId
- [x] `pnpm --filter @taskhunt/api test` — зелёное (49/49)
- [x] `pnpm --filter @taskhunt/api build` — чисто

## В процессе

- Все инфраструктурные P0-задачи Раунда 4 завершены. Детали логов в [`gemini_conv_4.md`](./gemini_conv_4.md).

## Готово

- [x] Закоммичены папки `prisma/migrations/` во всех трех сервисах (`api`, `notifications-service`, `fraud-service`).
- [x] Реализован воркер вывода средств `PayoutProcessor` с автоматическим откатом `REFUND` транзакции в `LedgerService` при сбоях NOWPayments Payout API. Написан сьют юнит-тестов `payout.processor.spec.ts`.
- [x] Добавлен `@nestjs/throttler` (глобальный лимит 100 зап/мин + защита от брутфорса `login`/`register` 5 зап/мин и защиты от спама инвойсами 10 зап/мин).
- [x] Добавлен эндпоинт `GET /health` и настроен `healthcheck` контейнера `api` в `docker-compose.yml`.
- [x] Закрыты CORS дыры в `main.ts` и `chat.gateway.ts` (запрет `*`, требование явно заданного `WEB_PUBLIC_URL`).
- [x] Внедрён структурированный логгер `nestjs-pino` с трекингом `requestId`.
- [x] Проведены проверки: 49/49 unit-тестов зелёные, сборка компилируется без ошибок.

## Вопросы к оркестратору / нужны правки в чужих файлах

1. Вопросов нет, весь бэкенд P0 блок завершен.

## Ответы оркестратора

_(сюда Claude пишет ответы/решения по вопросам выше)_
