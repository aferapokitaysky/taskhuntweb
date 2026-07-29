# TaskHunt — ТЗ для Gemini, раунд 14: новые бэкенд-фичи (без пересечений с моим фронтом)

12 независимых кусков, весь бэкенд. Я в этом раунде (`TZ_CLAUDE_14.md`)
в основном на фронте — закрываю долг раунда 13 (фичи, которые ты уже
сдал, но под них нет UI) плюс новый UI/UX-пакет, с точечными правками
своих же файлов (`orders.service.ts::findFreelancers`/`getMe` — по
мелочи, не пересекается с тем, что ты трогаешь ниже).

**Перед стартом**: `git pull`/`git status`.

## 1. Сертификация навыков (мини-тест)

Реальный дифференциатор для маркетплейса — фрилансер может подтвердить
навык коротким тестом, а не просто вписать его в профиль.

```prisma
model SkillQuiz {
  id        String       @id @default(uuid())
  skillId   String
  skill     Skill        @relation(fields: [skillId], references: [id], onDelete: Cascade)
  question  String
  options   String[]
  correctIndex Int
  createdAt DateTime     @default(now())

  @@map("skill_quizzes")
}

model SkillCertification {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  skillId   String
  skill     Skill    @relation(fields: [skillId], references: [id], onDelete: Cascade)
  score     Int      // % правильных ответов
  passedAt  DateTime @default(now())

  @@unique([userId, skillId])
  @@map("skill_certifications")
}
```

- `POST /admin/skills/:id/quiz-questions` (`CatalogManage`) — добавить
  вопрос (5 вопросов на навык достаточно для MVP, лимит не enforce'ить
  жёстко, просто не городить пагинацию ради 5 записей).
- `GET /skills/:id/quiz` (`JwtAuthGuard`) — вернуть вопросы **без**
  `correctIndex` (не палить ответы в ответе API).
- `POST /skills/:id/quiz/submit` — body `{answers: number[]}` (индексы
  по порядку вопросов), посчитать `score`, если `>= 80` — создать/
  обновить `SkillCertification` (upsert по `[userId, skillId]`,
  затирает предыдущую попытку новым результатом). Если у навыка нет ни
  одного вопроса — 400 "Тест ещё не готов".
- `getPublicProfile`/`findFreelancers` (в `users.service.ts` — не
  переписывай эти методы, я их тоже трогаю в этом раунде по мелочи,
  добавляй свои поля рядом, не удаляя моих) — добавить к каждому
  навыку `certified: boolean` (есть ли `SkillCertification` с этим
  `skillId`).

### Definition of done (п.1)

- Пройти тест с 100% и с 40% — сертификация создаётся только при ≥80%.
- Повторное прохождение — обновляет `score`, не дублирует запись.

## 2. Доказательства по спору (файлы)

Сейчас `Dispute.reason` — просто текст, ни клиент, ни фрилансер не
может приложить скриншот/файл в подтверждение своей стороны.

```prisma
model DisputeFile {
  disputeId String
  fileId    String
  dispute   Dispute   @relation(fields: [disputeId], references: [id], onDelete: Cascade)
  file      FileAsset @relation(fields: [fileId], references: [id])

  @@id([disputeId, fileId])
  @@map("dispute_files")
}
```

Паттерн 1-в-1 с `DeliveryFile` (`schema.prisma:767`) — файлы уже
загружаются через существующий `POST /files/upload` (используй как
есть, не переизобретай загрузку). `POST /orders/:id/disputes/:disputeId/attach`
body `{fileId}` — только участник спора (`openedById` или сторона
заказа), проверить, что `FileAsset.scanStatus === 'CLEAN'` (не
прикладывать непроверенные антивирусом файлы). `GET /orders/:id`
(в существующем `include` для `disputes`, `orders.service.ts::findOne`
— **не трогай**, это мой файл в этом раунде; вместо этого сделай
отдельный `GET /disputes/:id/files`).

## 3. Запрос на продление дедлайна

Фрилансер видит, что не успевает — сейчас единственный вариант молчать
до дедлайна. Простой флоу запрос/ответ:

```prisma
model DeadlineExtensionRequest {
  id          String   @id @default(uuid())
  orderId     String
  order       Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)
  requestedBy String
  newDeadline DateTime
  reason      String?
  status      String   @default("PENDING") // PENDING | APPROVED | DECLINED
  createdAt   DateTime @default(now())

  @@map("deadline_extension_requests")
}
```

