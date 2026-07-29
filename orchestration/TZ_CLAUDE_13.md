# TaskHunt — ТЗ для себя (Claude), раунд 13: категории как отдельная витрина + пакет "продовых" фич (мега-раунд)

Возвращаемся к обычному разделению: **деньги/безопасность/сложный
фронт — мне** (этот файл), **самодостаточный бэкенд без денег и без
пересечений по файлам — Gemini** ([`TZ_GEMINI_13.md`](./TZ_GEMINI_13.md)).

Контекст раунда: пользователь прямо попросил перестать ощущаться как
пет-проект и максимально продумать продукт. Ниже — **9 независимых
кусков**, каждый затрагивает разные файлы, можно делать в любом
порядке. Один нюанс зависимости: п.3 (бейджи уровня фрилансера) читает
`successRate`/`completionRate`, которые Gemini в этом же раунде
впервые начинает реально вычислять (`TZ_GEMINI_13.md`, п.1) — если его
часть ещё не смёржена, п.3 должен **деградировать на null**
(трактовать как "Новичок"), не падать. Проверено гарантированно: сейчас
эти поля не пишутся вообще нигде в кодовой базе (ни одного `update`),
только читаются — то есть весь ranking по качеству в `matching.service.ts`
уже полгода работает на пустых данных.

## 0. Явный запрос пользователя — категории без редиректа на дашборд

Сейчас клик по категории на `/categories` ведёт на
`/dashboard?categoryId=...` (`apps/web/src/app/categories/page.tsx:63,74`)
— это дашборд заказчика/фрилансера (кошелёк, форма создания заказа,
избранное) с фильтром сбоку, а не витрина категории. Пользователь хочет
отдельную страницу: своя строка поиска, карточки с полной информацией
по заказу, и если смотрит фрилансер — % совпадения с его навыками +
сколько раз заказ посмотрели + сколько откликов. Это не с
нуля — бэкенд для фильтрации (`categoryId`/`search`/`tags`/`minBudget`)
уже есть с 10-го раунда (`orders.service.ts:98-157`), не хватает только
счётчика просмотров, % совпадения в общем листинге (сейчас
`compatibilityPercent` живёт только в персональной ленте
`recommendOrdersForFreelancer`, не в обычном `GET /orders`) и самой
страницы.

## 1. Категории → отдельная витрина

### Бэкенд — счётчик просмотров заказа

`schema.prisma` — новое поле на `Order` (сосед `tags`, по аналогии с
`Profile.viewsCount`):

```prisma
model Order {
  ...
  viewsCount   Int           @default(0)
  ...
}
```

Миграция: `prisma migrate dev --name order_views_count` в `apps/api`
(не `db push`, см. `docs/CONTRIBUTING.md`).

`orders.service.ts::findOne(id)` — инкремент при каждом просмотре
(та же простая семантика, что уже есть у `Profile.viewsCount` —
не защищено от накрутки владельцем, это осознанно, не блокер):

```ts
async findOne(id: string) {
  const order = await this.prisma.order.update({
    where: { id },
    data: { viewsCount: { increment: 1 } },
    include: { /* как сейчас, ничего не менять в include */ },
  });
  ...
}
```

### Бэкенд — % совпадения в обычном листинге заказов

Сейчас `GET /orders` (`orders.controller.ts:25-38`) полностью публичный,
без гварда, поэтому не знает, кто спрашивает. Нужен **опциональный**
JWT-гвард (в кодовой базе такого паттерна ещё нет — только жёсткий
`JwtAuthGuard`, который кидает 401 без токена):

`apps/api/src/common/guards/optional-jwt-auth.guard.ts` (новый файл):

```ts
import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Как JwtAuthGuard, но не требует токена — если его нет/невалиден,
 * просто прокидывает user = null дальше, а не кидает 401. Нужен для
 * эндпоинтов, публичных по умолчанию, но с доп. данными для
 * залогиненных (тут — % совпадения заказа с навыками фрилансера). */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err: unknown, user: unknown) {
    return user ?? null;
  }
}
```

`orders.controller.ts::findMany` — навесить `@UseGuards(OptionalJwtAuthGuard)`,
принять `@CurrentUser() user: AuthenticatedUser | null`, прокинуть
`user?.id` в сервис как `requesterId`.

