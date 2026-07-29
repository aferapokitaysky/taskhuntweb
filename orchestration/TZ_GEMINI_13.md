# TaskHunt — ТЗ для Gemini, раунд 13: реальные метрики фрилансера + пакет независимых бэкенд-фич

13 независимых кусков, как обычно без денежной логики (кроме п.9 —
но там нет новой логики платежей, только автоматизация уже
существующего `requestWithdrawal`) и без реалтайма — оркестратор в
этом раунде занят фронтендом/безопасностью (категории как отдельная
страница, инвайты, 2FA, сессии, GDPR — [`TZ_CLAUDE_13.md`](./TZ_CLAUDE_13.md)).
Не пересекаемся файлами: `auth.*`, `orders.service.ts::findOne/findMany`,
`wallet.controller.ts`, `apps/web/**` — не твои в этом раунде (кроме
п.1, где ты трогаешь `orders.service.ts`, но другую часть файла — метод
создания/завершения бида, оркестратор трогает `findOne`/`findMany`,
конфликта строк не будет, но сделай `git pull` перед стартом и после
своей части на всякий случай сверься с диффом).

**Перед стартом**: `git pull`/`git status`.

## 1. Реальный расчёт статистик фрилансера (самое важное в этом раунде)

Проверено перед постановкой задачи: `Profile.successRate`,
`completionRate`, `avgResponseMins`, `disputesCount`, `lateDeliveries`
(`schema.prisma` в модели `Profile`) **читаются** в дюжине мест
(`matching.service.ts`, `users.service.ts`) — весь алгоритм ранжирования
фрилансеров по качеству в `rankFreelancers`/`recommendOrdersForFreelancer`
на них завязан — но **не пишутся вообще нигде**, ни одного `update` в
кодовой базе, только `seed.ts`, и там тоже нет. То есть эти поля всегда
`null`/`0` у каждого реального пользователя, и вся "умная" часть
ранжирования по факту всегда даёт нейтральный вклад. Это самая
приоритетная задача раунда — без неё несколько фич оркестратора в этом
же раунде (бейджи уровня фрилансера, `TZ_CLAUDE_13.md` п.3) просто не
имеют данных для работы.

Формулы (зафиксированы, не изобретай другие — важно единообразие с тем,
как оркестратор их использует):

- **`successRate`** — `completedOrders / acceptedOrders * 100`, где
  `acceptedOrders` = кол-во `Bid` этого фрилансера со `status: 'ACCEPTED'`,
  `completedOrders` = из них те, чей `order.status === 'COMPLETED'`.
  Пересчитывать при переходе заказа в `COMPLETED` или `CANCELLED` (оба
  меняют знаменатель или числитель).
- **`completionRate`** — из уже завершённых (`COMPLETED`) заказов этого
  фрилансера, доля тех, где **не было** ни одного `Dispute`:
  `completedWithoutDispute / completedOrders * 100`. Пересчитывать
  вместе с `successRate` (тот же триггер) — если заказ завершается и на
  нём есть спор, обе метрики пересчитываются, но `completionRate` будет
  ниже, `successRate` не обязательно (заказ мог дойти до `COMPLETED`
  даже после спора, если спор решён без отмены).
- **`avgResponseMins`** — среднее по последним 20 бидам этого
  фрилансера: `bid.createdAt - order.createdAt` в минутах. Пересчитывать
  сразу при создании нового бида (в том же методе, где сейчас
  `createBid` в `orders.service.ts` — по факту создания записи, одним
  доп. запросом `avg`, не в цикле).
- **`disputesCount`** — инкремент на 1 при **открытии** спора
  (`POST /orders/:id/disputes`) на заказе, где этот юзер — принятый
  фрилансер (`order.acceptedBidId` → `Bid.freelancerId`). Осознанное
  упрощение: инкремент независимо от того, кто прав (структурного поля
  "кто виноват" в `Dispute` сейчас нет, `resolutionNotes` — свободный
  текст) — задокументируй эту же оговорку в PR/коммите, это не баг, а
  сознательный трейд-офф ради простоты в этом раунде.
- **`lateDeliveries`** — инкремент при сдаче работы (`Delivery`/
  approve милстоуна), если `order.deadline` установлен и сдача
  произошла позже него.

Реализация — **событийно**, не крон: там, где уже меняется
`order.status`/создаётся `Bid`/`Dispute`/`Delivery` в
`orders.service.ts`/`milestones.service.ts` (посмотри, где конкретно
происходят эти переходы — не переписывай сами переходы, только
добавляй пересчёт статистик **после** успешного изменения, в том же
транзакционном блоке если он есть). Каждая метрика — отдельный
приватный метод (`recalculateSuccessMetrics(freelancerId)`,
`recalculateAvgResponseTime(freelancerId)` и т.д.), вызываемый точечно
из места конкретного события — не пересчитывай всё разом на каждое
изменение, лишняя нагрузка.

