# TaskHunt — ТЗ для второго разработчика (Codex): Frontend + Notifications/Fraud микросервисы

Этот документ самодостаточен: даже без остального контекста разговора, из
которого родился проект, здесь есть всё, что нужно для работы. Прочитай
целиком перед тем, как начать.

> **Обновление:** на бэкенде уже реализован OAuth (Google/GitHub/Apple).
> Если ещё не добавил кнопки "Войти через Google/GitHub/Apple" на
> `register`/`login` — это просто ссылки (не fetch, обычный `<a href>`,
> т.к. это full-page redirect):
> `${API_URL}/auth/google?role=CLIENT` (или `FREELANCER`),
> `${API_URL}/auth/github?role=...`, `${API_URL}/auth/apple?role=...`.
> После успешного входа бэкенд редиректит на
> `${WEB_URL}/oauth/callback?accessToken=...&refreshToken=...` — тебе
> нужно завести страницу `src/app/oauth/callback/page.tsx`, которая
> читает эти два query-параметра, сохраняет их через `saveTokens()` из
> `src/lib/api.ts` и редиректит на `/dashboard` (если это первый вход —
> отличить от повторного пока нельзя, поэтому веди на `/dashboard`, а не
> `/onboarding`; если нужно доанкетировать OAuth-пользователей — это
> отдельная задача, не блокирует MVP).

## 0. Что такое TaskHunt (коротко)

Фриланс-биржа (как Kwork/Weblancer), но с крипто-эскроу: заказчик платит
через NOWPayments, деньги замораживаются на платформе (эскроу), фрилансер
получает их после сдачи и приёмки работы. Все счета/инвойсы выставляются
прямо в чате заказа.

Полная архитектура — см. [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md).
Коротко: `apps/api` — модульный монолит NestJS (auth/wallet/orders/chat/
support/admin), деньги — через double-entry ledger, ACID-транзакции.
`apps/notifications-service` и `apps/fraud-service` — независимые
микросервисы, которые слушают события из очереди Redis/BullMQ и не трогают
деньги напрямую.

## 1. Что уже сделано (НЕ трогать, только читать как референс)

Backend (`apps/api`) — Phase 1 готов:
- `prisma/schema.prisma` — полная схема БД (User, Profile, Wallet,
  LedgerTransaction/LedgerEntry, Order, Bid, Milestone, Invoice, ChatThread/
  Message, SupportTicket, Dispute, StaffRole/Permission, AuditLog,
  FeatureFlag, CommissionRule и т.д.)
- `src/modules/auth` — регистрация (с выбором роли CLIENT/FREELANCER),
  логин, JWT, refresh
- `src/modules/users` — профиль + анкета/квиз (`OnboardingResponse`)
- `src/modules/wallet` — double-entry ledger, эскроу lock/release/refund,
  вывод средств, интеграция NOWPayments (создание платежа + IPN webhook)
- `src/modules/orders` — заказы, отклики (bids), versioning, disputes
- `src/modules/chat` — WebSocket-гейтвей чата по заказу + инвойсы прямо в
  чате (карточка появляется автоматически через событие `InvoiceIssued`)
- `src/modules/support` — тикеты поддержки со своим чатом
- `src/modules/admin` — RBAC (granular permissions), разрешение споров,
  feature flags, commission rules
- `src/modules/catalog` — категории (дерево) и навыки

Frontend (`apps/web`) — только начало:
- Next.js + Tailwind настроены (`package.json`, `tailwind.config.ts`,
  `next.config.mjs`)
- `src/lib/api.ts` — fetch-обёртка с JWT (используй её, не выдумывай свою)
- `src/app/page.tsx` — лендинг
- `src/app/register/page.tsx` — регистрация с выбором роли (уже готово,
  бери за образец стиля/паттерна для остальных страниц)

Общие типы: `packages/shared-types/src/events.ts` (контракт событий) и
`permissions.ts` (коды прав staff). Импортируются как `@taskhunt/shared-types`.

**Не трогай `apps/api/src/**`** — это зона первого разработчика, чтобы не
было конфликтов. Если для фронта не хватает эндпоинта — заведи заметку в
`docs/MISSING_ENDPOINTS.md` (создай файл, если его нет) вместо того, чтобы
лезть в бэкенд.