`matching.service.ts` — функция `compatibilityPercent` (строка 22)
сейчас module-private. Добавить `export` (просто одно слово), это
чистая функция без DI — импортировать напрямую в `orders.service.ts`
без циклической зависимости между модулями.

`orders.service.ts::findMany` — принять доп. параметр `requesterId?: string`,
если передан — одним запросом подтянуть навыки фрилансера
(`this.prisma.profile.findUnique({ where: { userId: requesterId }, include: { skills: { include: { skill: true } } } })`),
и в конце маппинга добавить на каждый заказ
`compatibilityPercent: skillNames ? compatibilityPercent(order.tags, skillNames) : null`.
Если у юзера нет профиля/навыков (заказчик, не фрилансер) — просто `null`,
фронт скрывает пилюлю.

Заодно (нужно для п.2 этого же раунда — приглашение на заказ): добавить
фильтр `clientId` в `findMany`/`findMany` DTO — заказчик должен видеть
только свои открытые заказы при выборе, куда пригласить фрилансера.

### Фронтенд — новая страница

`apps/web/src/app/categories/[id]/page.tsx` (новый файл):
- Категорию (имя, дети) брать из уже загруженного `GET /categories`
  (не заводить отдельный `GET /categories/:id` — списочный эндпоинт и
  так отдаёт дерево с `orderCount`, доставать нужный узел на фронте).
- Своя строка поиска (debounce ~400мс) + фильтры бюджет/тэги, дергающие
  `GET /orders?categoryId=<id>&search=...&minBudget=...` — тот же паттерн
  debounce, что уже есть в `dashboard/page.tsx` для поиска по заказам,
  переиспользовать логику 1-в-1 (не выдумывать новую).
