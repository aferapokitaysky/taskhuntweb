# TaskHunt

Фриланс-биржа с встроенным крипто-эскроу: заказчик платит через
NOWPayments, деньги замораживаются на платформе и уходят фрилансеру
только после сдачи и приёмки работы. Инвойсы и чеки — прямо в чате
заказа.

Архитектура (модульный монолит + событийные микросервисы) подробно
описана в [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). Технические
детали для фронтенда и микросервисов — в [`docs/TZ_CODEX.md`](docs/TZ_CODEX.md).

## Структура репозитория

```
apps/
  api/                    # NestJS монолит — вся бизнес-логика и деньги
  web/                    # Next.js — клиент + админка
  notifications-service/  # воркер: email/telegram/push по событиям
  fraud-service/          # воркер: риск-скоринг заказов
packages/
  shared-types/           # общие TS-типы, контракт событий, права доступа
docs/
  ARCHITECTURE.md
  TZ_CODEX.md
  MISSING_ENDPOINTS.md    # рабочий журнал вопросов между фронтом и бэком
```

## Требования

- Node.js 20+
- pnpm 9+ (`corepack enable` включает нужную версию автоматически)
- Docker + Docker Compose (для Postgres/Redis, либо для запуска всего целиком)

## Быстрый старт (всё в Docker)

```bash
cp apps/api/.env.example apps/api/.env
# заполнить apps/api/.env реальными значениями (см. ниже)

docker compose up --build
```

Поднимутся: `postgres` (5432), `redis` (6379), `api` (3001), `web` (3000),
`notifications-service`, `fraud-service`. После первого старта нужно
накатить миграции и сид (см. ниже) — Docker их не запускает автоматически.

## Локальная разработка (без Docker, быстрее для итераций)

```bash
pnpm install

# поднять только инфраструктуру в Docker
docker compose up postgres redis -d

# .env для бэкенда (DATABASE_URL/REDIS_HOST должны указывать на localhost, не на имена сервисов)
cp apps/api/.env.example apps/api/.env

pnpm --filter @taskhunt/api prisma:migrate
pnpm --filter @taskhunt/api prisma:seed

pnpm dev   # turbo run dev — поднимет api (3001) и web (3000) параллельно
```

## Переменные окружения (`apps/api/.env`)

Минимум для локального запуска без внешних интеграций:

```
DATABASE_URL="postgresql://taskhunt:taskhunt@localhost:5432/taskhunt?schema=public"
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=любая-длинная-случайная-строка
API_PUBLIC_URL=http://localhost:3001
WEB_PUBLIC_URL=http://localhost:3000
```

Всё остальное (`GOOGLE_CLIENT_ID`, `NOWPAYMENTS_API_KEY`, `S3_*` и т.д.)
можно оставить пустым — сервер стартует и без них, но соответствующие
функции (OAuth-вход, приём платежей, загрузка файлов) работать не будут,
пока не подставить реальные ключи. Полный список — в
[`apps/api/.env.example`](apps/api/.env.example).

## Миграции и сид

```bash
pnpm --filter @taskhunt/api prisma:migrate   # накатить схему
pnpm --filter @taskhunt/api prisma:seed      # системный кошелёк, staff-роли,
                                              # базовые категории, комиссии, feature flags
```

Без сида платежи и эскроу не заработают: `WalletService` ищет системный
кошелёк-контрагент (`system@taskhunt.internal`) как противоположную
сторону для внешних движений денег в double-entry ledger — без него любая
попытка провести платёж упадёт с понятной ошибкой "run prisma:seed".

## Что уже реализовано (Phase 1)

- Регистрация с выбором роли (заказчик/фрилансер) + вход через
  Google/GitHub/Apple
- Анкета/квиз при онбординге
- Wallet + double-entry ledger, эскроу lock/release/refund, интеграция
  NOWPayments, вывод средств
- Заказы, отклики, версионирование, милстоуны, сдача работы, приёмка,
  отзывы, споры
- Чат по заказу (WebSocket) с автоматическими инвойс-карточками
- Тикеты поддержки со своим чатом
- Admin-панель: granular RBAC, разрешение споров, feature flags,
  настраиваемые комиссии
- Загрузка файлов в S3-совместимое хранилище с очередью антивирус-скана
  (сам скан пока заглушка — см. `apps/api/src/modules/files/scan.processor.ts`)
- Фронтенд: лендинг, регистрация, онбординг, логин, дашборд, страница
  заказа с чатом, админ-панель

## Что осталось (Phase 2+)

- Реальная интеграция антивируса (ClamAV) вместо заглушки
- AI/эвристический риск-скоринг за пределами MVP-правил в `fraud-service`
- Реферальная программа (модель есть в схеме, эндпоинтов ещё нет)
- White-label / мультитенантность
- ElasticSearch-поиск, Activity Feed, Live Presence — см. `docs/ARCHITECTURE.md`
  за обоснованием, почему это сознательно не в MVP
