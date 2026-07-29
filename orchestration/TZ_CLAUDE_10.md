# TaskHunt — ТЗ для себя (Claude), раунд 10: фильтры каталога заказов + подписки на новые заказы

Своя зона в этом раунде: фильтры в ленте заказов (категория/тэги/бюджет,
и на бэке, и на фронте) + `SavedSearch` — фрилансер сохраняет фильтр и
получает уведомление, когда появляется новый подходящий заказ. Это
event-driven фича (висит на `DomainEventName.OrderCreated`) с реальным
риском спама уведомлений при неаккуратном дизайне, поэтому беру себе,
не Gemini — как и в прошлых раундах, деньги/реалтайм/то, что должно
быть точным с первого раза, моя зона.

Gemini параллельно делает портфолио фрилансера (`PortfolioItem`) и
счётчик просмотров профиля ([`TZ_GEMINI_10.md`](./TZ_GEMINI_10.md)).
Пересечение файлов: `apps/api/prisma/schema.prisma` (оба добавляем
модели), `apps/web/src/lib/types.ts` (оба добавляем интерфейсы) — перед
своими коммитами делать `git pull`/`git status`, аккуратно мёржить, не
затирать чужие блоки. `apps/api/src/modules/users/users.service.ts` и
`apps/web/src/app/profile/page.tsx` в этом раунде трогает только
Gemini — я их не касаюсь, конфликта быть не должно.

## 1. Фильтры каталога заказов — категория, тэги, бюджет

Сейчас (проверено): `OrdersService.findMany` (`orders.service.ts:98`)
уже принимает `categoryId`/`status`/`search`, но **фронт им не
пользуется** — на дашборде (`dashboard/page.tsx`) у ленты заказов есть
только текстовый поиск, ни категории, ни тэгов, ни бюджета. Без этого
"сохранённый фильтр" ниже не на чем строить осмысленно.

### Бэкенд

`findMany` (`orders.service.ts:98`) — добавить параметры `tags?: string[]`
и `minBudget?: number`:

```ts
if (filters.tags && filters.tags.length > 0) {
  where.tags = { hasSome: filters.tags };
}
if (filters.minBudget !== undefined) {
  where.OR = [...(where.OR ?? []), ...]; // budgetMax >= minBudget ИЛИ (budgetMax null И budgetMin >= minBudget)
}
```

Аккуратно с уже существующим `where.OR` от текстового поиска — бюджетное
условие идёт через `AND`, не смешивать с поисковым `OR` (иначе бюджетный
фильтр случайно отключит текстовый поиск или наоборот). Проще всего:
собрать `AND: Prisma.OrderWhereInput[]` из непустых кусков вместо
мешанины `where.OR`.

`orders.controller.ts::findMany` (`@Get()`, строка ~25) — добавить
`@Query('tags') tags?: string` (фронт шлёт через запятую,
`tags?.split(',').filter(Boolean)`) и `@Query('minBudget') minBudget?: string`
(`parseFloat`, `undefined` если `NaN`).

### Фронтенд (`dashboard/page.tsx`)

Над списком заказов (там же, где сейчас только `orderSearch` инпут) —
компактная строка фильтров: `<select>` категории (используй уже
загруженный `flatCategories`, значение `''` = "Все категории"),
chip-инпут тэгов (переиспользовать паттерн из `orderForm.tags`, строка
~365 — Enter добавляет, клик удаляет), число "Бюджет от".

`refreshOrders` (строка ~62) — прокинуть все фильтры в query-параметры,
не только `search`. Дебаунс (строка ~70) уже есть на поиск — фильтры
категории/тэгов/бюджета тоже должны триггерить `refreshOrders` (через
`useEffect` с зависимостью от всех фильтров разом, один дебаунс на все).

## 2. `SavedSearch` — подписка на новые заказы по фильтру

Фрилансер жмёт "🔔 Уведомлять об этом фильтре" рядом со строкой фильтров
из п.1 — сохраняется текущее сочетание (категория, тэги, минимальный
бюджет). Когда появляется новый заказ, подходящий под фильтр — в
`notifications` создаётся обычная запись (рендерится колокольчиком
`NotificationBell.tsx` как есть, без доработок фронта — он уже рендерит
любую `Notification` дженерик, ничего кастомного городить не нужно).

### Схема

```prisma
model SavedSearch {
  id             String    @id @default(uuid())
  userId         String
  user           User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  label          String
  categoryId     String?
  category       Category? @relation(fields: [categoryId], references: [id])
  tags           String[]  @default([])
  minBudget      Decimal?  @db.Decimal(12, 2)
  createdAt      DateTime  @default(now())
  lastMatchedAt  DateTime?

  @@index([userId])
  @@index([categoryId])
  @@map("saved_searches")
}
```

`User` (`schema.prisma:42`) — добавить `savedSearches SavedSearch[]`
рядом с `payoutAddresses`/`savedOrders` (строка ~97-98, уже есть похожие
связи из прошлых раундов — добавлять туда же). `Category` (`schema.prisma:182`)
— добавить `savedSearches SavedSearch[]` рядом с `orders Order[]`.