- `POST /orders/:id/deadline-extension` (фрилансер, только на своих
  активных заказах, `IN_PROGRESS`) — body `{newDeadline, reason?}`.
- `POST /orders/:id/deadline-extension/:requestId/respond` (клиент) —
  body `{approve: boolean}`, при `approve: true` — обновить
  `order.deadline` на `newDeadline` (в транзакции с обновлением статуса
  запроса).
- Уведомление обеим сторонам через `eventBus.publish` — добавь новый
  `DomainEventName.DeadlineExtensionRequested`/`...Responded` в
  `packages/shared-types/src/events.ts` (я там уже добавлял
  `OrderInviteCreated` в прошлом раунде — просто дописывай рядом по
  тому же паттерну, не переписывай файл) + обработчик в
  `apps/notifications-service/src/handlers/orders.ts`.

## 4. Планировщик recurring-заказов

Заказчик, который регулярно публикует однотипные заказы (например,
еженедельный контент), сейчас должен создавать их вручную каждый раз.

```prisma
model OrderTemplate {
  id           String    @id @default(uuid())
  clientId     String
  client       User      @relation(fields: [clientId], references: [id], onDelete: Cascade)
  categoryId   String
  title        String
  description  String
  budgetMin    Decimal   @db.Decimal(12, 2)
  budgetMax    Decimal?  @db.Decimal(12, 2)
  tags         String[]  @default([])
  frequency    String    // WEEKLY | MONTHLY
  nextRunAt    DateTime
  active       Boolean   @default(true)
  createdAt    DateTime  @default(now())

  @@map("order_templates")
}
```

CRUD `POST/GET/PATCH/DELETE /users/me/order-templates` (мирроринг
`BidTemplate` из раунда 13 — тот же паттерн, я его писал в
`users.service.ts`, посмотри для консистентности стиля, только это
отдельная новая модель, не путай с моим `BidTemplate`). BullMQ
repeatable job (раз в час, паттерн `subscription-expiration.processor.ts`)
— находит шаблоны с `active: true`, `nextRunAt <= now`, создаёт из них
реальный `Order` (`status: 'OPEN'`) через уже существующий
`OrdersService.create`-подобную логику (можно напрямую `prisma.order.create`,
не обязательно проходить через лимиты подписки — это осознанное
решение владельца шаблона, не обходить проверку тарифа: если у
клиента нет мест по тарифу в этом месяце — просто пропустить создание
этого раза, залогировать, не крашить джобу), сдвигает `nextRunAt` на
следующий период.

## 5. Расширенная лента фрод-флагов для админки

`GET /admin/fraud-flags` уже есть (список), но без пагинации — при
росте объёма это будет тормозить. `AdminService`/`FraudService` (тот,
что уже используется в `admin.controller.ts`) — добавить курсорную
пагинацию (тот же паттерн, что у меня в `WalletService.getTransactionHistory`,
раунд 13 — `take: limit+1`, `cursor`), плюс фильтр по `userId` (найти
все флаги конкретного юзера с одной ссылки в админке).

## 6. "Тренды поиска" по категориям

Простая агрегация: какие теги/поисковые запросы чаще всего искали за
последние 7 дней. Если `SearchService`/`OrdersService.findMany` сейчас
не логирует запросы — добавь минимальную модель:

```prisma
model SearchLog {
  id        String   @id @default(uuid())
  query     String
  createdAt DateTime @default(now())

  @@index([createdAt])
  @@map("search_logs")
}
```

Пиши по одной строке на каждый непустой `search`/`q` в `GET /search`
(`search.service.ts`) — fire-and-forget, не блокировать сам ответ поиска
(`.catch(() => undefined)` на запись лога, если БД недоступна — поиск
всё равно должен отработать). `GET /search/trending` — `groupBy` по
`query` (lowercase, trim) за последние 7 дней, топ-10 по частоте.

## 7. Отклонение отклика с причиной

Сейчас `acceptBid` переводит остальные `PENDING`-бид в `REJECTED`
автоматически (пакетно, без причины) — фрилансер не узнаёт, почему
именно его не выбрали. Добавь **опциональную** ручную причину:
`POST /orders/:id/bids/:bidId/reject` (клиент, до принятия чужого бида)
— body `{reason?: string}`, переводит конкретный бид в `REJECTED` с
`rejectionReason`, уведомление фрилансеру с текстом причины, если она
была указана. `Bid.rejectionReason String?` — новое поле.