## 2. Твоя часть — что нужно построить

### 2.1 Frontend (`apps/web`) — оставшиеся страницы

Все страницы — App Router (`src/app/...`), Tailwind, паттерн из
`register/page.tsx`: `'use client'`, простой useState, вызовы через
`api()` из `src/lib/api.ts`.

**`src/app/onboarding/page.tsx`** — квиз после регистрации.
- Читает `?role=CLIENT|FREELANCER` из query
- Многошаговая форма (можно просто несколько условных блоков state `step`,
  без библиотек):
  - Для `FREELANCER`: experienceLevel (junior/middle/senior), interestedCategoryIds
    (мультиселект, тяни категории через `GET /categories`), expectedRateMin,
    availability (full_time/part_time/occasional)
  - Для `CLIENT`: primaryGoal (текст/селект), interestedCategoryIds,
    expectedBudgetMin
- По сабмиту — `POST /users/me/onboarding` с телом `OnboardingDto` (см. ниже),
  потом редирект на `/dashboard`

**`src/app/login/page.tsx`** — email/password форма, `POST /auth/login`,
`saveTokens()`, редирект на `/dashboard`.

**`src/app/dashboard/page.tsx`** — главный экран после логина:
- Показать баланс кошелька: `GET /wallet/balance` (mainBalance,
  escrowBalance, withdrawableBalance и т.д. — все Decimal, приходят как
  строки, парси через `Number()`)