### Анти-спам — до реализации матчинга, не после

Это единственная реально рискованная часть раунда (см. родовую боль
"уведомления, которые лавиной падают на юзера"):

1. **Лимит на юзера**: не больше 5 активных `SavedSearch` — проверка в
   сервисе при создании (`BadRequestException`, по аналогии с
   `MAX_SKILLS_PER_PROFILE` в `users.service.ts`).
2. **Дедуп внутри одного события**: один `OrderCreated` может совпасть
   с несколькими `SavedSearch` одного и того же юзера (например, две
   похожие сохранённые подборки) — уведомление должно уйти **одно** на
   пару (userId, orderId), не по одному на каждый совпавший фильтр.
   Собрать совпадения в `Map<userId, matchedSearchLabels[]>`, одно
   `Notification.create` на юзера с текстом, перечисляющим все
   совпавшие фильтры, если их больше одного.
3. **Не уведомлять заказчика о его же заказе**: `where: { userId: { not: order.clientId } }` в запросе поиска подходящих `SavedSearch`.
4. **Троттлинг по времени, не только по объёму**: `lastMatchedAt` на
   самом `SavedSearch` — если с последнего срабатывания прошло меньше 5
   минут, не создавать новое уведомление по этому фильтру повторно
   (защита от ситуации "заказчик десятками постит однотипные заказы
   скриптом" — не эндпоинт-DoS в смысле нагрузки на сервер, а
   UX/спам-DoS в смысле "юзеру пришло 40 уведомлений за минуту"). После
   успешного матча — `update({ lastMatchedAt: now })`.
5. **Ограничить объём запроса**: матчинг заказа против `SavedSearch`
   должен быть одним индексированным запросом
   (`where: { OR: [{ categoryId: order.categoryId }, { tags: { hasSome: order.tags } }] }`),
   не full table scan с фильтрацией в JS — на масштабе проекта таблица
   маленькая, но привычку держать правильную не бросать.

### Матчинг — новый модуль, не трогать `NotificationsModule`

`apps/api/src/modules/saved-searches/` — новый модуль:
- `saved-searches.service.ts` — CRUD (`create`/`list`/`delete`, все
  scoped на `userId`, `delete` — `NotFoundException` при чужом id, не
  `ForbiddenException`, как в `payout-addresses.service.ts`).
- `saved-searches.controller.ts` — `POST /saved-searches`,
  `GET /saved-searches`, `DELETE /saved-searches/:id`, всё за
  `JwtAuthGuard`.
- `saved-search-matcher.listener.ts` — `@OnEvent(DomainEventName.OrderCreated)`,
  по образцу `NotificationsEventsListener` (`notifications-events.listener.ts:23`),
  но **отдельный класс в своём модуле**, не дописывать в чужой листенер
  — у него другая ответственность (fan-out на N юзеров, а не 1:1 как
  везде в `NotificationsEventsListener`). Полезная нагрузка
  `OrderCreatedEvent` (`shared-types/src/events.ts:39`) не содержит
  `tags` — дозапросить заказ по `orderId` из события (как уже делает
  `handleInvoicePaid`/`handleWorkSubmitted` в `notifications-events.listener.ts:34,57`).
  Создание `Notification` — переиспользовать `NotificationsService` (уже
  экспортируется из `NotificationsModule`, добавить его в `imports`
  своего модуля) вместо копипасты `prisma.notification.create`.

`app.module.ts` — зарегистрировать `SavedSearchesModule` в `imports`.

### Фронтенд

Рядом со строкой фильтров из п.1 — кнопка-колокольчик
"Уведомлять об этом фильтре" (активна, только если фильтр непустой —
хотя бы категория, тэг или бюджет заданы, иначе бессмысленно подписываться
на "все заказы вообще"). После сохранения — список активных подписок
компактной строкой под фильтрами (лейбл + крестик удалить), максимум 5,
после лимита кнопка "Уведомлять" дизейблится с тултипом.

### Тесты

`saved-searches.service.spec.ts` — лимит 5 (шестая бросает
`BadRequestException`), удаление чужой записи → `NotFoundException`.
`saved-search-matcher.listener.spec.ts` — заказ совпадает с двумя
`SavedSearch` одного юзера → **одно** уведомление; заказ клиента не
уведомляет самого клиента; `lastMatchedAt` моложе 5 минут → уведомление
не создаётся повторно.

## Definition of done

- Фильтры категории/тэгов/бюджета реально сужают ленту заказов на
  дашборде (проверено вживую: создать заказ с тэгом, отфильтровать по
  этому тэгу в другой вкладке/юзером-фрилансером).
- Сохранить фильтр → создать новый подходящий заказ (второй тестовый
  аккаунт) → уведомление появилось в колокольчике первого без
  перезагрузки страницы дольше 30с (интервал поллинга
  `NotificationBell.tsx`).
- `pnpm --filter @taskhunt/api test` зелёное.
- `pnpm --filter @taskhunt/api exec tsc --noEmit` и
  `pnpm --filter @taskhunt/web exec tsc --noEmit` чистые.
- `orchestration/README.md` обновлён по итогу раунда.