## 8. Клиентские "чёрные списки" исполнителей

Заказчик хочет заблокировать конкретного фрилансера от откликов на
свои будущие заказы (был негативный опыт, спам-отклики и т.п.).

```prisma
model ClientBlock {
  id           String   @id @default(uuid())
  clientId     String
  client       User     @relation("ClientBlockOwner", fields: [clientId], references: [id], onDelete: Cascade)
  freelancerId String
  freelancer   User     @relation("ClientBlockTarget", fields: [freelancerId], references: [id], onDelete: Cascade)
  createdAt    DateTime @default(now())

  @@unique([clientId, freelancerId])
  @@map("client_blocks")
}
```

`POST/DELETE /users/me/blocks/:freelancerId`, `GET /users/me/blocks`.
`OrdersService.submitBid` (мой файл — **не редактируй**, вместо этого
добавь проверку в отдельном месте: `CreateBidDto`/guard, или, раз
метод мой, опиши точно нужную проверку здесь текстом, я добавлю сам за
одну строку в этом же раунде): если `ClientBlock` существует между
`order.clientId` и `freelancerId` — 403 "Вы не можете откликаться на
заказы этого клиента".

## 9. Экспорт счетов заказа (все инвойсы одним PDF/CSV)

У заказа может быть несколько `Invoice` (по каждому милстоуну). Сейчас
посмотреть их все разом негде. `GET /orders/:id/invoices/export.csv`
(клиент или принятый фрилансер) — CSV со всеми `Invoice` этого заказа
(дата, сумма, статус, milestone). Формат/эскейпинг — 1-в-1 с моим
`WalletService.exportTransactionHistoryCsv` (раунд 13, посмотри для
консистентности, но это отдельный метод в `InvoiceService`, не трогай
`wallet.service.ts`).

## 10. Уведомление о скором дедлайне

`ExpiredOrdersProcessor` у тебя уже есть с прошлого раунда (архивация
заказов без откликов) — добавь рядом (или отдельным processor'ом в том
же файле/модуле, где логичнее по коду) ежедневную джобу: заказы в
`IN_PROGRESS` с `deadline` через 24–48 часов — уведомление принятому
фрилансеру "Дедлайн через N часов". Не слать повторно за один и тот же
заказ дважды — простейший вариант, поле `Order.deadlineWarningSentAt DateTime?`,
проставляется при отправке, джоба фильтрует `deadlineWarningSentAt: null`.

## 11. Групповые операции в админке (bulk-бан спам-аккаунтов)

`POST /admin/users/bulk-suspend` (`RequirePermissions` — та же, что уже
стоит на существующем одиночном suspend-эндпоинте, найди её в
`admin.controller.ts`) — body `{userIds: string[], reason: string}`,
переводит статус в `SUSPENDED` пачкой, один `AuditLog`-запись на всю
пачку (не по одной на юзера — иначе лог захламляется), не на себя
самого/других staff (защита от случайного самобана).

## 12. Recovery-флоу для 2FA (админ-ассистированный)

Я в прошлом раунде добавил 2FA/backup-коды (`auth.service.ts`) — если
юзер потерял и телефон, и все 10 backup-кодов, сейчас у него нет пути
назад, кроме прямого доступа к БД. `POST /admin/users/:id/reset-2fa`
(`RequirePermissions` — новый код пермишена или существующий
`UserManage`, посмотри, что уже используется на других
user-management эндпоинтах в `admin.controller.ts`) — сбрасывает
`totpSecret`/`totpEnabled`/удаляет `TotpBackupCode` (те же поля/модель,
что я завёл в раунде 13 — только читай их, схему не трогай). Обязательно
`AuditLog` (это чувствительное действие — кто, когда, у кого сбросил
2FA, стандартный трейл для такого рода вмешательств).

### Definition of done (п.12)

- После сброса юзер логинится обычным паролем без запроса кода (пока
  не включит 2FA заново).

## Итоговый Definition of done раунда

- `pnpm --filter @taskhunt/api test` и `build` — зелёные после всех
  12 пунктов.
- Новые модели — через `prisma migrate dev`, миграции закоммичены.
- Отчитайся в `STATUS_GEMINI_14.md` по каждому пункту — если что-то
  требует правки в `orders.service.ts`/`users.service.ts` напрямую
  (мои файлы в этом раунде) — не трогай, опиши точно нужное изменение
  в разделе "Вопросы к оркестратору", я добавлю сам.
