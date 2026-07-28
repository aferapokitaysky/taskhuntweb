# TaskHunt — ТЗ для Gemini, раунд 6: публичные профили, поиск, admin, уведомления, E2E

Большой раунд — читай `docs/PRODUCTION_READINESS.md` целиком (разделы
"Новые пробелы" и P1) перед стартом, там контекст по каждому пункту.
Прочитай `git log --oneline -20` — с прошлого раза ничего конфликтного
не добавлялось в твою зону, но проверь на всякий случай.

Твоя зона — весь `apps/api`. Не трогай `apps/web` — фронтенд под эти
эндпоинты делаю я, часть моих страниц будет ждать твои эндпоинты, это
нормально, не блокирует тебя.

## 1. Публичный профиль пользователя

`GET /users/:id` (без auth, публичный) — новый эндпоинт в
`apps/api/src/modules/users/`. Возвращает **только публичные данные**:

```ts
{
  id, primaryRole, roles,
  profile: { displayName, avatarUrl, bio, country, city, githubUrl, websiteUrl,
             successRate, completionRate, avgResponseMins, disputesCount, lateDeliveries,
             skills: [{ id, name, slug }] },
  subscriptionTier: 'STARTER' | 'PRO' | 'PREMIUM', // эффективный тир — используй тот же паттерн, что в SubscriptionsService.getMyEffectiveSubscription()
  reviews: [{ rating, comment, createdAt, author: { displayName } }], // переиспользуй логику ReviewsService.listForUser()
}
```

**Никогда не отдавай** `email`, `passwordHash`, токены и т.д. — 404,
если пользователь не найден.

## 2. Поиск фрилансеров

`GET /freelancers?categoryId=&skillId=&search=` (публичный) — новый
контроллер, например `apps/api/src/modules/users/freelancers.controller.ts`
в том же модуле. Фильтрует пользователей с `FREELANCER` в `roles`,
опционально по навыку (join через `ProfileSkill`) и по `search`
(case-insensitive contains по `displayName`/`bio`).

**Важно для бизнес-модели** (см. `docs/MONETIZATION.md` — Premium
обещает "featured placement in search"): пользователи с активной
`Subscription` на тир `PREMIUM` должны идти **первыми** в выдаче (тот же
принцип, что уже реализован для `isPromoted` в `OrdersService.findMany()`
— посмотри свою же реализацию оттуда как образец).

## 3. Поиск заказов

Расширь `OrdersService.findMany()` (`apps/api/src/modules/orders/orders.service.ts`)
параметром `search` — `OR` по `title`/`description`
(`{ contains: search, mode: 'insensitive' }`), в дополнение к уже
существующим `categoryId`/`status`. Не трогай сортировку по
`isPromoted`, которую ты уже сделал в прошлом раунде — просто добавляешь
ещё один фильтр в `where`.

## 4. Admin: категории и навыки

`apps/api/src/modules/admin/` — новые методы в `AdminService` +
роуты в `AdminController` (тот же паттерн `@RequirePermissions`, что уже
используется там):

- `POST /admin/categories`, `PATCH /admin/categories/:id`, `DELETE /admin/categories/:id`
- `POST /admin/skills`, `PATCH /admin/skills/:id`, `DELETE /admin/skills/:id`

Права: добавь новый `PermissionCode.CatalogManage` в
`packages/shared-types/src/permissions.ts`, включи его в
`DEFAULT_STAFF_ROLES.OWNER` и `MODERATOR` (посмотри, как это уже
устроено для остальных прав в этом файле).

## 5. Admin: метрики

`GET /admin/metrics` (права — `PermissionCode.FinanceViewReports`, уже
есть):

```ts
{
  revenue: { total: number, thisMonth: number }, // сумма CREDIT-проводок на system.MAIN по типам COMMISSION/WITHDRAWAL(комиссия)/подписки — смотри LedgerEntry
  activeDisputes: number,
  ordersByStatus: { OPEN: number, IN_PROGRESS: number, COMPLETED: number, ... },
  newUsersThisWeek: number,
  activeSubscriptionsByTier: { STARTER: number, PRO: number, PREMIUM: number },
}
```

Для `revenue` — считай через `prisma.ledgerEntry.aggregate` с фильтром
по `walletId` системного кошелька и `direction: 'CREDIT'` за нужный
период (используй `WalletService.getSystemWalletId()`).

## 6. In-app уведомления

Новая модель в `apps/api/prisma/schema.prisma`:

```prisma
model Notification {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  title     String
  message   String
  eventName String   // DomainEventName, для дебага/фильтрации
  read      Boolean  @default(false)
  createdAt DateTime @default(now())

  @@index([userId, read])
  @@map("notifications")
}
```

Не забудь добавить обратную связь `notifications Notification[]` на
`User` и сгенерировать migration (`prisma migrate dev --name add_notifications`
с реальной Postgres, как ты уже делал в прошлых раундах — или используй
`prisma migrate diff --from-url ... --to-schema-datamodel ...` без
интерактивного режима, если проще).