### Definition of done (п.1)

- Юнит-тесты на каждую формулу отдельно (моки Prisma, как уже принято
  в `matching.service.spec.ts`) — не полагаться только на интеграционную
  проверку.
- Ручная проверка на реальной БД: провести тестовый заказ через полный
  цикл (отклик → принятие → сдача → приёмка) → `GET /users/:id` (или
  `/users/me`) показывает ненулевой `successRate`.

## 2. Отпускной режим фрилансера ("не беспокоить")

`Profile.vacationUntil DateTime?` (новое поле, миграция). Когда
установлено и `> now()`:
- `UsersService.findFreelancers` — исключать из выдачи (`where: { OR: [{ vacationUntil: null }, { vacationUntil: { lt: now } }] }`).
- `MatchingService.recommendFreelancersForOrder` — так же исключать из
  кандидатов на ранжирование (не тратить очки скоринга на недоступного).
- Публичный профиль (`getPublicProfile`) — **не** исключать (сам себя
  посмотреть/поделиться ссылкой можно всегда), просто отдавать поле,
  фронт (не в этом раунде) решит, показывать ли плашку.
- `PATCH /users/me/profile` — расширить `UpdateProfileDto` полем
  `vacationUntil?: string` (ISO-дата, `@IsOptional() @IsDateString()`).
  `null`/отсутствие — отпуск выключен.

### Definition of done (п.2)

- Фрилансер с `vacationUntil` в будущем не появляется в
  `GET /users/freelancers` и не попадает в `recommendFreelancersForOrder`.
- Дата в прошлом (отпуск закончился) — снова появляется, без ручного
  сброса поля (просто `lt: now` в фильтре, не крон).

## 3. "Нанять снова" — история фрилансеров заказчика

`UsersService` (или `OrdersService`, где логичнее по существующим
паттернам файла) — новый метод `listPreviousFreelancers(clientId)`:
все уникальные фрилансеры, с которыми у этого заказчика был хотя бы
один заказ `status: 'COMPLETED'` (через `Bid.status === 'ACCEPTED'` на
заказах этого `clientId`), с агрегатом: сколько раз нанимал, средний
рейтинг, который заказчик им поставил (`Review` где `authorId = clientId,
targetId = freelancerId`). `GET /users/me/previous-freelancers`
(`JwtAuthGuard`, `RolesGuard`, `@Roles('CLIENT')`).

### Definition of done (п.3)

- Заказчик с двумя завершёнными заказами у одного и того же фрилансера
  — в ответе одна запись с `hireCount: 2`, не дублируется.
- Заказчик без завершённых заказов — пустой массив, не ошибка.

## 4. Клонирование заказа

`OrdersService.cloneOrder(clientId, orderId)` — проверить
`order.clientId === clientId`, создать новый `Order` со
`status: 'DRAFT'` (не сразу `OPEN` — пусть заказчик подтвердит/поправит
перед публикацией, безопаснее чем сразу публиковать копию), скопировав
`categoryId`/`title` (с припиской " (копия)")/`description`/`tags`/
`budgetMin`/`budgetMax`/`currency`. **Не** копировать `deadline` (старая
дата в прошлом бессмысленна) — оставить `null`, заказчик проставит сам.
`POST /orders/:id/clone` (`JwtAuthGuard`, `RolesGuard`, `@Roles('CLIENT')`).

### Definition of done (п.4)

- Клон заказа не своего клиента — 403.
- Новый заказ в статусе `DRAFT`, не виден в публичных листингах, пока
  заказчик не переведёт его в `OPEN` через уже существующий
  `PATCH /orders/:id`.

## 5. Подтверждение навыков (skill endorsements)

```prisma
model SkillEndorsement {
  id          String   @id @default(uuid())
  endorserId  String
  endorser    User     @relation("EndorsementAuthor", fields: [endorserId], references: [id])
  targetId    String
  target      User     @relation("EndorsementTarget", fields: [targetId], references: [id])
  skillId     String
  skill       Skill    @relation(fields: [skillId], references: [id])
  orderId     String
  order       Order    @relation(fields: [orderId], references: [id])
  createdAt   DateTime @default(now())

  @@unique([endorserId, targetId, skillId, orderId])
  @@map("skill_endorsements")
}
```

