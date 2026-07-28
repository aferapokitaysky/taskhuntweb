# TaskHunt — ТЗ для Gemini: реферальная программа + антивирус-скан

Этот документ самодостаточен — читай целиком перед стартом, даже если не
видел остальной разговор, из которого родился проект.

## 0. Контекст

TaskHunt — фриланс-биржа с крипто-эскроу (NOWPayments), деньги проходят
через double-entry ledger (никаких `UPDATE balance = balance + x`, только
парные проводки DEBIT/CREDIT в `LedgerEntry`, сгруппированные в
`LedgerTransaction`). Полная архитектура — [`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md).

Repo — pnpm-монорепо: `apps/api` (NestJS-монолит, вся бизнес-логика и
деньги), `apps/web` (Next.js), `apps/notifications-service` и
`apps/fraud-service` (независимые воркеры на BullMQ). Как несколько
агентов делят работу в одной папке — см. [`orchestration/README.md`](./README.md).

**Прочитай `git log --oneline` перед стартом**, чтобы увидеть, что уже
реализовано (auth, wallet/ledger, orders, milestones, chat, admin, files
и т.д.) — тут это не дублируется подробно, только то, что нужно для
твоей задачи.

## 1. Твоя зона: `apps/api/src/modules/referrals/` (новый модуль)

Prisma-модели уже существуют в `apps/api/prisma/schema.prisma`, ты их
не создаёшь, только используешь:

```prisma
model ReferralCode {
  id        String        @id @default(uuid())
  ownerId   String        @unique
  owner     User          @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  code      String        @unique
  createdAt DateTime      @default(now())
  uses      ReferralUse[]
}

model ReferralUse {
  id               String       @id @default(uuid())
  referralCodeId   String
  referralCode     ReferralCode @relation(fields: [referralCodeId], references: [id])
  referredUserId   String       @unique
  referredUser     User         @relation("ReferredUser", fields: [referredUserId], references: [id])
  rewardLedgerTxId String?
  createdAt        DateTime     @default(now())
}
```

Плюс уже засеян `CommissionRule` с `type: REFERRAL_FEE, percentage: 5`
(см. `apps/api/prisma/seed.ts`) — это процент, который реферер получает
от суммы первого оплаченного инвойса приведённого пользователя.

### 1.1 `POST /referrals/redeem` (auth, любой залогиненный)

Тело: `{ code: string }`.

- Найти `ReferralCode` по `code`. Если не найден — 404.
- Если `referralCode.ownerId === текущий userId` — 400 (нельзя
  активировать свой же код).
- Если у текущего пользователя уже есть `ReferralUse` (он кого-то уже
  привёл или сам уже был приведён) — 400, "already referred" (проверка —
  `findUnique({ where: { referredUserId: userId } })`, `referredUserId`
  уникален по схеме).
- Создать `ReferralUse { referralCodeId, referredUserId: userId }`.

**Важно: этот эндпоинт вызывается фронтом отдельно, ПОСЛЕ обычной
регистрации** (не встраивай логику в `AuthService.register` — это чужой
модуль, не трогай `apps/api/src/modules/auth/**`, чтобы не пересекаться
с тем, кто его ведёт; если считаешь, что интеграция в сам flow
регистрации всё же нужна — опиши это в `STATUS_GEMINI.md`, пусть
оркестратор решит и внесёт правку сам).

### 1.2 `GET /referrals/me` (auth)

Вернуть:
```json
{
  "code": "ABC123XY",
  "totalReferred": 3,
  "totalEarned": "45.00",
  "referrals": [
    { "userId": "...", "displayName": "...", "joinedAt": "...", "rewardPaid": true }
  ]
}
```
Код генерируется лениво при первом вызове (`upsert`/`findOrCreate` по
`ownerId`) — 8 случайных alphanumeric-символов (используй `crypto.randomBytes`
или `nanoid`, если добавишь зависимость — проверь, что её ещё нет в
`apps/api/package.json`, чтобы не дублировать; можно обойтись и без неё
через `crypto.randomInt`/`randomBytes(6).toString('base64url')`).

### 1.3 Начисление вознаграждения

Слушай локальное событие `InvoicePaid` через `@nestjs/event-emitter`
(`@OnEvent(DomainEventName.InvoicePaid)`) — так же, как это уже сделано в
`apps/api/src/modules/chat/listeners/chat-events.listener.ts` (используй
этот файл как образец паттерна: свой `ReferralsEventsListener`,
регистрируется как provider в `referrals.module.ts`, НЕ импортирует чужие
модули напрямую).

Payload `InvoicePaidEvent` содержит `payerId`, `freelancerId`, `invoiceId`,
`orderId`, `amount`, `currency` (см. `packages/shared-types/src/events.ts`).

Логика:
1. Проверить, есть ли `ReferralUse` с `referredUserId === payerId`
   (то есть заказчик, оплативший счёт, был кем-то приведён).
2. Если да, и это **первая** его оплата (то есть `rewardLedgerTxId` в
   `ReferralUse` ещё `null` — используем это поле не только для хранения
   ссылки на транзакцию, но и как флаг "вознаграждение уже выдано").
   Если `rewardLedgerTxId` уже заполнен — ничего не делать (идемпотентность,
   вознаграждение даётся один раз, за первую оплату).
3. Посчитать сумму вознаграждения: `amount * (REFERRAL_FEE.percentage / 100)`
   (бери `CommissionRule` через Prisma, как это делает
   `WalletService.getMarketplaceFeePercent()` в
   `apps/api/src/modules/wallet/wallet.service.ts` — используй тот же
   паттерн для `REFERRAL_FEE`).
4. Провести деньги **через `LedgerService`** (инжектируй его из
   `WalletModule`, экспортируется), НЕ трогая напрямую `Wallet`-таблицу.
   Тип транзакции — `REFERRAL` (уже есть в enum `LedgerTransactionType`).
   Проводка должна быть сбалансирована (см. `LedgerService.applyTransaction`,
   `apps/api/src/modules/wallet/ledger.service.ts`): например,
   `DEBIT system.MAIN` / `CREDIT referrer.MAIN` на сумму вознаграждения
   (системный кошелёк уже существует, см.
   `apps/api/src/modules/wallet/constants.ts` → `SYSTEM_ACCOUNT_EMAIL`,
   и `WalletService` приватный метод `getSystemWallet()` — либо
   продублируй такой же приватный хелпер в своём сервисе, либо (лучше)
   добавь публичный метод `getSystemWalletId()` в `WalletService` и
   используй его, отметив это изменение в `STATUS_GEMINI.md`, раз это
   правка в чужом файле).
5. Обновить `ReferralUse.rewardLedgerTxId` id-шником созданной
   `LedgerTransaction`.

### 1.4 Модуль

```
apps/api/src/modules/referrals/
├── referrals.module.ts      # imports: WalletModule (за LedgerService/WalletService)
├── referrals.controller.ts  # /referrals/redeem, /referrals/me
├── referrals.service.ts     # redeem(), getMyReferralInfo()
├── referrals-events.listener.ts   # @OnEvent(InvoicePaid) — начисление
└── dto/redeem-referral.dto.ts     # { code: string }
```

Подключи `ReferralsModule` в `apps/api/src/app.module.ts` — это единственная
правка в общем файле, которую можно делать напрямую (одна строка импорта
+ одна строка в массиве `imports`, конфликтов почти не бывает; если
увидишь, что кто-то параллельно поменял этот файл — перечитай перед
правкой и просто добавь свою строку рядом).

## 2. Фронтенд — отдельная НОВАЯ страница (не трогай чужие файлы)

Создай **новый** файл `apps/web/src/app/referrals/page.tsx` (по образцу
`apps/web/src/app/dashboard/page.tsx` — та же структура: `'use client'`,
запросы через `api()` из `src/lib/api.ts`):

- Показать свой код (из `GET /referrals/me`) и ссылку вида
  `${window.location.origin}/register?ref=<code>` с кнопкой "скопировать"
- Форма "Есть код от друга?" — input + кнопка → `POST /referrals/redeem { code }`
- Список приведённых пользователей и сколько заработано

**Не редактируй** `apps/web/src/app/register/page.tsx`, `layout.tsx` или
что-либо ещё в `apps/web` — только новый файл. Если понадобится добавить
ссылку на `/referrals` в навигацию/дашборд — опиши это в
`STATUS_GEMINI.md`, пусть оркестратор сам вставит одну строчку, чтобы не
столкнуться с тем, кто сейчас работает над `apps/web` (см.
`docs/MISSING_ENDPOINTS.md` — там Codex активно правит дашборд/онбординг).

## 3. Опционально (если основное готово и есть время): реальный антивирус-скан

Сейчас `apps/api/src/modules/files/scan.processor.ts` — заглушка, которая
сразу помечает файл `CLEAN` без реальной проверки (см. комментарий в
файле). Задача: подключить настоящий ClamAV.

- Рекомендуемый пакет: `clamscan` (npm) — умеет говорить с ClamAV daemon
  по TCP (`clamdscan`), не требует локально установленного бинаря на
  хосте, где крутится API.
- **Не редактируй `docker-compose.yml` напрямую** — там уже есть сервисы
  `postgres`/`redis`/`api`/`web`/`notifications-service`/`fraud-service`,
  это общий файл. Вместо этого опиши в `STATUS_GEMINI.md`, какой сервис
  нужно добавить (образ `clamav/clamav-debian` с портом 3310, healthcheck),
  и оркестратор добавит сам.
- В `scan.processor.ts` — заменить тело `process()` на реальный вызов
  `clamscan.scanBuffer(...)` (или `scanFile`, если проще скачать объект
  во временный файл через `S3Service`), по результату проставлять
  `scanStatus: 'CLEAN'` или `'INFECTED'` в `FileAsset`.

Это отдельная, изолированная правка одного файла — низкий риск
конфликтов, можно делать параллельно с пунктами 1-2.

## 4. Definition of done

- [ ] `pnpm --filter @taskhunt/api build` проходит без ошибок
- [ ] `POST /referrals/redeem` и `GET /referrals/me` работают руками
      (curl/Postman) на локально поднятом стенде
- [ ] Начисление реферального вознаграждения проверено на реальном
      сценарии: зарегистрировать двух юзеров, второй активирует код
      первого, второй платит по инвойсу — у первого должен появиться
      `LedgerEntry` типа `REFERRAL` и вырасти `mainBalance`
- [ ] `apps/web/src/app/referrals/page.tsx` собирается
      (`pnpm --filter @taskhunt/web build`) и реально вызывает оба эндпоинта
- [ ] `STATUS_GEMINI.md` заполнен: что сделано, что нет, какие правки в
      чужих файлах нужны от оркестратора

## 5. Как отчитываться

Веди [`STATUS_GEMINI.md`](./STATUS_GEMINI.md) по ходу работы — это не
формальность, а единственный канал связи с оркестратором между сессиями.
Формат уже есть в файле, просто заполняй секции по мере продвижения.
