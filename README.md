# TaskHunt

Фриланс-биржа со встроенным крипто-эскроу: платежи через NOWPayments,
деньги удерживаются платформой и уходят фрилансеру только после приёмки
работы.

**[🇷🇺 Русский](#russian-version) · [🇬🇧 English](#english-version)**

---

<a id="russian-version"></a>
## 🇷🇺 Русский

### О проекте

TaskHunt — фриланс-биржа с встроенным крипто-эскроу: заказчик платит через
NOWPayments, деньги замораживаются на платформе и уходят фрилансеру только
после сдачи и приёмки работы. Инвойсы и чеки — прямо в чате заказа.

Архитектура — модульный монолит для денежной/бизнес-логики плюс отдельные
событийные микросервисы для всего, что не трогает деньги напрямую
(уведомления, риск-скоринг). Подробности — в [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

### Ключевые возможности

- Регистрация с выбором роли (заказчик/фрилансер), вход через
  Google/GitHub/Apple, анкета/квиз при онбординге
- Wallet + double-entry ledger, эскроу lock/release/refund, интеграция
  NOWPayments, вывод средств
- Заказы, отклики (bids), версионирование, milestone-ы, сдача работы,
  приёмка, отзывы, споры
- Чат по заказу (WebSocket) с автоматическими карточками инвойсов
- Каталог, поиск и подбор (matching), сохранённые поиски
- Тикеты поддержки со своим чатом
- Реферальная программа, промо-акции, подписки
- Admin-панель: granular RBAC, разрешение споров, feature flags,
  настраиваемые комиссии
- Загрузка файлов в S3-совместимое хранилище с антивирус-сканом (ClamAV)
- Отдельный сервис риск-скоринга заказов и пользователей (fraud-service)

Полный статус реализации и то, что осознанно оставлено на потом (Phase 2+),
см. в [`docs/PRODUCTION_READINESS.md`](docs/PRODUCTION_READINESS.md).

### Стек технологий

| Слой | Технологии |
|---|---|
| Backend (API) | NestJS 10, Prisma 5 + PostgreSQL, Redis + BullMQ, Socket.io, Passport (JWT/Google/GitHub/Apple OAuth), nestjs-pino |
| Frontend | Next.js 14 (App Router), React 18, Tailwind CSS, Zustand, Zod, Socket.io-client |
| Микросервисы | notifications-service (email через Resend, Telegram, push — BullMQ-воркер), fraud-service (риск-скоринг, BullMQ-воркер) |
| Общий код | packages/shared-types — TS-типы, контракт событий |
| Платежи | NOWPayments (крипто-эскроу) |
| Файлы/антивирус | S3-совместимое хранилище (AWS SDK v3) + ClamAV |
| Инфраструктура | Docker Compose (Postgres, Redis, ClamAV, api, web, воркеры), Turborepo + pnpm workspaces |
| Тесты/CI | Jest, GitHub Actions |

### Структура репозитория

```
taskhunt/
├── apps/
│   ├── api/                     # NestJS монолит — вся бизнес-логика и деньги
│   │   ├── prisma/schema.prisma # единая схема БД
│   │   └── src/modules/
│   │       ├── auth/            # регистрация, логин, JWT, OAuth, роли
│   │       ├── users/           # профиль, анкета/квиз
│   │       ├── wallet/          # Wallet + Ledger (double-entry), эскроу
│   │       ├── orders/          # заказы, отклики (bids), milestone-ы
│   │       ├── chat/            # чат по заказу + инвойсы в чате
│   │       ├── catalog/         # категории и справочники
│   │       ├── search/          # поиск
│   │       ├── matching/        # подбор заказов/исполнителей
│   │       ├── saved-searches/  # сохранённые поисковые запросы
│   │       ├── files/           # загрузка файлов, S3, антивирус-скан
│   │       ├── support/         # чат с поддержкой (тикеты)
│   │       ├── referrals/       # реферальная программа
│   │       ├── promotions/      # промо-акции
│   │       ├── subscriptions/   # подписки
│   │       ├── fraud/           # интеграция с fraud-service
│   │       ├── notifications/   # интеграция с notifications-service
│   │       ├── admin/           # RBAC, панель админа
│   │       └── health/          # health-check
│   ├── web/                     # Next.js — клиентская часть + админка
│   ├── notifications-service/   # воркер: email/telegram/push по событиям
│   └── fraud-service/           # воркер: риск-скоринг заказов
├── packages/
│   └── shared-types/            # общие TS-типы, контракт событий
├── docs/
│   ├── ARCHITECTURE.md          # архитектура и денежная модель
│   ├── TZ_CODEX.md              # техническое задание для фронтенда/воркеров
│   ├── MONETIZATION.md          # модель монетизации
│   ├── PRODUCTION_READINESS.md  # аудит готовности к проду
│   ├── MISSING_ENDPOINTS.md     # рабочий журнал вопросов фронт/бэк
│   └── CONTRIBUTING.md          # правила работы с git
├── docker-compose.yml
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

### Требования

- Node.js 20+
- pnpm 9+ (`corepack enable` включает нужную версию автоматически)
- Docker + Docker Compose (для Postgres/Redis/ClamAV, либо для запуска всего целиком)

### Быстрый старт (всё в Docker)

```bash
cp apps/api/.env.example apps/api/.env
# заполнить apps/api/.env реальными значениями (см. apps/api/.env.example)

docker compose up --build
```

Поднимутся: `postgres` (5432), `redis` (6379), `clamav` (3310), `api` (3001),
`web` (3000), `notifications-service`, `fraud-service`. После первого старта
нужно накатить миграции и сид (см. ниже) — Docker их не запускает
автоматически.

### Локальная разработка (без Docker, быстрее для итераций)

```bash
pnpm install

# поднять только инфраструктуру в Docker
docker compose up postgres redis clamav -d

# .env для бэкенда (DATABASE_URL/REDIS_HOST должны указывать на localhost, не на имена сервисов)
cp apps/api/.env.example apps/api/.env

pnpm --filter @taskhunt/api prisma:migrate
pnpm --filter @taskhunt/api prisma:seed

pnpm dev   # turbo run dev — поднимет api (3001) и web (3000) параллельно
```

### Переменные окружения (`apps/api/.env`)

Минимум для локального запуска без внешних интеграций:

```
DATABASE_URL="postgresql://taskhunt:taskhunt@localhost:5432/taskhunt?schema=public"
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=любая-длинная-случайная-строка
API_PUBLIC_URL=http://localhost:3001
WEB_PUBLIC_URL=http://localhost:3000
```

Всё остальное (`GOOGLE_CLIENT_ID`, `NOWPAYMENTS_API_KEY`, `S3_*`,
`CLAMAV_*` и т.д.) можно оставить пустым — сервер стартует и без них, но
соответствующие функции (OAuth-вход, приём платежей, загрузка файлов,
антивирус-скан) работать не будут, пока не подставить реальные ключи.
Полный список — в [`apps/api/.env.example`](apps/api/.env.example).

### Миграции и сид

```bash
pnpm --filter @taskhunt/api prisma:migrate   # накатить схему
pnpm --filter @taskhunt/api prisma:seed      # системный кошелёк, staff-роли,
                                              # базовые категории, комиссии, feature flags
```

Без сида платежи и эскроу не заработают: `WalletService` ищет системный
кошелёк-контрагент (`system@taskhunt.internal`) как противоположную сторону
для внешних движений денег в double-entry ledger — без него любая попытка
провести платёж упадёт с понятной ошибкой "run prisma:seed".

### Документация

Подробности по архитектуре, денежной модели, монетизации и статусу
готовности к проду — в папке [`docs/`](docs/):

- [`ARCHITECTURE.md`](docs/ARCHITECTURE.md) — общая картина, event bus, денежная модель
- [`TZ_CODEX.md`](docs/TZ_CODEX.md) — техзадание для фронтенда и микросервисов
- [`MONETIZATION.md`](docs/MONETIZATION.md) — модель монетизации
- [`PRODUCTION_READINESS.md`](docs/PRODUCTION_READINESS.md) — аудит готовности к проду
- [`MISSING_ENDPOINTS.md`](docs/MISSING_ENDPOINTS.md) — рабочий журнал вопросов между фронтом и бэком
- [`CONTRIBUTING.md`](docs/CONTRIBUTING.md) — правила работы с git

---

<a id="english-version"></a>
## 🇬🇧 English

### About

TaskHunt is a freelance marketplace with built-in crypto escrow: the client
pays via NOWPayments, funds are held by the platform and released to the
freelancer only after the work is submitted and accepted. Invoices and
receipts live directly in the order chat.

The architecture is a modular monolith for money/business logic, plus
separate event-driven microservices for everything that doesn't touch money
directly (notifications, fraud scoring). See
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for details.

### Key Features

- Registration with role selection (client/freelancer), Google/GitHub/Apple
  OAuth login, onboarding questionnaire/quiz
- Wallet + double-entry ledger, escrow lock/release/refund, NOWPayments
  integration, withdrawals
- Orders, bids, versioning, milestones, work submission, acceptance,
  reviews, disputes
- Order chat (WebSocket) with automatic invoice cards
- Catalog, search and matching, saved searches
- Support tickets with their own chat
- Referral program, promotions, subscriptions
- Admin panel: granular RBAC, dispute resolution, feature flags,
  configurable commissions
- File uploads to S3-compatible storage with antivirus scanning (ClamAV)
- Dedicated risk-scoring service for orders and users (fraud-service)

For the full implementation status and what's deliberately deferred to
Phase 2+, see [`docs/PRODUCTION_READINESS.md`](docs/PRODUCTION_READINESS.md).

### Tech Stack

| Layer | Technologies |
|---|---|
| Backend (API) | NestJS 10, Prisma 5 + PostgreSQL, Redis + BullMQ, Socket.io, Passport (JWT / Google / GitHub / Apple OAuth), nestjs-pino |
| Frontend | Next.js 14 (App Router), React 18, Tailwind CSS, Zustand, Zod, Socket.io-client |
| Microservices | notifications-service (email via Resend, Telegram, push — BullMQ worker), fraud-service (risk scoring — BullMQ worker) |
| Shared code | packages/shared-types — shared TS types, event contracts |
| Payments | NOWPayments (crypto escrow) |
| Files / antivirus | S3-compatible storage (AWS SDK v3) + ClamAV |
| Infrastructure | Docker Compose (Postgres, Redis, ClamAV, api, web, workers), Turborepo + pnpm workspaces |
| Tests / CI | Jest, GitHub Actions |

### Repository Structure

```
taskhunt/
├── apps/
│   ├── api/                     # NestJS monolith — all business logic and money
│   │   ├── prisma/schema.prisma # single DB schema
│   │   └── src/modules/
│   │       ├── auth/            # registration, login, JWT, OAuth, roles
│   │       ├── users/           # profile, onboarding questionnaire
│   │       ├── wallet/          # Wallet + Ledger (double-entry), escrow
│   │       ├── orders/          # orders, bids, milestones
│   │       ├── chat/            # order chat + in-chat invoices
│   │       ├── catalog/         # categories and reference data
│   │       ├── search/          # search
│   │       ├── matching/        # order/freelancer matching
│   │       ├── saved-searches/  # saved search queries
│   │       ├── files/           # file uploads, S3, antivirus scan
│   │       ├── support/         # support chat (tickets)
│   │       ├── referrals/       # referral program
│   │       ├── promotions/      # promotions
│   │       ├── subscriptions/   # subscriptions
│   │       ├── fraud/           # fraud-service integration
│   │       ├── notifications/   # notifications-service integration
│   │       ├── admin/           # RBAC, admin panel
│   │       └── health/          # health check
│   ├── web/                     # Next.js — client app + admin panel
│   ├── notifications-service/   # worker: event-driven email/telegram/push
│   └── fraud-service/           # worker: order risk scoring
├── packages/
│   └── shared-types/            # shared TS types, event contracts
├── docs/
│   ├── ARCHITECTURE.md          # architecture and money model
│   ├── TZ_CODEX.md              # spec for frontend/microservices
│   ├── MONETIZATION.md          # monetization model
│   ├── PRODUCTION_READINESS.md  # production readiness audit
│   ├── MISSING_ENDPOINTS.md     # frontend/backend working notes
│   └── CONTRIBUTING.md          # git workflow rules
├── docker-compose.yml
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

### Requirements

- Node.js 20+
- pnpm 9+ (`corepack enable` will pull the right version automatically)
- Docker + Docker Compose (for Postgres/Redis/ClamAV, or to run everything at once)

### Quick Start (everything in Docker)

```bash
cp apps/api/.env.example apps/api/.env
# fill apps/api/.env with real values (see apps/api/.env.example)

docker compose up --build
```

This brings up: `postgres` (5432), `redis` (6379), `clamav` (3310), `api`
(3001), `web` (3000), `notifications-service`, `fraud-service`. After the
first start you still need to run migrations and the seed (see below) —
Docker doesn't run them automatically.

### Local Development (no Docker, faster iteration)

```bash
pnpm install

# start only the infrastructure in Docker
docker compose up postgres redis clamav -d

# backend .env (DATABASE_URL/REDIS_HOST must point to localhost, not service names)
cp apps/api/.env.example apps/api/.env

pnpm --filter @taskhunt/api prisma:migrate
pnpm --filter @taskhunt/api prisma:seed

pnpm dev   # turbo run dev — starts api (3001) and web (3000) in parallel
```

### Environment Variables (`apps/api/.env`)

Minimum for a local run without external integrations:

```
DATABASE_URL="postgresql://taskhunt:taskhunt@localhost:5432/taskhunt?schema=public"
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=any-long-random-string
API_PUBLIC_URL=http://localhost:3001
WEB_PUBLIC_URL=http://localhost:3000
```

Everything else (`GOOGLE_CLIENT_ID`, `NOWPAYMENTS_API_KEY`, `S3_*`,
`CLAMAV_*`, etc.) can be left empty — the server starts without them, but
the corresponding features (OAuth login, payment processing, file uploads,
antivirus scanning) won't work until real keys are provided. Full list in
[`apps/api/.env.example`](apps/api/.env.example).

### Migrations and Seed

```bash
pnpm --filter @taskhunt/api prisma:migrate   # apply the schema
pnpm --filter @taskhunt/api prisma:seed      # system wallet, staff roles,
                                              # base categories, fees, feature flags
```

Payments and escrow won't work without the seed: `WalletService` looks up a
system counterparty wallet (`system@taskhunt.internal`) as the other side of
every external money movement in the double-entry ledger — without it any
payment attempt fails with a clear "run prisma:seed" error.

### Documentation

For architecture, the money model, monetization, and production-readiness
status, see the [`docs/`](docs/) folder:

- [`ARCHITECTURE.md`](docs/ARCHITECTURE.md) — big picture, event bus, money model
- [`TZ_CODEX.md`](docs/TZ_CODEX.md) — spec for frontend and microservices
- [`MONETIZATION.md`](docs/MONETIZATION.md) — monetization model
- [`PRODUCTION_READINESS.md`](docs/PRODUCTION_READINESS.md) — production readiness audit
- [`MISSING_ENDPOINTS.md`](docs/MISSING_ENDPOINTS.md) — frontend/backend working notes
- [`CONTRIBUTING.md`](docs/CONTRIBUTING.md) — git workflow rules