- Карточка заказа — полнее, чем на дашборде: заголовок, **полное**
  описание (не `line-clamp-2`, максимум `line-clamp-4` с "показать
  полностью"), бюджет, дедлайн если есть, тэги, футер:
  `👁 {viewsCount} просмотров · 💬 {bidsCount} откликов` (тех же иконок,
  что уже в проекте — `EyeIcon` уже создан в прошлом раунде для
  профиля, переиспользовать) + если `me.primaryRole === 'FREELANCER'` и
  `order.compatibilityPercent !== null` — пилюля `🎯 {N}% по вашим
  навыкам`, цвет по порогу (`>=70` зелёный `bg-emerald-100 text-emerald-700`,
  `40-69` янтарный, `<40` серый — не красный, чтобы не выглядело как
  ошибка).
- Небольшой довесок к этой же странице: "Недавно просмотренные" —
  чисто клиентская фича без бэкенда. При заходе на `/orders/[id]`
  дописывать `{id, title, viewedAt}` в `localStorage` (ключ
  `taskhunt:recentlyViewed`, максимум 10, новые сверху, дедуп по id).
  На странице категории — маленький блок сбоку "Вы недавно смотрели"
  (только если что-то есть в этой же категории).
- `apps/web/src/app/categories/page.tsx` — заменить ссылки
  `href={`/dashboard?categoryId=${category.id}`}` (обе — родительская и
  дочерняя категория, строки 63 и 74) на `href={`/categories/${category.id}`}`.
  Сам фильтр по категории на дашборде **не трогать** — он остаётся
  рабочим как есть, просто больше не единственная точка входа.

### Definition of done (п.1)

- Открыть заказ дважды под разными аккаунтами → `viewsCount` = 2.
- `GET /orders?categoryId=X` без токена — `compatibilityPercent` не
  приходит вообще или `null` у всех, без 401.
- `GET /orders?categoryId=X` с токеном фрилансера, у которого есть
  навыки, пересекающиеся с тэгами заказа — `compatibilityPercent` > 0.
- `/categories/[id]` рендерит карточки, поиск внутри категории реально
  фильтрует (проверить оба конца — пусто и совпадение).
- `tsc --noEmit`, живая проверка в браузере (десктоп + мобильная
  ширина), скриншот до/после для сравнения с дашбордом.

## 2. Прямой инвайт фрилансера на заказ

Сейчас единственный способ нанять — ждать отклика. Заказчик, который
посмотрел публичный профиль фрилансера (`/freelancers/[id]`) или
пролистал каталог (`/freelancers`), не может позвать его на конкретный
свой заказ напрямую.

### Схема

```prisma
enum OrderInviteStatus {
  PENDING
  ACCEPTED
  DECLINED
}

model OrderInvite {
  id           String            @id @default(uuid())
  orderId      String
  order        Order             @relation(fields: [orderId], references: [id], onDelete: Cascade)
  freelancerId String
  freelancer   User              @relation("OrderInviteFreelancer", fields: [freelancerId], references: [id])
  clientId     String
  client       User              @relation("OrderInviteClient", fields: [clientId], references: [id])
  status       OrderInviteStatus @default(PENDING)
  createdAt    DateTime          @default(now())

  @@unique([orderId, freelancerId])
  @@map("order_invites")
}
```

Добавить обратные связи `invites OrderInvite[]` на `Order`, и на `User`
— `sentInvites`/`receivedInvites` с теми же именами relation.

### Бэкенд

`orders.service.ts`:
- `inviteFreelancer(clientId, orderId, freelancerId)` — проверить
  `order.clientId === clientId` (иначе 403), `order.status === 'OPEN'`
  (иначе 400 "нельзя пригласить на закрытый заказ"), `freelancer.roles`
  содержит `FREELANCER`. `create`, ловить `P2002` → 409 "уже приглашён".
  Эмитить событие (по образцу существующих `DomainEventName` из
  `saved-search-matcher.listener.ts`) → уведомление фрилансеру "Вас
  пригласили на заказ «{title}»" с ссылкой на заказ.
- `listMyInvites(freelancerId)` — `where: { freelancerId, status: 'PENDING' }, include: { order: true }`.
- Мелкий приятный штрих: в `createBid` — если у freelancerId есть
  `OrderInvite` на этот orderId со статусом `PENDING`, при успешном
  отклике перевести его в `ACCEPTED` (одна доп. строка, не отдельная
  фича).

`orders.controller.ts`:
- `@Post(':id/invite')` (`JwtAuthGuard`, `RolesGuard`, `@Roles('CLIENT')`) —
  body `{ freelancerId: string }`.
- `@Get('invites/mine')` (`JwtAuthGuard`) — для фрилансера.

### Фронтенд

- `apps/web/src/components/FreelancerCard.tsx` и
  `apps/web/src/app/freelancers/[id]/page.tsx` — если у текущего юзера
  роль `CLIENT`, кнопка "Пригласить на заказ" → модалка со списком
  `GET /orders?clientId=me.id&status=OPEN` (используя фильтр `clientId`
  из п.1) → выбор заказа → `POST /orders/:id/invite`.
- `dashboard/page.tsx` — при загрузке (для фрилансера) дёрнуть
  `GET /orders/invites/mine`, на карточке приглашённого заказа —
  пилюля `🎯 Вас пригласили` перед кнопкой "Откликнуться".

### Definition of done (п.2)

- Заказчик приглашает фрилансера на свой открытый заказ — фрилансер
  получает уведомление и видит пилюлю на дашборде.
- Повторное приглашение того же фрилансера на тот же заказ — понятная
  ошибка, не 500.
- Приглашение на чужой заказ (не свой) — 403.
- Живая проверка: два реальных аккаунта в браузере.

## 3. Бейджи уровня фрилансера (Top Rated / Rising Talent / Новичок)

Чистая презентационная фича поверх статистик, которые Gemini в этом же
раунде начинает реально считать (`TZ_GEMINI_13.md`, п.1). Не хранится в
БД — считается на лету, чтобы не рассинхронизироваться с исходными
метриками.

`apps/api/src/modules/users/users.service.ts` — новая чистая функция:

```ts
type FreelancerLevel = 'TOP_RATED' | 'RISING_TALENT' | 'NEW';

function computeFreelancerLevel(completedOrders: number, successRate: number | null): FreelancerLevel {
  if (completedOrders >= 10 && (successRate ?? 0) >= 95) return 'TOP_RATED';
  if (completedOrders >= 3 && (successRate ?? 0) >= 90) return 'RISING_TALENT';
  return 'NEW';
}
```

`completedOrders` — count принятых бидов, чей заказ дошёл до `COMPLETED`
(`this.prisma.bid.count({ where: { freelancerId, status: 'ACCEPTED', order: { status: 'COMPLETED' } } })`).
Добавить `level: computeFreelancerLevel(...)` в ответ `getPublicProfile`
(`users.service.ts` — там же, где уже лежит `viewsCount`/`portfolioItems`,
починенные в прошлом раунде) и `findFreelancers` (список — здесь считать
**батчем**, `groupBy` по `freelancerId` с фильтром на `COMPLETED`, тот же
приём, что Gemini использовал для `orderCount`/`usageCount` в
`catalog.service.ts`, не N+1 в цикле).

Фронтенд:
- Новая иконка `apps/web/src/components/icons/MedalIcon.tsx` —
  геометрические примитивы (circle + rect лента), **не** свободные
  bezier-пути (см. урок прошлого раунда с CodeIcon/DesignIcon).
- `apps/web/src/components/FreelancerLevelBadge.tsx` — маленькая пилюля
  с иконкой + текстом ("Лучший исполнитель" / "Восходящая звезда"),
  `NEW` — не рендерить бейдж вообще (не создавать шум для большинства
  новых фрилансеров).
- Вставить в `FreelancerCard.tsx` (каталог `/freelancers`) и
  `/freelancers/[id]/page.tsx` (публичный профиль, рядом с именем).

### Definition of done (п.3)

- Фрилансер с 0 завершённых заказов — бейдж не рендерится нигде.
- Список `/freelancers` не даёт N+1 (проверить один SQL-батч в логах
  Prisma, не по запросу на фрилансера).

## 4. Двухфакторная аутентификация (TOTP)

Новая зависимость: `otplib` (генерация/проверка TOTP-кодов) и `qrcode`
(QR как data URL) — добавить в `apps/api/package.json`.

### Схема

```prisma
model User {
  ...
  totpSecret  String?
  totpEnabled Boolean @default(false)
  backupCodes TotpBackupCode[]
}

model TotpBackupCode {
  id        String    @id @default(uuid())
  userId    String
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  codeHash  String
  usedAt    DateTime?
  createdAt DateTime  @default(now())

  @@map("totp_backup_codes")
}
```

### Бэкенд (`auth.service.ts` / `auth.controller.ts`)

- `POST /auth/2fa/enroll` (`JwtAuthGuard`) — `otplib.authenticator.generateSecret()`,
  сохранить во **временное** поле (можно тот же `totpSecret`, но
  `totpEnabled` остаётся `false` до подтверждения), вернуть
  `{ secret, qrCodeDataUrl, otpauthUrl }` (`qrcode.toDataURL(otpauthUrl)`).
- `POST /auth/2fa/enroll/confirm` — body `{ code }`, проверить
  `authenticator.check(code, user.totpSecret)`, при успехе
  `totpEnabled = true` + сгенерировать 10 backup-кодов (случайные
  8-значные, хранить только `bcrypt.hash`), вернуть **plaintext один
  раз** — фронт обязан показать с предупреждением "сохраните, больше не
  покажем".
- `POST /auth/2fa/disable` — body `{ password }` (re-auth тем же
  паттерном, что уже есть в `changePassword`), очистить `totpSecret`,
  `totpEnabled = false`, удалить все `TotpBackupCode`.
- **Изменение `login()`**: если `user.totpEnabled` — не выдавать
  токены сразу, вернуть `{ requiresTotp: true, totpToken }`, где
  `totpToken` — короткоживущий JWT (`expiresIn: '5m'`, `purpose: 'totp'`
  в payload, отдельный от access/refresh, чтобы не спутать).
- Новый `POST /auth/2fa/verify` — body `{ totpToken, code }`, проверить
  `purpose === 'totp'`, проверить `code` либо TOTP, либо один из
  неиспользованных backup-кодов (при использовании backup-кода —
  проставить `usedAt`), при успехе — обычная выдача access/refresh
  токенов (переиспользовать существующий приватный метод issue-токенов,
  не дублировать).

### Фронтенд

- `apps/web/src/app/profile/page.tsx` — секция "Безопасность"
  (там же, где уже смена пароля с прошлого раунда) — новый блок
  "Двухфакторная аутентификация": если выключена — кнопка "Включить" →
  модалка (QR картинкой `<img src={qrCodeDataUrl}>`, поле 6-значного
  кода, кнопка "Подтвердить") → экран с backup-кодами (моноширинный
  список, кнопка "Скопировать все") → готово. Если включена — статус +
  кнопка "Отключить" (модалка с полем пароля).
- `apps/web/src/app/login/page.tsx` — обработать `requiresTotp` в
  ответе на `POST /auth/login`: вместо `saveTokens` сразу — показать
  второй шаг (поле кода, текст "Введите код из приложения или один из
  резервных кодов"), сабмит на `/auth/2fa/verify` с сохранённым
  `totpToken`.

### Definition of done (п.4)

- Полный цикл: включить 2FA → разлогиниться → залогиниться с TOTP-кодом
  (сгенерированным вручную через `otplib` в тесте, секрет известен) →
  успех. Неверный код → понятная ошибка, токены не выдаются.
- Backup-код одноразовый — повторное использование того же кода даёт
  ошибку.
- Юнит-тесты в `auth.service.spec.ts` (уже существующий файл, там уже
  тесты на `changePassword` — дописать рядом, не переписывать).

## 5. Управление активными сессиями

Сейчас refresh-токен полностью stateless (`auth.service.ts:239-258`,
просто JWT, никакой записи в БД) — значит **невозможно** отозвать
конкретную сессию или посмотреть "с каких устройств я залогинен".
Вводим минимальный статeful слой поверх существующих JWT, не ломая сам
формат токенов.

### Схема

```prisma
model RefreshSession {
  id          String    @id @default(uuid())
  userId      String
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  tokenHash   String    @unique
  userAgent   String?
  ip          String?
  createdAt   DateTime  @default(now())
  lastUsedAt  DateTime  @default(now())
  revokedAt   DateTime?

  @@map("refresh_sessions")
}
```

### Бэкенд

- При выдаче refresh-токена (логин, регистрация, OAuth callback,
  и после `refresh()`) — заодно создавать `RefreshSession` с
  `tokenHash = sha256(refreshToken)` (не хранить сырой токен), `userAgent`/`ip`
  из `req` (нужно прокинуть `@Req()` там, где сейчас его нет).
- `refresh(refreshToken)` — **после** проверки JWT-подписи (как сейчас),
  **дополнительно** искать `RefreshSession` по хэшу, если не найдена
  или `revokedAt !== null` → 401 "сессия отозвана" (даже если сама JWT
  подпись валидна — это и есть смысл фичи, отзыв независимо от срока
  жизни токена). При успехе — `lastUsedAt = now()`, и (по стандартной
  практике ротации refresh-токенов) старую сессию revoke, создать новую
  на новый токен.
- `GET /auth/sessions` (`JwtAuthGuard`) — список своих
  `RefreshSession` (`revokedAt: null`), без `tokenHash` в ответе.
- `DELETE /auth/sessions/:id` — проверить владельца, `revokedAt = now()`.
- `POST /auth/sessions/revoke-others` — revoke всё кроме сессии
  текущего запроса (нужно знать id текущей — прокинуть через тот же
  hash-лукап в `JwtAuthGuard`/`CurrentUser`, доп. поле).

**Важно**: это меняет ключевой путь `refresh()`, который уже покрыт тестами
(`auth.service.spec.ts`) — прогнать существующие тесты и обновить моки
Prisma (добавится `refreshSession.create`/`findUnique`/`update`).

### Фронтенд

`apps/web/src/app/profile/page.tsx` — секция "Безопасность", блок
"Активные сессии": список (иконка устройства по `userAgent` — простой
regex на "Mobile"/"iPhone" vs остальное, дата последней активности,
IP), кнопка "Завершить" на каждой (кроме текущей — помечена "Это
устройство"), кнопка "Завершить все остальные".

### Definition of done (п.5)

- Логин с двух разных "устройств" (двух вкладок/токенов) — оба видны в
  списке. Отзыв одного — тот аккаунт больше не может обновить токен
  (`refresh()` даёт 401), второй продолжает работать.
- Существующие тесты auth не сломаны (или осознанно обновлены под новую
  логику).

## 6. GDPR: экспорт данных и удаление аккаунта

`schema.prisma` — добавить `DELETED` в `enum UserStatus` (сейчас
`PENDING_VERIFICATION | ACTIVE | SUSPENDED | BANNED`).

### Бэкенд

- `GET /users/me/export` (`JwtAuthGuard`) — собрать JSON: сам `User`
  (без `passwordHash`/`totpSecret`), `Profile`, заказы как заказчик,
  бид как фрилансер, `Review` (и как автор, и как цель), `Wallet` +
  `LedgerEntry` (переиспользовать `getTransactionHistory` без пагинации,
  `limit` побольше или отдельный полный запрос), `PortfolioItem`,
  `SavedSearch`. Отдать с заголовком
  `Content-Disposition: attachment; filename="taskhunt-data.json"`.
- `DELETE /users/me` (`JwtAuthGuard`) — body `{ password }`, `bcrypt.compare`
  как в `changePassword`. При успехе: `status = 'DELETED'`,
  `email = 'deleted-' + user.id + '@taskhunt.invalid'`, очистить
  `profile.displayName/bio/avatarUrl/avatarData/githubUrl/websiteUrl`
  (заменить на `'Удалённый пользователь'`/`null`), отозвать все
  `RefreshSession` (см. п.5) — если п.5 ещё не смёржен, просто
  пропустить этот шаг. **Не удалять** `Order`/`Bid`/`LedgerEntry`/`Review`
  — финансовая история должна остаться для комплаенса и для контрагентов
  (заказчик/фрилансер по ту сторону сделки не должен потерять свой
  собственный вид истории). `AuthGuard`/`JwtStrategy` — убедиться, что
  `status !== 'ACTIVE'` блокирует будущий логин (проверить, уже ли есть
  такая проверка для `SUSPENDED`/`BANNED` — если да, `DELETED` просто
  попадает под тот же кейс).

### Фронтенд

`apps/web/src/app/profile/page.tsx` — новая секция "Данные и
приватность" (последняя, под "Безопасность"): кнопка "Скачать мои
данные" (fetch + blob-download, см. паттерн ниже в п.9 — общий helper),
и danger-zone блок "Удалить аккаунт" (текст-предупреждение, модалка с
полем пароля для подтверждения, при успехе — очистить `localStorage`
токены, редирект на `/`).

### Definition of done (п.6)

- Экспорт скачивается, JSON валиден, не содержит `passwordHash`.
- Удаление аккаунта: логин после удаления невозможен, у контрагентов по
  старым заказам данные (сумма, дата) не пропали, только имя
  показывается как "Удалённый пользователь".

## 7. Шаблоны откликов для фрилансеров

```prisma
model BidTemplate {
  id                  String   @id @default(uuid())
  freelancerId        String
  freelancer          User     @relation(fields: [freelancerId], references: [id], onDelete: Cascade)
  name                String
  message             String
  defaultDeliveryDays Int?
  createdAt           DateTime @default(now())

  @@map("bid_templates")
}
```

CRUD 1-в-1 по паттерну `PortfolioItem` из раунда 10/12 (`users.service.ts`/
`users.controller.ts`): `POST/GET/PATCH/DELETE /users/me/bid-templates`,
константа `MAX_BID_TEMPLATES = 10`.

Фронтенд: `apps/web/src/app/profile/page.tsx` — новая секция "Шаблоны
откликов" (тот же card-CRUD паттерн, что уже есть у портфолио в этом же
файле — переиспользовать структуру, не изобретать новую). В
`dashboard/page.tsx`, в форме отклика (`selectedOrder` секция,
~строка 700) — дропдаун "Вставить шаблон" над textarea, при выборе
заполняет `bidForm.message`/`bidForm.deliveryDays` из шаблона (юзер
может отредактировать после вставки, это черновик, не финальный текст).

### Definition of done (п.7)

- Создать шаблон, применить его при отклике на реальный заказ, значения
  подставились, юзер их подправил и отправил — бид ушёл с
  отредактированным текстом.

## 8. SEO для публичных страниц заказов и профилей

Сейчас `orders/[id]/page.tsx` и `freelancers/[id]/page.tsx` —
`'use client'` целиком, поэтому нет ни динамического `<title>`, ни
OpenGraph, ни JSON-LD — для маркетплейса, где органический трафик "React
разработчик фрилансер" критичен, это дыра.

Рефактор структуры (стандартный App Router паттерн — сервер-компонент
для метаданных снаружи, клиент-компонент для интерактивности внутри):

- `apps/web/src/app/orders/[id]/page.tsx` — переименовать текущее
  содержимое в `OrderDetailClient.tsx` (тот же файл, тот же код, просто
  новое имя компонента и файла). Новый `page.tsx` — **серверный**
  компонент: `generateMetadata({ params })` делает лёгкий
  `fetch(`${API_URL}/orders/${params.id}`)` на сервере (Next
  server-side fetch, не через `api()` client-хелпер, у него нет
  доступа к `localStorage`), возвращает `{ title: order.title + ' — TaskHunt',
  description: order.description.slice(0, 160) }`. В теле — JSON-LD
  `<script type="application/ld+json">` со схемой `JobPosting`
  (`title`, `description`, `datePosted: createdAt`, `baseSalary` из
  `budgetMin`/`budgetMax`/`currency`) — это конкретно то, что Google
  индексирует под "Google for Jobs", реальный источник органического
  трафика для gig-платформ. Рендерит `<OrderDetailClient orderId={params.id} />`.
- То же самое для `freelancers/[id]/page.tsx` → `FreelancerProfileClient.tsx`,
  JSON-LD схема `ProfilePage`/`Person` (`name`, `description: bio`,
  `image: avatarUrl`).

### Definition of done (п.8)

- `curl` на `/orders/:id` без JS — в HTML уже есть правильный `<title>`
  и `<script type="application/ld+json">` (проверить через "view
  source", не через DevTools — там уже гидратированный DOM).
  Google's Rich Results Test (ручная проверка, не автоматизируется в
  этом раунде) — опционально, не блокер.
- Существующая интерактивность (чат, отклик, milestones) продолжает
  работать 1-в-1 после разбивки на server+client компоненты.

## 9. PDF-чеки по операциям кошелька

Новая зависимость: `pdfkit` (генерация PDF стримом, без headless-браузера).

`apps/api/src/modules/wallet/wallet.controller.ts` — новый
`GET /wallet/transactions/:entryId/receipt.pdf` (`JwtAuthGuard`):
проверить, что `LedgerEntry` принадлежит кошельку текущего юзера (иначе
403), собрать PDF в памяти (`pdfkit`, `res.setHeader('Content-Type', 'application/pdf')`,
`doc.pipe(res)`): лого/название TaskHunt, тип операции (через уже
существующий `TRANSACTION_TYPE_LABELS` — только теперь этот маппинг
нужно продублировать/вынести на бэк, сейчас он только во
фронтовом `dashboard/page.tsx:23-34`, для PDF нужен на сервере — можно
просто держать копию констант в `wallet.service.ts`, не усложнять
шарингом между фронтом и бэком ради одного маппинга), сумма, валюта,
дата, `description`, дисклеймер мелким текстом "Не является налоговым
документом" (честно, это не полноценный бухгалтерский документ).

Фронтенд: `dashboard/page.tsx`, в списке истории операций (та секция,
что раунд 12 уже добавил) — маленькая иконка-скачивание у каждой
строки. Так как эндпоинт требует `Authorization`-заголовок, простой
`<a href>` не сработает — общий хэлпер (`apps/web/src/lib/api.ts`, новая
функция `downloadFile(path, filename)`): `fetch` с токеном → `blob()` →
временная `<a>` с `URL.createObjectURL` → клик → revoke. Использовать
этот же хэлпер и для GDPR-экспорта из п.6 (не дублировать логику
скачивания дважды в одном раунде).

### Definition of done (п.9)

- Скачать чек по реальной транзакции — открывается валидный PDF с
  правильной суммой/датой.
- Попытка скачать чужой чек (чужой `entryId`) — 403, не 500.

## Итоговый Definition of done раунда

- `pnpm --filter @taskhunt/api build` и `pnpm --filter @taskhunt/api test`
  — зелёные после всех 9 пунктов.
- `pnpm --filter @taskhunt/web build` (или `tsc --noEmit` в `apps/web`)
  — чисто.
- Каждый пункт проверен живьём в браузере (Browser pane), не только
  тестами — это в первую очередь фронтенд-тяжёлый раунд.
- README-индекс (`orchestration/README.md`) и корневой `README.md`
  обновлены по факту после закрытия раунда.
