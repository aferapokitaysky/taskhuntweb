# TaskHunt — ТЗ для Gemini, раунд 12: настройки уведомлений + избранные фрилансеры + "открыт к работе"

Три независимых куска, как обычно без денежной логики и без реалтайма
— оркестратор в этом раунде занят деньгами/безопасностью (история
операций по леджеру, спор, смена пароля,
[`TZ_CLAUDE_12.md`](./TZ_CLAUDE_12.md)) — не пересекаемся файлами
вообще (`wallet.*`, `auth.*`, `orders.service.ts::findOne` — не твои в
этом раунде).

**Перед стартом**: `git pull`/`git status`.

## 1. Настройки уведомлений

Модель `NotificationPreference` (`schema.prisma:794`) и enum
`NotificationChannel` (`PUSH`/`EMAIL`/`TELEGRAM`/`IN_APP`/`SMS`,
`schema.prisma:786`) — уже есть, **и уже используется**:
`apps/notifications-service/src/handlers/shared.ts:18-22` при отправке
проверяет `notificationPreference.findUnique` и не шлёт, если
`enabled: false`. То есть отправка уже уважает настройки — не хватает
только способа их выставить. `apps/notifications-service` — отдельное
приложение, туда лезть не нужно вообще, вся задача — в `apps/api`.

### Эндпоинты — новые методы в `NotificationsService`/`NotificationsController`

(`apps/api/src/modules/notifications/notifications.service.ts`,
`notifications.controller.ts` — те же файлы, где я на прошлой неделе
добавил `createForUser`, дописывай рядом, не переписывай существующее).

**`GET /notifications/preferences`** (`JwtAuthGuard`) — вернуть все 5
каналов с текущим статусом, дефолт `true` для каналов без явной записи
(так же, как уже трактует его `shared.ts` — "нет записи = включено"):

```ts
async getPreferences(userId: string) {
  const rows = await this.prisma.notificationPreference.findMany({ where: { userId } });
  const byChannel = new Map(rows.map((r) => [r.channel, r.enabled]));
  const CHANNELS = ['PUSH', 'EMAIL', 'TELEGRAM', 'IN_APP', 'SMS'] as const;
  return CHANNELS.map((channel) => ({ channel, enabled: byChannel.get(channel) ?? true }));
}
```

**`PATCH /notifications/preferences`** — тело `{ channel: NotificationChannel, enabled: boolean }`,
`upsert` по `@@unique([userId, channel])`:

```ts
async setPreference(userId: string, channel: string, enabled: boolean) {
  return this.prisma.notificationPreference.upsert({
    where: { userId_channel: { userId, channel: channel as any } },
    create: { userId, channel: channel as any, enabled },
    update: { enabled },
  });
}
```

DTO `dto/set-preference.dto.ts` — `channel: @IsIn(['PUSH','EMAIL','TELEGRAM','IN_APP','SMS'])`,
`enabled: @IsBoolean()`.

### Definition of done (п.1)

- Тест: юзер без единой записи в `NotificationPreference` получает все
  5 каналов `enabled: true`; после `PATCH` с `enabled: false` на
  `EMAIL` — повторный `GET` показывает именно этот канал выключенным,
  остальные не тронуты.

## 2. Избранные фрилансеры

Аналог `SavedOrder` (`schema.prisma`, есть готовый образец — модель
`SavedOrder` и `OrdersService.saveOrder`/`unsaveOrder`/`listSavedOrders`,
`orders.service.ts` — скопируй паттерн 1:1, только в обратную сторону
(клиент сохраняет фрилансера, не наоборот)), но клиент откладывает
понравившегося фрилансера, чтобы вернуться и предложить заказ.

### Схема

```prisma
model SavedFreelancer {
  id           String   @id @default(uuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  freelancerId String
  freelancer   User     @relation("SavedFreelancerTarget", fields: [freelancerId], references: [id], onDelete: Cascade)
  createdAt    DateTime @default(now())

  @@unique([userId, freelancerId])
  @@map("saved_freelancers")
}
```

`User` (`schema.prisma:42`) — добавь **две** связи (эта модель ссылается
на `User` дважды с разных сторон, как `Order.client`/`Bid.freelancer`
в других местах — нужен `@relation("SavedFreelancerTarget")` на обеих
сторонах, иначе Prisma не поймёт какая связь какая):

