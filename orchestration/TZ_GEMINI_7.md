# TaskHunt — ТЗ для Gemini, раунд 7: расширенная аналитика админки

Твоя зона — только `apps/api/src/modules/admin/`, миграция в
`apps/api/prisma/`, и точечно `packages/shared-types` (если понадобится
новый тип для ответа — не обязательно, можно возвращать inline-типы).
Не трогай `apps/web`, не трогай `orders`/`users`/`matching` модули —
над рекомендательным движком (ранжирование заказов/фрилансеров) и
анти-фрод-движком параллельно работает оркестратор, это отдельная зона,
не пересекается с твоей.

Контекст: сейчас `AdminService.getMetrics()` отдаёт всего 5 плоских
цифр (revenue.total/thisMonth, activeDisputes, ordersByStatus,
newUsersThisWeek, activeSubscriptionsByTier). Нужна нормальная
аналитика — тренды по времени, воронка регистрации, топы. Это чистые
Prisma-агрегации (`groupBy`/`aggregate`/`count`), без хитрой логики —
следуй уже существующему стилю `getMetrics()` как образцу.

Все новые эндпоинты — под тем же гардом, что и существующий
`GET /admin/metrics`: `@RequirePermissions(PermissionCode.FinanceViewReports)`.
Ничего нового в `PermissionCode` добавлять не нужно.

## 1. Расширить `GET /admin/metrics`

Добавь в существующий ответ (не ломай текущие поля — фронт на них уже
завязан) новые поля:

```ts
{
  // ...существующие поля как есть...
  gmv: { total: number; thisMonth: number }, // сумма Invoice.amount со status: 'PAID' — это оборот платформы, не путать с revenue (revenue = только комиссия платформы, уже есть)
  avgOrderValue: number, // среднее Invoice.amount по PAID-инвойсам
  avgTimeToHireHours: number | null, // среднее время от Order.createdAt до Bid.updatedAt для принятых (status: 'ACCEPTED') бидов, за последние 90 дней; null если нет данных
  avgDisputeResolutionHours: number | null, // среднее от Dispute.createdAt до Dispute.updatedAt для status IN ('RESOLVED_CLIENT','RESOLVED_FREELANCER','RESOLVED_SPLIT') — проверь реальные значения enum DisputeStatus в schema.prisma, не угадывай
  subscriptionChurnRate: number, // % подписок (кроме STARTER), у которых status стал EXPIRED за последние 30 дней, от числа тех, что были ACTIVE 30 дней назад. Если знаменатель 0 — верни 0
}
```

## 2. `GET /admin/metrics/revenue-timeseries?days=30`

Возвращает массив по дням за последние N дней (`days` — query param,
по умолчанию 30, максимум 365):

```ts
[{ date: '2026-07-01', revenue: number, gmv: number, newUsers: number, newOrders: number }, ...]
```

`revenue` — сумма CREDIT `LedgerEntry` на system wallet за день (тот же
принцип, что в текущем `getMetrics()`, только сгруппировано по дате).
`gmv` — сумма `Invoice.amount` с `status: 'PAID'`, сгруппировано по
`paidAt::date`. Дни без данных — не пропускай, отдавай с нулями (нужен
непрерывный ряд для графика на фронте). Группировку по дате делай в
JS после выборки сырых строк за период (`WHERE createdAt >= now - N
days`), а не через Prisma `groupBy` по дате — Prisma не умеет
группировать по усечённой дате напрямую без raw SQL, а raw SQL здесь
не нужен ради 30-90 строк данных.

## 3. `GET /admin/metrics/funnel?days=30`

Воронка по когорте пользователей, зарегистрированных за последние N
дней (по умолчанию 30):

```ts
{
  registered: number,       // User.createdAt >= now - N days
  onboarded: number,        // из них: есть Profile (Profile.userId in cohort)
  postedOrRespondedFirst: number, // из них: есть хотя бы один Order (client) ИЛИ Bid (freelancer)
  paidOrEarnedFirst: number,      // из них: есть хотя бы один PAID Invoice как payerId, ИЛИ хотя бы один Order с released эскроу как freelancer (проверь через Bid.status ACCEPTED + LedgerEntry CREDIT WITHDRAWABLE на их Wallet)
}
```

Каждое следующее число — подмножество предыдущего (когорта сужается).
Если логика "заработал первую выплату" окажется сложной для точного
SQL/Prisma-запроса — упрощай до "есть хотя бы один принятый Bid
(status ACCEPTED)" и явно напиши это упрощение в STATUS-файле, не
блокируйся на идеальной точности.

## 4. `GET /admin/metrics/top-categories?limit=10`

```ts
[{ categoryId: string; categoryName: string; orderCount: number; gmv: number }, ...]
```

По всем заказам (не только PAID), `gmv` — сумма `Invoice.amount` для
PAID-инвойсов, привязанных к заказам этой категории. Сортировка по
`gmv` убыв.

## 5. `GET /admin/metrics/top-freelancers?limit=10`

```ts
[{ userId: string; displayName: string; earnings: number; ordersCompleted: number; avgRating: number | null }, ...]
```

`earnings` — сумма CREDIT `LedgerEntry` на `WITHDRAWABLE` баланс их
кошелька (это и есть чистый заработок после комиссии). `ordersCompleted`
— число заказов со статусом `COMPLETED`, где они были принятым
фрилансером. `avgRating` — среднее `Review.rating` где они — получатель
отзыва (`reviewsReceived`), null если отзывов нет. Сортировка по
`earnings` убыв.

## Definition of done

- Все 5 эндпоинтов работают, защищены `@RequirePermissions(PermissionCode.FinanceViewReports)`.
- `pnpm --filter @taskhunt/api test` — зелёное, добавь юнит-тесты на
  новые методы `AdminService` (моки Prisma, как в существующих
  `admin.service.spec.ts`) — минимум по одному тесту на каждый новый
  метод, проверяющему форму ответа на простом фикстурном наборе данных.
- `pnpm --filter @taskhunt/api build` — чисто, `npx tsc --noEmit`
  без ошибок.
- Если понадобится Prisma-миграция (например, индекс на `createdAt`
  для ускорения time-series запроса — не обязательно, но приветствуется
  если сообразишь) — используй тот же non-interactive workflow, что и
  раньше (`prisma migrate diff --from-url ... --to-schema-datamodel ...`
  в отдельную папку с таймстампом), не `prisma migrate dev`.
- Отмечай прогресс в `STATUS_GEMINI_7.md` по каждому пункту отдельно,
  не жди конца раунда — оркестратор подключает фронт под готовые
  эндпоинты по мере появления.
