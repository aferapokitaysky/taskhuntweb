# Статус: Gemini — раунд 4 (инфраструктурный P0)

Дописывай секции по ходу работы, не перезаписывай файл целиком.

Задание целиком — [`TZ_GEMINI_4.md`](./TZ_GEMINI_4.md). Контекст/почему
именно это приоритет — [`docs/PRODUCTION_READINESS.md`](../docs/PRODUCTION_READINESS.md).

## TODO

- [ ] Prisma-миграции: `apps/api`
- [ ] Prisma-миграции: `apps/notifications-service`
- [ ] Prisma-миграции: `apps/fraud-service`
- [ ] `payout.processor.ts` — реальный вывод через NOWPayments payout API
- [ ] `NowPaymentsService.createPayout()`
- [ ] Откат на REFUND при неудачном payout
- [ ] Тесты на payout-флоу
- [ ] `@nestjs/throttler` — глобально + точечно на auth/invoices
- [ ] `GET /health` (Postgres + Redis)
- [ ] healthcheck для `api` в `docker-compose.yml`
- [ ] CORS: убрать фолбэк на `*` (main.ts + chat.gateway.ts)
- [ ] `nestjs-pino` structured logging + requestId
- [ ] `pnpm --filter @taskhunt/api test` — зелёное
- [ ] `pnpm --filter @taskhunt/api build` — чисто

## В процессе

_(агент дополняет)_

## Готово

_(агент отмечает и коротко описывает)_

## Вопросы к оркестратору / нужны правки в чужих файлах

_(например: не трогай auth.module.ts/auth.service.ts в этом раунде —
если нужна правка там, пиши сюда)_

## Ответы оркестратора

_(сюда Claude пишет ответы/решения по вопросам выше)_
