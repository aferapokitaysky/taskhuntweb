# TaskHunt — Архитектура Системы

## 1. Общий обзор архитектуры

TaskHunt — это современная фриланс-платформа с встроенным крипто-эскроу, гибкой монетизацией и асинхронной защитой от фрода. 

Архитектура системы объединяет **модульный монолит** для критичных к согласованости бизнесовых и финансовых процессов и **событийно-управляемые микросервисы** для изолированных фоновых задач.

```
                               ┌───────────────────────────┐
                               │        apps/web           │
                               │   Next.js 14 (App Router) │
                               │    (Клиент + Админка)     │
                               └─────────────┬─────────────┘
                                             │ REST / WebSocket
                                             ▼
                               ┌───────────────────────────┐
                               │        apps/api           │
                               │   NestJS Модульный Монолит│
                               │                           │
                               │  19 доменных модулей      │
                               │  Double-Entry Ledger      │
                               │  BullMQ Фоновые Воркеры   │
                               │  ClamAV Файловый Сканер   │
                               │                           │
                               │   PostgreSQL + Prisma ORM │
                               └─────────────┬─────────────┘
                                             │ Публикация событий
                                             │ (Redis Stream / BullMQ)
                             ┌───────────────┴────────────────┐
                             ▼                                ▼
              ┌───────────────────────────┐    ┌───────────────────────────┐
              │  notifications-service    │    │      fraud-service        │
              │ (Email/Telegram/Push)     │    │   (Асинхронный риск-     │
              │  Подписан на ивенты       │    │    скоринг и фрод-флаги)  │
              └───────────────────────────┘    └───────────────────────────┘
```

---

## 2. Ключевые архитектурные решения

1. **Единый финансовых контур (Core Ledger + ACID)**:
   * Все операции с деньгами (депозиты, заморозка эскроу, выплаты, комиссии, реферальные вознаграждения, вывод средств) выполняются в **единой СУБД PostgreSQL** через транзакции двойной записи (Double-Entry Ledger).
   * Балансы пользователей **не хранятся в виде статичного поля `balance`**, а высчитываются как строгое агрегированное значение неизменяемых записей `LedgerEntry`.
2. **Асинхронная выносная обработка**:
   * Рассылка уведомлений (Email/Telegram/Push) и скоринг фрода **вынесены из основного API** в отдельные воркеры (`notifications-service` и `fraud-service`). Ошибки воркеров или задержки в доставке писем ни при каких обстоятельствах не блокируют транзакции пользователей.
3. **Модульная изоляция бизнеса (Domain Event Bus)**:
   * Монолит `apps/api` разделен на 19 изолированных доменных модулей (`auth`, `wallet`, `orders`, `chat`, `admin` и др.).
   * Модули взаимодействуют друг с другом через локальную событийную шину (`EventEmitter2`) и внешнюю событийную шину на базе **Redis Streams / BullMQ**.

---

## 3. Структура Репозитория

```
taskhunt/
├── apps/
│   ├── api/                     # NestJS монолит — 19 доменных модулей
│   │   ├── prisma/
│   │   │   ├── schema.prisma    # Единая Prisma-схема БД
│   │   │   └── migrations/      # Автоматические миграции БД
│   │   └── src/
│   │       ├── modules/         # Доменные модули (см. разделы ниже)
│   │       └── common/          # Guards, Filters, Decorators, Interceptors
│   ├── web/                     # Next.js 14 — фронтенд клиента, фрилансера и админки
│   ├── notifications-service/   # Standalone воркер рассылок (Nodemailer, Telegram Bot)
│   └── fraud-service/           # Standalone воркер риск-скоринга (0-100 score, фрод-флаги)
├── packages/
│   ├── shared-types/            # Общие типы, DTO, схемы событий и права доступа
│   └── config/                  # Конфигурации TypeScript, ESLint
├── docs/                        # Полная техническая документация
├── orchestration/               # Протоколы синхронизации и статусы раундов
├── docker-compose.yml           # Локальное окружение (Postgres, Redis, Services)
├── turbo.json                   # Конфигурация сборки Turborepo
└── pnpm-workspace.yaml          # PNPM воркспейсы
```

---

## 4. Доменные модули монолита (`apps/api`)

Вся бизнес-логика разделена на 19 специализированных модулей:

| Модуль | Назначение и функциональность |
| :--- | :--- |
| `auth` | Регистрация, аутентификация (JWT + Refresh Session), OAuth (Google, Apple, GitHub), email-верификация, сброс пароля, 2FA/TOTP с бэкап-кодами. |
| `users` | Управление профилями, анкета онбординга, портфолио, шаблоны бидов, подтверждение навыков (`SkillEndorsement`), черные списки (`ClientBlock`). |
| `catalog` | Управление категориями заказов, подкатегориями и навыками (`Category`, `Skill`). |
| `orders` | Заказы, отклики (биды с причиной отклонения `rejectionReason`), этапы (milestones), сдача работы (`Delivery`), продления дедлайна (`DeadlineExtensionRequest`), файлы к спорам (`DisputeFile`), шаблоны авто-заказов (`OrderTemplate`). |
| `matching` | Умный алгоритм подбора подхоящих фрилансеров под категории и навыки заказа. |
| `chat` | Чат по заказу с возможностью выставления инвойсов (`Invoice`), отслеживанием прочтения и экспортом счетов в CSV (`GET /orders/:id/invoices/export.csv`). |
| `wallet` | Финансовый контур: Double-entry Ledger, депозиты NOWPayments, заморозка/разблокировка эскроу, авто-выплаты `WithdrawalPayoutProcessor` с авто-откатом. |
| `subscriptions` | Подписки пользователей (Starter, Pro, Premium), скидки на комиссии, лимиты откликов. |
| `promotions` | Продвижение (буст) заказов и профилей фрилансеров на главной и в поиске. |
| `referrals` | Реферальная программа с генерацией промокодов и начислением реферальных бонусов. |
| `search` | Полнотекстовый поиск по заказам и фрилансерам, асинхронное логирование поисковых запросов (`SearchLog`) и эндпоинт трендов (`GET /search/trending`). |
| `saved-searches` | Сохраненные поисковые фильтры пользователей с отправкой уведомлений о новых заказах. |
| `support` | Чат-система тикетов технической поддержки с приоритетами. |
| `files` | Интеграция с S3-хранилищем и автоматическим антивирусным сканированием через ClamAV (`FileAsset`, `ScanStatus`). |
| `admin` | Административная панель: RBAC-права (`StaffRole`, `Permission`), решение споров, аудит действий (`AuditLog`), массовый бан (`bulk-suspend`), сброс 2FA. |
| `fraud` | Мост между внешним `fraud-service` и админкой: курсорная пагинация фрод-флагов, модерация рисков. |
| `stats` | Агрегация аналитики для админ-панели и пользовательских дашбордов. |
| `health` | Эндпоинты Health Check (Liveness / Readiness) состояния БД и Redis. |

---

## 5. Финансовая модель (Double-Entry Ledger)

Балансы пользователей не являются чисельным полем в таблице `User`. Баланс определяется **суммой транзакций в леджере**.

### Типы подбалансов (`BalanceType`):
1. **`MAIN`**: Основной счет для депозитов и зачислений.
2. **`ESCROW`**: Средства, замороженные под конкретный этап/заказ.
3. **`LOCKED`**: Средства, заблокированные администрацией при споре или проверке.
4. **`WITHDRAWABLE`**: Доступные для вывода средства на внешние кошельки.
5. **`PENDING`**: Ожидающие подтверждения поступления.

### Схема движений средств:
* **Депозит**: `SYSTEM (External) → USER (MAIN)`
* **Заморозка эскроу**: `USER (MAIN) → USER (ESCROW)`
* **Приемка работы / Выплата**: `USER (ESCROW) → FREELANCER (WITHDRAWABLE)` + `FREELANCER (WITHDRAWABLE) → SYSTEM (COMMISSION)`
* **Запрос на вывод**: `USER (WITHDRAWABLE) → SYSTEM (PENDING_PAYOUT)`
* **Авто-выплата NOWPayments**: При успехе — проведение вывода. При ошибке API — `SYSTEM (PENDING_PAYOUT) → USER (REFUND)`.

---

## 6. Фоновые воркеры BullMQ

В монолите `apps/api` работают три критических фоновых процессора BullMQ:

1. **`WithdrawalPayoutProcessor`**:
   * Обрабатывает очереди выплат `withdrawal-payouts`.
   * Вызывает внешний API NOWPayments Payout. При сбое сети или отказе автоматически выполняет финансовый `REFUND` на баланс пользователя.
2. **`OrderTemplateProcessor`**:
   * Почасовой воркер, проверяющий модель `OrderTemplate`.
   * Автоматически создает повторяющиеся заказы по заданному пользователем расписанию (`nextRunAt`).
3. **`DeadlineWarningProcessor`**:
   * Ежедневный воркер, отслеживающий приближение дедлайнов заказов.
   * Публикует событие `OrderDeadlineApproaching` за 24 часа до завершения дедлайна.

---

## 7. Событийная шина (Event Bus)

Все события описываются строгими контрактами в `packages/shared-types/src/events.ts` и транслируются в Redis Stream `taskhunt-events`.