`POST /orders/:id/endorse` (`JwtAuthGuard`) — body `{ skillId }`,
только если вызывающий — `order.clientId`, заказ `status: 'COMPLETED'`,
и `skillId` реально есть среди навыков фрилансера (`ProfileSkill`) —
нельзя подтвердить то, чего у него не указано. `@@unique` защищает от
повторного подтверждения того же навыка на том же заказе.

`getPublicProfile`/`findFreelancers` — добавить к каждому навыку в
`skills[]` подсчёт `endorsementCount` (`groupBy` по `skillId`, батчем
для списка, как везде в этом раунде — не в цикле).

### Definition of done (п.5)

- Подтвердить навык, которого нет у фрилансера — 400.
- Подтвердить дважды с одного заказа — второй раз ошибка (unique
  constraint), не тихий дубликат.

## 6. Admin: слияние дублирующихся навыков

Anti-spam в `findOrCreateSkill` (раунд ранний, `catalog.service.ts`)
ловит точные регистронезависимые совпадения, но не "React" vs "ReactJS"
— со временем список навыков всё равно засоряется. `POST /admin/skills/:id/merge-into/:targetId`
(`JwtAuthGuard`, `RolesGuard`, `@Roles('ADMIN')` или как там называется
существующая admin-роль — свериться с `admin.controller.ts`): переносит
все `ProfileSkill` с `skillId = :id` на `:targetId` (ловить возможные
`P2002` при переносе, если у профиля уже есть оба навыка — тогда просто
удалить старую связь, не переносить дубликат), затем удаляет исходный
`Skill`. Транзакция (`prisma.$transaction`), чтобы не оставить состояние
частично перенесённым при сбое.

### Definition of done (п.6)

- Слияние двух навыков — у всех профилей, где был исходный, теперь
  целевой (без дублей у профилей, где был и тот, и другой).
- Исходный `Skill` удалён, `GET /skills` больше его не возвращает.

## 7. Автоархивация зависших заказов