- Список заказов: `GET /orders` (для FREELANCER — с возможностью открыть и
  откликнуться `POST /orders/:id/bids`; для CLIENT — с кнопкой "Создать
  заказ" → форма `POST /orders`)
- Ссылка на чат конкретного заказа (см. ниже)

**`src/app/orders/[id]/page.tsx`** — карточка заказа + чат:
- `GET /orders/:id` — детали, отклики
- Если есть `chatThread` (то есть отклик принят) — встроить чат:
  - Подключение через `socket.io-client` к
    `${NEXT_PUBLIC_API_URL}/chat` namespace, `auth: { token: accessToken }`
  - После коннекта `socket.emit('joinOrder', orderId)`
  - Слушать `socket.on('newMessage', ...)` — добавлять в список
  - Отправка: `socket.emit('sendMessage', { orderId, body })`
  - Сообщения типа `INVOICE` (`message.type === 'INVOICE'`) — рендерить
    отдельной карточкой "Счёт на оплату $X" с кнопкой (просто ссылка/заглушка
    на оплату — реальный редирект на `payAddress` из ответа
    `POST /wallet/invoices` относится к тому, кто ВЫСТАВИЛ инвойс, у него
    уже есть `payment.payAddress`; в MVP можно просто показать сумму и статус)
  - Если текущий юзер — фрилансер по этому заказу: кнопка "Выставить счёт" →
    форма → `POST /wallet/invoices { orderId, amount, description }`

**`src/app/admin/page.tsx`** — админ-панель (простая, без изысков):
- Табы: Users / Disputes / Feature Flags / Commissions
- Users: `GET /admin/users`, кнопки Ban/Suspend (`POST /admin/users/:id/ban`
  и `/suspend`)
- Disputes: `GET /admin/disputes`, кнопка "Assign to me"
  (`PATCH /admin/disputes/:id/assign`), форма разрешения
  (`PATCH /admin/disputes/:id/resolve { resolution, notes }`)
- Feature Flags: `GET /admin/feature-flags`, toggle →
  `PATCH /admin/feature-flags/:key { enabled }`
- Commissions: `GET /admin/commission-rules`, редактирование процента →
  `PATCH /admin/commission-rules/:type { percentage }`
- Это staff-only роуты — бэкенд сам вернёт 403, если у юзера нет прав;
  фронту достаточно скрыть пункт меню, если `GET /users/me` вернул
  `isStaff: false` (реальная защита всё равно на бэке)

### 2.2 `apps/notifications-service` — микросервис уведомлений

Отдельный Node.js процесс (НЕ NestJS HTTP-сервер, просто worker), который:
1. Подключается к тому же Redis (`REDIS_HOST`/`REDIS_PORT` из `.env`)
   и слушает очередь `taskhunt-events` (константа `EVENT_QUEUE_NAME` из
   `@taskhunt/shared-types`) через BullMQ `Worker`.
2. На каждое событие (`DomainEventName` из `@taskhunt/shared-types`) —
   определяет получателя и "отправляет" уведомление. Для MVP реальная
   отправка email/telegram не нужна — делай `console.log('[NOTIFY]', ...)`
   с чётким форматом, но структурируй код так, чтобы позже подставить
   реального провайдера (интерфейс `NotificationSender` с методом
   `send(userId, channel, payload)`).
3. Чтобы узнать email/displayName пользователя — создай **свою** тонкую
   Prisma-схему `apps/notifications-service/prisma/schema.prisma`,
   указывающую на тот же `DATABASE_URL`, но описывающую только модели
   `User` и `NotificationPreference` (как read-only проекцию, с теми же
   `@@map` именами таблиц, что в `apps/api/prisma/schema.prisma`). Не
   меняй эти таблицы, только читай.
4. Проверяй `NotificationPreference` перед "отправкой" — если канал
   выключен, пропускай.

Структура:
```
apps/notifications-service/
├── package.json          # bullmq, ioredis, @prisma/client, @taskhunt/shared-types
├── tsconfig.json
├── Dockerfile
├── .env.example          # DATABASE_URL, REDIS_HOST, REDIS_PORT
├── prisma/schema.prisma  # только User + NotificationPreference (read)
└── src/
    ├── main.ts           # создаёт BullMQ Worker, роутит по event.name
    ├── senders/console-sender.ts   # NotificationSender-заглушка через console.log
    └── handlers/*.ts     # по одному файлу-обработчику на каждый DomainEventName
```

События, которые нужно обработать (все типы и payload — в
`packages/shared-types/src/events.ts`, не выдумывай свои поля):
`UserRegistered`, `OrderCreated`, `BidSubmitted`, `BidAccepted`,
`InvoiceIssued`, `InvoicePaid`, `EscrowLocked`, `EscrowReleased`,
`WorkSubmitted`, `DisputeOpened`.

### 2.3 `apps/fraud-service` — микросервис риск-скоринга

Тоже отдельный worker на BullMQ, слушает `OrderCreated`, `BidAccepted`,
`DisputeOpened`. Для MVP — простая эвристика, БЕЗ настоящего ML:

```
risk = 0
if (order.budgetMin < 20) risk += 30           // подозрительно низкий бюджет
if (client.createdAt < 24h назад)  risk += 20  // аккаунт свежее суток
if (client.disputesCount > 2)      risk += 25  // уже был в спорах
// ...любые другие простые правила, какие сочтёшь разумными
```

Результат пиши в **свою собственную** таблицу (не лезь в схему api!):
создай `apps/fraud-service/prisma/schema.prisma` с одной новой моделью:

```prisma
model FraudSignal {
  id        String   @id @default(uuid())
  orderId   String   @unique
  riskScore Int
  reasons   String[]
  createdAt DateTime @default(now())

  @@map("fraud_signals")
}
```

(Это отдельная таблица в той же БД — не пересекается с моделями `apps/api`,
конфликтов миграций не будет.) Дополнительно подними внутри сервиса
маленький HTTP-эндпоинт (`GET /fraud-signals/:orderId`) на голом
`http.createServer` или Fastify — без Nest, чтобы не тащить лишнюю
зависимость ради одного роута. Порт возьми `3002`.

Структура аналогична `notifications-service`.

## 3. Справочник API (то, что фронту реально нужно вызывать)

Базовый URL берётся из `NEXT_PUBLIC_API_URL` (уже настроено в
`next.config.mjs`, дефолт `http://localhost:3001`).

```
POST /auth/register        { email, password, role: 'CLIENT'|'FREELANCER', displayName }
                            → { accessToken, refreshToken }
POST /auth/login           { email, password } → { accessToken, refreshToken }
POST /auth/refresh         { refreshToken } → { accessToken, refreshToken }

GET  /users/me             (auth) → { ...user, profile, onboarding, wallet }
PATCH /users/me/profile    (auth) { displayName?, bio?, country?, city?, githubUrl?, websiteUrl?, skillIds?[] }
POST /users/me/onboarding  (auth) { experienceLevel?, primaryGoal?, interestedCategoryIds?[], expectedBudgetMin?, expectedRateMin?, availability?, structuredAnswers?{} }

GET  /categories           → [{ id, name, slug, children: [...] }]
GET  /skills                → [{ id, name, slug }]

GET  /orders?categoryId=&status=
GET  /orders/:id            → { ...order, category, bids, milestones }
POST /orders                (auth, role CLIENT) { categoryId, title, description, budgetMin, budgetMax?, deadline? }
PATCH /orders/:id            (auth, владелец-клиент)
POST /orders/:id/bids        (auth, role FREELANCER) { amount, deliveryDays, message }
POST /orders/:id/bids/:bidId/accept  (auth, владелец-клиент)
POST /orders/:id/disputes    (auth, участник) { reason }

GET  /wallet/balance         (auth) → { mainBalance, escrowBalance, lockedBalance, withdrawableBalance, pendingBalance }
POST /wallet/withdraw        (auth) { amount }
POST /wallet/invoices        (auth, фрилансер) { orderId, milestoneId?, amount, description? }
                              → { invoice, payment: { paymentId, payAddress, payAmount, payCurrency } }

GET  /orders/:orderId/chat/messages       (auth, участник)
POST /orders/:orderId/chat/messages       { body }
POST /orders/:orderId/chat/messages/file  { fileId, body? }
DELETE /orders/:orderId/chat/messages/:messageId

WebSocket namespace "/chat":
  connect  → handshake.auth = { token: accessToken }
  emit     "joinOrder" (orderId: string)
  emit     "sendMessage" { orderId, body } → ack = сообщение, всем в комнате "newMessage"
  emit     "typing" (orderId: string) → остальным в комнате "typing" { userId }

POST /support/tickets       (auth) { subject, message, priority? }
GET  /support/tickets/mine  (auth)
POST /support/tickets/:id/messages (auth) { body }

GET   /admin/users?status=
POST  /admin/users/:id/ban
POST  /admin/users/:id/suspend
GET   /admin/disputes?status=
PATCH /admin/disputes/:id/assign
PATCH /admin/disputes/:id/resolve   { resolution: 'RESOLVED_CLIENT'|'RESOLVED_FREELANCER', notes? }
GET   /admin/feature-flags
PATCH /admin/feature-flags/:key     { enabled: boolean }
GET   /admin/commission-rules
PATCH /admin/commission-rules/:type { percentage?, fixedAmount? }
```

Все Decimal-поля (деньги) Prisma отдаёт в JSON как строки — приводи через
`Number(...)` перед арифметикой/форматированием на фронте.

## 4. Договорённости

- TypeScript strict, без `any` без крайней необходимости
- Не трогать `apps/api/**`, `packages/shared-types/**` (если не хватает
  типа события — напиши в `docs/MISSING_ENDPOINTS.md`, первый разработчик
  добавит)
- Каждый микросервис — независимый `package.json`, свой `Dockerfile`
  (копируй паттерн из `apps/api/Dockerfile`, но без Nest build — просто
  `tsc` + `node dist/main.js`)
- `docker-compose.yml` в корне уже содержит сервисы `notifications-service`
  и `fraud-service` (порты/volumes проброшены) — не переписывай его, только
  добавь `.env` рядом со своими сервисами по образцу `apps/api/.env.example`

## 5. Definition of done

- [ ] `apps/web`: onboarding, login, dashboard, order+chat, admin — все
      страницы компилируются (`pnpm --filter @taskhunt/web build`) и
      реально вызывают перечисленные эндпоинты (можно проверить руками
      через `pnpm dev` при поднятом `apps/api`)
- [ ] `apps/notifications-service`: `pnpm --filter notifications-service build`
      проходит, воркер стартует и логирует событие при публикации через API
      (например, после `POST /auth/register` в консоли воркера должно
      появиться `[NOTIFY] UserRegistered ...`)
- [ ] `apps/fraud-service`: аналогично, плюс `GET /fraud-signals/:orderId`
      отвечает после того, как для этого заказа пришло событие `OrderCreated`
