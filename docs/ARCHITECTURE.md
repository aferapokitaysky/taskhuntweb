# TaskHunt — архитектура

## Общая картина

TaskHunt — модульный монолит для всей денежной/бизнес-логики (единая БД,
ACID-транзакции), плюс отдельные микросервисы для всего, что **не трогает
деньги напрямую** и может жить асинхронно на событиях.

```
                         ┌───────────────────────────┐
                         │        apps/web           │
                         │   Next.js (клиент/админка) │
                         └─────────────┬─────────────┘
                                       │ REST / WebSocket
                                       ▼
                         ┌───────────────────────────┐
                         │        apps/api           │
                         │   NestJS модульный монолит │
                         │                            │
                         │  auth · users · wallet     │
                         │  orders · chat · support   │
                         │  admin                     │
                         │                            │
                         │  PostgreSQL (ledger, ACID) │
                         └─────────────┬─────────────┘
                                       │ публикует события
                                       │ (Redis / BullMQ)
                       ┌───────────────┴────────────────┐
                       ▼                                ▼
        ┌───────────────────────────┐    ┌───────────────────────────┐
        │  notifications-service    │    │      fraud-service        │
        │  (email/telegram/push)    │    │  (риск-скоринг заказов,   │
        │  подписан на события      │    │   пользователей, платежей)│
        └───────────────────────────┘    └───────────────────────────┘
```

## Почему так

- **Wallet/Ledger/Escrow — это деньги.** Любая операция там обязана быть
  ACID-транзакцией в одной БД. Если разнести это на сервисы с отдельными
  БД — придётся городить Saga/distributed transactions, а это резко
  повышает риск багов вида "деньги списались, а эскроу не создался".
  Поэтому core остаётся монолитом.
- **Notifications и fraud-scoring не должны блокировать бизнес-транзакцию.**
  Они реагируют на уже свершившиеся события (`OrderCreated`, `InvoicePaid`
  и т.д.), поэтому им безопасно жить отдельно, общаться через очередь и
  падать/перезапускаться без риска для денег пользователей.
- Монолит спроектирован по доменным модулям (`modules/auth`,
  `modules/wallet`, ...), которые **общаются друг с другом только через
  event bus**, а не напрямую импортируя сервисы друг друга. Это значит,
  что через полгода-год, если какой-то модуль упрётся в нагрузку, его
  можно вынести в отдельный сервис почти без переписывания остального.

## Структура репозитория

```
taskhunt/
├── apps/
│   ├── api/                     # NestJS монолит — вся бизнес-логика и деньги
│   │   ├── prisma/schema.prisma # единая схема БД
│   │   └── src/
│   │       ├── modules/
│   │       │   ├── auth/        # регистрация, логин, JWT, роли
│   │       │   ├── users/       # профиль, анкета/квиз при регистрации
│   │       │   ├── wallet/      # Wallet + Ledger (double-entry), эскроу
│   │       │   ├── orders/      # заказы, отклики (bids)
│   │       │   ├── chat/        # чат по заказу + инвойсы в чате
│   │       │   ├── support/     # чат с поддержкой (тикеты)
│   │       │   └── admin/       # RBAC, панель админа
│   │       └── common/
│   │           ├── events/      # event bus: имена событий + emitter
│   │           ├── guards/       # JwtAuthGuard, RolesGuard, PermissionsGuard
│   │           ├── decorators/   # @Roles(), @CurrentUser()
│   │           ├── filters/      # global exception filter
│   │           └── pipes/
│   ├── web/                     # Next.js — клиентская часть + админка
│   ├── notifications-service/   # отдельный воркер: email/telegram/push
│   └── fraud-service/           # отдельный воркер: риск-скоринг
├── packages/
│   ├── shared-types/            # общие TS-типы + контракты событий
│   └── config/                  # общие eslint/tsconfig базы
├── docs/
│   ├── ARCHITECTURE.md          # этот файл
│   └── TZ.md                    # техническое задание
├── docker-compose.yml
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

## Event Bus — контракт между монолитом и сервисами

Все события описаны как типы в `packages/shared-types/src/events.ts` и
публикуются в Redis Stream / BullMQ очередь `taskhunt-events`. Монолит —
единственный, кто пишет события. Микросервисы — только читают.

Базовые события Phase 1:

| Событие           | Кто публикует      | Кто слушает                     |
|--------------------|--------------------|----------------------------------|
| `UserRegistered`   | auth module        | notifications-service            |
| `OrderCreated`     | orders module       | notifications-service, fraud-service |
| `BidSubmitted`     | orders module       | notifications-service            |
| `BidAccepted`      | orders module       | notifications-service, fraud-service |
| `InvoiceIssued`    | chat module         | notifications-service            |
| `InvoicePaid`      | wallet module        | notifications-service            |
| `EscrowLocked`     | wallet module        | notifications-service            |
| `EscrowReleased`   | wallet module        | notifications-service            |
| `WorkSubmitted`    | orders module       | notifications-service            |
| `DisputeOpened`    | admin module        | notifications-service, fraud-service |

## Денежная модель (кратко, детали — в `apps/api/prisma/schema.prisma`)

Баланс пользователя — это не число в одной колонке, а **сумма записей
леджера**. Никаких `UPDATE balance = balance + x`. Каждое движение денег —
новая неизменяемая запись в `LedgerEntry` с типом операции
(`DEPOSIT`, `ESCROW_LOCK`, `ESCROW_RELEASE`, `REFUND`, `COMMISSION`,
`WITHDRAWAL`, `REFERRAL`, `BONUS`, `CHARGEBACK`). Текущий баланс по каждому
"под-балансу" (`MAIN`, `ESCROW`, `LOCKED`, `WITHDRAWABLE`, `PENDING`) —
это агрегат (`SUM`) записей леджера, посчитанный в транзакции.