| Событие | Публикующий модуль | Потребители |
| :--- | :--- | :--- |
| `UserRegistered` | `auth` | `notifications-service` |
| `OrderCreated` | `orders` | `notifications-service`, `fraud-service` |
| `BidSubmitted` | `orders` | `notifications-service` |
| `BidAccepted` | `orders` | `notifications-service`, `fraud-service` |
| `InvoiceIssued` | `chat` | `notifications-service` |
| `InvoicePaid` | `wallet` | `notifications-service`, `fraud-service` |
| `EscrowLocked` | `wallet` | `notifications-service` |
| `EscrowReleased` | `wallet` | `notifications-service` |
| `WorkSubmitted` | `orders` | `notifications-service` |
| `DisputeOpened` | `admin` / `orders` | `notifications-service`, `fraud-service` |
| `DeadlineExtended` | `orders` | `notifications-service` |
| `UserSuspended` | `admin` | `notifications-service` |

---

## 8. RBAC для персонала (Staff)

Доступ к `/admin` и его API не завязан на отдельный логин — это тот же аккаунт, что и обычный сайт, с дополнительным флагом и ролью в базе. Модель гранулярная (не просто "админ/не админ"):

* **`User.isStaff`** (`Boolean`) — сам факт "это сотрудник". Помимо доступа к `/admin`, это же поле **исключает аккаунт из всех публичных списков** — поиска фрилансеров, ленты заказов, публичной статистики на лендинге (`isStaff: false` в фильтрах `UsersService.findFreelancers`, `OrdersService.findMany`, `StatsController`) — иначе тестовый/служебный аккаунт с ролью FREELANCER светился бы в каталоге для реальных клиентов.
* **`Permission`** — атомарные права (`user.ban`, `dispute.resolve`, `escrow.release`, `finance.configure_commissions`, `catalog.manage`, `fraud.review`, `staff.manage_roles` и др. — полный список `PermissionCode` в `packages/shared-types/src/permissions.ts`).
* **`StaffRole`** — именованный набор прав (`OWNER` — все права, `FINANCE`, `SUPPORT`, `MODERATOR`, `ARBITRATOR`, `ANALYST` — см. `DEFAULT_STAFF_ROLES` там же). Роль — не enum на пользователе, а M2M через `UserStaffRole`: одному аккаунту можно назначить несколько ролей, права суммируются.
* **`PermissionsGuard` + `@RequirePermissions(...)`** — на каждом роуте `/admin/*` (см. раздел Admin в [API_MAP.md](API_MAP.md)), а не общий `@Roles('STAFF')` — конкретное действие требует конкретного права, а не факта "являюсь сотрудником".

Ни сид (`prisma/seed.ts`), ни регистрация не назначают роль `OWNER` никому автоматически — первый доступ к админке выдаётся вручную через прямой SQL, см. [DEPLOYMENT.md](DEPLOYMENT.md#первый-admin-аккаунт).

---

## 9. Инфраструктура и деплой

Актуальный боевой деплой — один VPS (Azure VM), nginx как reverse-proxy перед четырьмя Docker-контейнерами (`api`, `web`, `postgres`, `redis`) плюс `notifications-service`/`fraud-service`. Полный пошаговый runbook (DNS, nginx, Let's Encrypt, `.env`, миграции, первый admin) — [DEPLOYMENT.md](DEPLOYMENT.md). Здесь — только то, что важно для понимания архитектуры:

* **Поддомены**: apex → `web`, `www` → 301 на apex, `api.` → `api` (с проксированием WebSocket-апгрейда для чата), `admin.` → 301 на `apex/admin` (это роут внутри `web`, отдельного сервиса под админку нет).
* **`docker-compose.prod.yml`** — оверлей поверх основного `docker-compose.yml`: обнуляет dev-бинды (`volumes: !reset []` для `api`/`web`/`notifications-service`/`fraud-service` — без этого хостовый исходный код, смонтированный для hot-reload в деве, перекрывает собранный внутри образа `dist/`; забытый `!reset` именно для `fraud-service`/`notifications-service` живьём вызывал бесконечный `MODULE_NOT_FOUND`-краш-луп на первом деплое), закрывает `postgres`/`redis` от внешних портов, требует непустой `POSTGRES_PASSWORD`.
* **SSL** — Let's Encrypt через `certbot certonly --webroot`, не `--nginx`-плагин (чтобы certbot не редактировал версионированный nginx-конфиг сам). Двухэтапный бутстрап: временный HTTP-only конфиг → выпуск сертификата → полный конфиг с HTTPS.
* **Rebuild, а не restart** — правки в `NEXT_PUBLIC_*` переменных требуют пересборки `web`-образа (это build ARG'и Next.js, запекаются в клиентский бандл), правки в самом коде API/web — тоже пересборка соответствующего образа, `docker compose up -d` без `build` просто пересоздаст контейнер со СТАРЫМ образом.
* **CDN/edge** — домен проксируется через Cloudflare (orange-cloud). Это добавляет собственный слой перед nginx: Cloudflare может инжектить свой `robots.txt`-блок для AI-краулеров (Content Signals / AI Crawl Control) впереди блока приложения — см. `apps/web/src/app/robots.ts` и `<meta name="robots">` на приватных страницах как более надёжный (не завязанный на порядок групп `User-agent: *`) сигнал для не-индексации.