`OrderStatus` — добавить значение `EXPIRED` (миграция enum). BullMQ
repeatable job (по образцу `apps/api/src/modules/subscriptions/subscription-expiration.processor.ts`
— тот же паттерн queue+processor+cron-выражение, не изобретай новую
инфраструктуру): раз в сутки находить `Order` со `status: 'OPEN'`,
`createdAt` старше 60 дней, `_count.bids === 0`, переводить в
`status: 'EXPIRED'`, отправлять заказчику уведомление ("Ваш заказ «X»
автоматически архивирован — 0 откликов за 60 дней, можно переопубликовать").

### Definition of done (п.7)

- Джоба идемпотентна — повторный запуск не шлёт уведомление повторно
  уже заэкспайренным заказам (фильтр по `status: 'OPEN'` в выборке уже
  это гарантирует, просто явно провалидировать тестом).

## 8. Дайджест уведомлений (email раз в день/неделю)

Расширить `NotificationPreference` (или добавить отдельное поле
`User.digestFrequency`, что архитектурно чище — не путать "включён ли
канал" с "как часто дайджест") — enum `DigestFrequency { NONE DAILY WEEKLY }`,
дефолт `NONE`. `PATCH /notifications/preferences/digest` — body
`{ frequency }`.

BullMQ repeatable job (аналогично п.7) — раз в день/раз в неделю
(два отдельных cron-выражения) находит юзеров с соответствующим
`digestFrequency`, собирает их непрочитанные in-app `Notification` за
период с последнего дайджеста (нужно поле `User.lastDigestSentAt`,
чтобы не задваивать окно), если их 0 — пропустить (не слать пустое
письмо), иначе — одно письмо-сводка через уже существующий email-путь
`notifications-service` (посмотреть, как туда сейчас кладутся задачи
на отправку — через ту же очередь/паттерн, не городить новый транспорт).

### Definition of done (п.8)

- Юзер с `frequency: DAILY` и 3 непрочитанными уведомлениями за сутки —
  получает одно письмо с 3 пунктами, не 3 письма.
- Юзер с `frequency: NONE` (дефолт) — джоба его не трогает вообще.

## 9. Автовывод при достижении порога баланса

`Wallet` — новые поля `autoWithdrawThreshold Decimal? @db.Decimal(12, 2)`,
`autoWithdrawAddressId String?` (ссылка на существующую
`SavedPayoutAddress`, раунд 9). `PATCH /wallet/auto-withdraw` — body
`{ threshold, savedAddressId }` или `{ threshold: null }` чтобы выключить.

BullMQ repeatable job (раз в час) — находит кошельки с установленным
`autoWithdrawThreshold`, где `withdrawableBalance >= threshold`, **вызывает
уже существующий** `WalletService.requestWithdrawal()` (никакой новой
денежной логики — только автоматический триггер существующего пути,
включая уже работающий payout-воркер и откат при неудаче). Не изобретай
параллельный путь вывода денег.

### Definition of done (п.9)

- Ручной тест: выставить `threshold` ниже текущего баланса кошелька,
  дождаться/вручную дёрнуть джобу — заявка на вывод создалась через тот
  же `requestWithdrawal`, что и ручной вывод (проверить по `LedgerTransaction`,
  что это неотличимо от обычного вывода).

## 10. Rate limit по тиру подписки

Сейчас `ThrottlerModule` (`app.module.ts:46`) — один глобальный лимит
на всех. Подписчики Pro/Premium платят за приоритет — логично, чтобы
это касалось и API-лимитов, не только бизнес-фич (комиссия/лимиты
заказов, уже есть). Кастомный guard `SubscriptionAwareThrottlerGuard extends ThrottlerGuard`,
переопределить `getTracker`/лимит на основе `req.user?.subscription?.tier.name`
(`STARTER` — текущий дефолтный лимит, `PRO`/`PREMIUM` — например, 2x/4x).
Подключить вместо текущего `ThrottlerGuard` в `APP_GUARD` (`app.module.ts:104`).

### Definition of done (п.10)

- Юзер без подписки упирается в лимит на N-м запросе, юзер с `PREMIUM`
  — на 4×N. Тест на самом guard (не e2e — мокнуть `ExecutionContext`).

## 11. Похожие заказы

`GET /orders/:id/similar` — та же категория ИЛИ пересечение по `tags`
(`hasSome`), исключая сам заказ и заказы в статусе `CLOSED`/`CANCELLED`/
`EXPIRED`, сортировка по количеству совпавших тэгов затем по свежести,
лимит 5. Чистый Prisma-запрос, без нового сервиса — метод в
`orders.service.ts` рядом с `findOne`. Фронтенд под это — не в этом
раунде (оркестратор подключит в одном из следующих, если понадобится),
задача чисто бэкенд-эндпоинт.

### Definition of done (п.11)

- Заказ без тэгов и без заказов той же категории — пустой массив, не
  ошибка.

## 12. Бейдж "Проверенный плательщик" на профиле заказчика

Чистое вычисляемое поле (как `level` фрилансера у оркестратора в
`TZ_CLAUDE_13.md` п.3, но своя, более простая версия — не завязана на
успеваемость, только на факт хотя бы одной успешно закрытой эскроу-
сделки): `verifiedPayer: boolean` — `true`, если у этого юзера есть
хотя бы один `Order` со `status: 'COMPLETED'`, где он `clientId`.
Добавить в `getPublicProfile` заказчика и в объект `client` внутри
`findOne`/`findMany` заказов (`orders.service.ts` — небольшое дополнение
к уже существующему `include`, не трогать саму структуру ответа, только
добавить вычисляемое поле после запроса). Защищает фрилансеров от
заказов от свежесозданных/мошеннических аккаунтов заказчиков —
дополняет уже существующие анти-фрод эвристики в `fraud-service`
(`scoreOrderCreated` уже штрафует молодые аккаунты, это тот же сигнал,
но видимый пользователю на карточке заказа, не только внутри скоринга).

### Definition of done (п.12)

- Новый заказчик без завершённых заказов — `verifiedPayer: false`.

## 13. CSV-экспорт истории операций

`GET /wallet/transactions/export.csv` (`JwtAuthGuard`) — стримом
(`res.setHeader('Content-Type', 'text/csv')`) отдать всю историю
`LedgerEntry` текущего юзера (переиспользовать выборку из
`getTransactionHistory`, без пагинации — там курсорная, тут просто
`findMany` без `take`) в формате CSV: `Дата,Тип,Сумма,Валюта,Описание`.
Без внешних CSV-библиотек — формат простой, ручная сборка строк
(экранировать запятые/кавычки в `description` по RFC 4180, это
единственное поле со свободным текстом).

### Definition of done (п.13)

- CSV открывается в Excel/Google Sheets без битых строк даже если
  `description` содержит запятую или кавычку.
- Пустая история — CSV с одной строкой заголовка, не 500.

## Итоговый Definition of done раунда

- `pnpm --filter @taskhunt/api test` и `pnpm --filter @taskhunt/api build`
  — зелёные после всех 13 пунктов.
- Каждая новая модель — через `prisma migrate dev`, миграции
  закоммичены (`apps/api/prisma/migrations/`), **не** `db push`.
- Отчитайся в `STATUS_GEMINI_13.md` по каждому пункту отдельным чек-боксом
  (как обычно) — если что-то по ходу оказалось неоднозначным или нужно
  поменять чужой файл — не трогай, опиши в разделе "Вопросы к
  оркестратору".