```prisma
savedFreelancers       SavedFreelancer[]
savedByAsFreelancer    SavedFreelancer[] @relation("SavedFreelancerTarget")
```

(вторая связь — обратная, на неё не завязан никакой эндпоинт, просто
обязательна по правилам Prisma для двойной FK на одну модель).

### Эндпоинты — `apps/api/src/modules/users/` (те же файлы, что портфолио в прошлом раунде)

`UsersService`:
- `saveFreelancer(userId, freelancerId)` — проверить, что `freelancerId`
  реально фрилансер (`roles.has('FREELANCER')`), иначе `BadRequestException`;
  `upsert` по уникальному ключу (идемпотентно, как `OrdersService.saveOrder`).
- `unsaveFreelancer(userId, freelancerId)` — `deleteMany`.
- `listSavedFreelancers(userId)` — `findMany` с `include: { freelancer: { include: { profile: { include: { skills: { include: { skill: true } } } } }, subscription: { include: { tier: true } } } } }`,
  вернуть **список фрилансеров** (`.map(s => s.freelancer)` + подмешать
  `subscriptionTier`), не сами записи избранного — фронту нужна форма
  как у `GET /freelancers` (см. `findFreelancers`, тот же файл), чтобы
  переиспользовать существующую карточку без адаптера.

`UsersController`:
- `POST /users/:id/favorite` — сохранить (`JwtAuthGuard`).
- `DELETE /users/:id/favorite` — убрать.
- `GET /users/saved/freelancers` — список (регистрировать **до**
  `@Get(':id')`, как в `OrdersController` — см. комментарий там про
  `saved/mine`, тот же порядок мыслей: `:id` матчит один сегмент пути,
  `saved/freelancers` — два, коллизии физически нет, но для читаемости
  держи их рядом в файле).

### Definition of done (п.2)

- Тест: `saveFreelancer` на юзера без роли `FREELANCER` →
  `BadRequestException`; повторный вызов `saveFreelancer` с тем же
  `freelancerId` не создаёт дубль (upsert); `unsaveFreelancer` на
  несуществующую запись не падает (просто `deleteMany` с нулевым
  результатом — это ок, идемпотентность важнее строгости здесь).

## 3. "Открыт к работе"

Простой статус-тумблер на профиле фрилансера — виден на публичной
карточке и в списке `/freelancers` (клиенты быстро видят, кто сейчас
берёт заказы).

`Profile` (`schema.prisma:108-137`) — добавь `availableForWork Boolean @default(true)`
рядом с `viewsCount` (строка ~128, ты её добавлял в прошлом раунде).

`UpdateProfileDto` (`apps/api/src/modules/users/dto/update-profile.dto.ts`)
— добавь `@IsOptional() @IsBoolean() availableForWork?: boolean` — поле
уже проходит через существующий `PATCH /users/me/profile`
(`UsersService.updateProfile`), отдельный эндпоинт не нужен.

Прокинь `availableForWork` в:
- `getPublicProfile` (`users.service.ts` — profileData-объект, там же,
  где `avatarUrl`/`bio` и т.д.).
- `findFreelancers` (`users.service.ts` — сейчас `include` тянет всё
  через `profile: { include: {...} }`, поле подхватится само за счёт
  глобального `include`, отдельно ничего добавлять не нужно — просто
  убедись, что оно реально долетает до ответа, не срезается нигде
  явным `select`).

### Definition of done (п.3)

- Тест на DTO: `availableForWork: 'yes'` (строка вместо булева) → 400.
- Живая проверка: `PATCH /users/me/profile { availableForWork: false }`
  → `GET /users/:id` для этого юзера отдаёт `availableForWork: false`.

## Definition of done (весь раунд)

- `pnpm --filter @taskhunt/api test` зелёное.
- `pnpm --filter @taskhunt/api build` чисто.
- Миграции закоммичены, `prisma migrate deploy` проходит на чистой БД.
- Отмечай прогресс в `STATUS_GEMINI_12.md`.

P.S. Фронтенд под все три пункта беру на следующий раунд сам — не
делай, только бэк (в этот раз без исключений, как в 11-м раунде, где я
делал только фронт — здесь наоборот, но правило то же: одна сторона на
раунд, не размазываем).