Новый модуль `apps/api/src/modules/notifications/` (не путать с
микросервисом `apps/notifications-service` — это другое, локальное
хранилище для UI):

- `NotificationsEventsListener` — слушает через `@OnEvent()` те же
  события, что уже обрабатывает `notifications-service` (см.
  `apps/notifications-service/src/handlers/*.ts` как справочник по
  текстам title/message — можно скопировать формулировки), но вместо
  отправки email просто создаёт `Notification` в БД. Подпишись минимум
  на: `BidAccepted`, `InvoicePaid`, `EscrowReleased`, `WorkSubmitted`,
  `DisputeOpened`.
- `GET /notifications/me?unreadOnly=` — список (+ `unreadCount` в ответе)
- `PATCH /notifications/:id/read`
- `PATCH /notifications/read-all`

## 7. Graceful shutdown в apps/api

`apps/api/src/main.ts` — сейчас нет обработки `SIGTERM` вообще (сравни
с `apps/notifications-service/src/main.ts`/`apps/fraud-service/src/main.ts`,
там уже закрывают worker/prisma/redis по-человечески). Добавь
`app.enableShutdownHooks()` + слушатель `process.on('SIGTERM', ...)`,
закрывающий Nest-приложение корректно.

## 8. E2E-тест критического пути

Новый файл `apps/api/test/critical-path.e2e-spec.ts` (используй
supertest, `@nestjs/testing`, поднимай реальный `AppModule` целиком).
Нужна реальная Postgres — по аналогии с тем, как ты сам гонял `prisma
migrate` на реальной БД в прошлых раундах, подними тестовую БД (можно
через `docker run` временный контейнер, как в `apps/api/prisma/migrations`
история, или через уже поднятый `docker compose`, если он у тебя
крутится — на твоё усмотрение, главное чтобы тест был воспроизводим).

Сценарий одним тестом (или цепочкой в одном `describe`, где шаги
зависят друг от друга):

1. `POST /auth/register` (клиент) → получить токен
2. `POST /auth/register` (фрилансер) → получить токен
3. Клиент: `POST /orders` → создать заказ
4. Фрилансер: `POST /orders/:id/bids` → отклик
5. Клиент: `POST /orders/:id/bids/:bidId/accept` → принять
6. Фрилансер: `POST /wallet/invoices` → выставить счёт (NOWPayments в
   тестах замокай — не ходи в реальный интернет; замокай
   `NowPaymentsService` через `overrideProvider` в тестовом модуле)
7. Симулируй IPN: вызови `InvoiceService.markPaidAndLockEscrow()` напрямую
   (или через `POST /wallet/nowpayments/ipn` с валидной тестовой
   подписью, если проще замокать `verifyIpnSignature`)
8. Фрилансер: `POST /orders/:id/deliver`
9. Клиент: `POST /orders/:id/approve` → релиз эскроу
10. **Проверка:** баланс фрилансера (`GET /wallet/balance`) вырос ровно
    на `amount - комиссия`, а не на полную сумму — это и есть весь смысл
    E2E-теста, юнит-тесты такое не ловят, потому что мокают Prisma

## 9. Доп. юнит-тесты

По остаточному принципу, если время останется после пунктов 1-8:
`chat.service.ts`, `files.service.ts`, `catalog.service.ts` — базовые
CRUD-тесты по образцу уже написанных.

## 10. Bull Board

`@bull-board/api` + `@bull-board/express` (или `@bull-board/nestjs`, если
есть подходящий адаптер под текущую версию Nest — проверь совместимость).
Смонтируй на `/admin/queues`, защити хотя бы базовой проверкой (staff-only
— можно через `JwtAuthGuard` + `PermissionsGuard` на роуте, если
`@bull-board/nestjs` это позволяет, иначе через middleware). Покажи все
существующие очереди: `taskhunt-events`, `payout-queue`,
`file-virus-scan`, `subscription-expiration`.

## Definition of done

- [ ] `GET /users/:id` — публичный профиль, ничего чувствительного не течёт
- [ ] `GET /freelancers` — поиск с фильтрами, Premium первыми
- [ ] `GET /orders?search=` — работает
- [ ] Admin CRUD категорий/навыков + новый `PermissionCode.CatalogManage`
- [ ] `GET /admin/metrics`
- [ ] In-app уведомления: модель + миграция + listener + 3 эндпоинта
- [ ] Graceful shutdown в `apps/api/src/main.ts`
- [ ] E2E-тест критического пути проходит на реальной Postgres
- [ ] Bull Board на `/admin/queues`
- [ ] `pnpm --filter @taskhunt/api test` — всё зелёное (юнит + e2e)
- [ ] `pnpm --filter @taskhunt/api build` — чисто

## Как отчитываться

[`STATUS_GEMINI_6.md`](./STATUS_GEMINI_6.md) — дописывай секции, не
перезаписывай файл целиком. Раунд большой — обновляй файл почаще, не
только в конце, мне нужно видеть прогресс по ходу, чтобы вовремя
подхватывать готовые эндпоинты во фронт.
