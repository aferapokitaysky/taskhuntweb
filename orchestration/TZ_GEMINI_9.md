# TaskHunt — ТЗ для Gemini, раунд 9: тэги заказа + книга адресов вывода

Два независимых куска, оба намеренно без денежной логики и без
реалтайма — оркестратор в этом раунде параллельно переписывает чат
(`apps/api/src/modules/chat/`, `orders.service.ts::acceptBid`) и вывод
средств (`wallet.controller.ts::withdraw`, `WithdrawDto`,
`payout.processor.ts`). **Не трогай эти файлы вообще** — даже
косвенно связанные части (`acceptBid`, `WithdrawDto`, `payout.processor.ts`)
сейчас переписываются, любая правка там гарантированно даст конфликт.
Скоринг/ранжирование (`apps/api/src/modules/matching/`) — тоже не твоя
зона, как и в прошлых раундах.

**Перед стартом**: `git pull`/`git status`, чтобы видеть, не успел ли
оркестратор уже закоммитить миграцию на `Order.tags` — если она уже
есть в `schema.prisma`, не дублируй, просто убедись что DTO соответствует.

## 1. `Order.tags` — тэги/стек заказа

Заказчик указывает при создании заказа список технологий/тегов
(`["React", "Node.js", "PostgreSQL"]`) — свободный текст, не привязан
к каталогу `Skill`. Дальше это использует оркестратор в
`matching.service.ts` для % совместимости с откликами (тебя это не
касается, только сохрани поле).

### Миграция

`apps/api/prisma/schema.prisma`, модель `Order` (строка ~203) — добавь
поле рядом с `deadline`:

```prisma
tags String[] @default([])
```

Прогони `prisma migrate dev --name order_tags` по уже отработанной в
проекте схеме (временный Postgres-контейнер, см. `docs/CONTRIBUTING.md`
или предыдущие миграции в `apps/api/prisma/migrations/` как образец
команд) — закоммить саму папку миграции.

### DTO

`apps/api/src/modules/orders/dto/create-order.dto.ts` — добавь поле по
образцу `skillIds` в `apps/api/src/modules/users/dto/update-profile.dto.ts:28-31`:

```ts
@IsOptional()
@IsArray()
@IsString({ each: true })
tags?: string[];
```

`UpdateOrderDto` ничего трогать не нужно — он `PartialType(CreateOrderDto)`,
поле подхватится само.

`orders.service.ts::create()`/`update()` уже делают `{ ...dto, ... }`
при записи в Prisma — само поле пробрасывается без изменений кода.
Проверь только, что при создании без `tags` в ответе приходит `[]`, а
не `undefined` (дефолт в схеме это обеспечивает).

Тест: юнит на DTO-валидацию (строка вместо массива → 400) плюс один
интеграционный/юнит на `OrdersService.create` — заказ с тэгами
сохраняется и возвращается.

## 2. Книга сохранённых адресов вывода (`SavedPayoutAddress`)

Пользователь может сохранить крипто-адрес с названием/сетью один раз,
чтобы при выводе не вбивать его заново — дальше просто выбирает из
списка. Сама интеграция в `POST /wallet/withdraw` — зона оркестратора
(это денежный путь), твоя задача — только CRUD книги адресов, без
единой связи с выводом денег.

### Миграция

Новая модель в `apps/api/prisma/schema.prisma`, добавь после модели
`Wallet` (строка ~339) или в любом логичном месте рядом с `Wallet`:

```prisma
model SavedPayoutAddress {
  id         String    @id @default(uuid())
  userId     String
  user       User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  label      String
  network    String
  address    String
  isDefault  Boolean   @default(false)
  createdAt  DateTime  @default(now())
  lastUsedAt DateTime?

  @@unique([userId, network, address])
  @@index([userId])
  @@map("saved_payout_addresses")
}
```

В модель `User` (строка ~41-101) добавь связь сразу после `wallet Wallet?`:

```prisma
payoutAddresses SavedPayoutAddress[]
```

`network` — свободная строка, но фронт валидирует её по фиксированному
списку тикеров (TRC20/ERC20/BEP20/BTC/SOL/... — оркестратор заведёт
список в `packages/shared-types`). На бэке для раунда 9 **не
ограничивай** `network` через `@IsIn(...)` — оркестратор добавит
константу позже отдельным коммитом и подключит её сюда же, чтобы не
плодить два источника правды. Пока просто `@IsString() @IsNotEmpty()`.

### Эндпоинты

Новый файл `apps/api/src/modules/wallet/payout-addresses.controller.ts`
(отдельно от `wallet.controller.ts`, чтобы не создавать конфликт с
оркестратором в том же файле) + `payout-addresses.service.ts`, оба
регистрируются в существующем `WalletModule`. Гвард — `JwtAuthGuard`,
без ролей (адреса — и у клиента, и у фрилансера).

**`GET /wallet/payout-addresses`** — список адресов текущего юзера,
сортировка: `isDefault desc, lastUsedAt desc nulls last, createdAt desc`.

**`POST /wallet/payout-addresses`** — тело:

```ts
{ label: string, network: string, address: string }
```

DTO: `label`/`network`/`address` — `@IsString() @IsNotEmpty()`. Если
это первый адрес пользователя — сохрани сразу с `isDefault: true`.
Уникальность `[userId, network, address]` — если дубль, кинь
`ConflictException` с понятным сообщением ("Такой адрес уже сохранён").

**`PATCH /wallet/payout-addresses/:id`** — тело:

```ts
{ label?: string, isDefault?: boolean }
```

Проверка владения (`userId` записи === текущий юзер, иначе
`NotFoundException`, не `ForbiddenException` — не палим существование
чужих записей). Если `isDefault: true` — в транзакции сбрось
`isDefault` у всех остальных адресов этого юзера перед установкой.

**`DELETE /wallet/payout-addresses/:id`** — та же проверка владения,
удаление. Если удаляют текущий дефолтный адрес и у юзера остались
другие — сделай дефолтным следующий по `createdAt desc` (не обязательно,
но красиво; если не успеваешь — просто оставь без дефолта, это не
критично).

### Definition of done

- `pnpm --filter @taskhunt/api test` зелёное — юнит-тесты на сервис
  (создание/дубль/смена дефолта/удаление с переносом дефолта) и на DTO.
- `pnpm --filter @taskhunt/api build` чисто.
- Миграции закоммичены (`prisma/migrations/`), `prisma migrate deploy`
  проходит на чистой БД без ошибок.
- Отмечай прогресс в `STATUS_GEMINI_9.md` по мере готовности каждого
  пункта, как в прошлых раундах.
