# TaskHunt — ТЗ для себя (Claude), раунд 9: мульти-чат, совместимость по тэгам, вывод по сохранённым адресам

Своя зона — всё, что требует точности (деньги, реалтайм, ломающее
изменение схемы) и весь фронтенд раунда. Gemini параллельно делает
`Order.tags` (миграция+DTO) и CRUD книги адресов
([`TZ_GEMINI_9.md`](./TZ_GEMINI_9.md)) — не трогать
`orders/dto/create-order.dto.ts` и не создавать
`wallet/payout-addresses.controller.ts` самому, дождаться его коммита
(или сделать эти куски параллельно и смёржить руками, если он ещё не
начал — проверить `git log`/`git status` перед стартом каждого блока).

## 1. Мульти-тред чат — заказчик пишет любому откликнувшемуся до принятия

Сейчас (проверено в коде): `ChatThread.orderId` — `@unique`, один тред
на заказ, создаётся только внутри `OrdersService.acceptBid()`
(`orders.service.ts:263`, `tx.chatThread.create({ data: { orderId } })`).
До принятия бида чата физически не существует. Нужно: заказчик может
открыть переписку с любым фрилансером, у которого есть отклик
(`PENDING`/`ACCEPTED`) на заказ, ещё до выбора победителя.

### Схема

`ChatThread` — заменить единственность на пару (заказ, фрилансер):

```prisma
model ChatThread {
  id           String        @id @default(uuid())
  orderId      String
  order        Order         @relation(fields: [orderId], references: [id], onDelete: Cascade)
  freelancerId String
  freelancer   User          @relation("ChatThreadFreelancer", fields: [freelancerId], references: [id])
  messages     ChatMessage[]
  createdAt    DateTime      @default(now())

  @@unique([orderId, freelancerId])
  @@map("chat_threads")
}
```

`Order.chatThread ChatThread?` → `Order.chatThreads ChatThread[]`
(была singular-связь на уникальный `orderId`, теперь их может быть
несколько). Проверить все места, где это поле читается:
- `orders.service.ts::findOne()` — `include: { chatThread: true }` →
  `chatThreads: true`, и то, что дальше строит ответ, должно отдавать
  массив (фронту нужно знать, с кем уже есть переписка).
- `packages/shared-types` — если там есть тип `Order` с полем
  `chatThread`, поправить на `chatThreads: ChatThread[]`.
- Миграция должна бэкофиллить существующие треды: для каждой
  существующей строки `ChatThread` найти `freelancerId` через
  `Order.acceptedBidId → Bid.freelancerId` (на момент раунда 9 в
  проде реальных данных нет, но пиши миграцию так, будто есть —
  `UPDATE chat_threads SET freelancer_id = ...` до `NOT NULL`).

### Сервис (`chat.service.ts`)

`getThreadAndAssertParticipant(orderId, freelancerId, userId)` —
новая сигнатура:
- Ищет `chatThread.findUnique({ where: { orderId_freelancerId: { orderId, freelancerId } } })`.
- Если треда нет — **создать лениво** при первом обращении, но только
  если `userId` — это либо клиент заказа, либо сам `freelancerId`, **и**
  у `freelancerId` есть `Bid` со статусом `PENDING`/`ACCEPTED` на этот
  заказ (иначе `ForbiddenException` — нельзя открыть чат с тем, кто не
  откликался).
- Если тред есть — проверить, что `userId` это `order.clientId` или
  `thread.freelancerId`, иначе `ForbiddenException` (как раньше).

Прокинуть `freelancerId` через все методы: `listMessages`,
`sendTextMessage`, `sendFileMessage`, `softDeleteMessage` (этот может
остаться как есть — сообщение уже привязано к треду, ищется по
`messageId`, не нужно). `createInvoiceMessage` (вызывается из
event-листенера на `InvoiceIssued`) — тоже получает `freelancerId`
(нужно прокинуть его в событие или достать из `Bid`, откуда выставлен
инвойс — посмотреть, откуда сейчас вызывается).

`acceptBid()` (`orders.service.ts:263`) — заменить
`tx.chatThread.create` на `tx.chatThread.upsert({ where: { orderId_freelancerId: { orderId, freelancerId } }, create: {...}, update: {} })`
— тред с этим фрилансером мог уже существовать из переписки до принятия.

### Контроллер + маршруты

`orders/:orderId/chat/threads` (`GET`, новый) — список тредов, видимых
текущему юзеру:
- Клиент — все треды этого заказа (с последним сообщением и
  непрочитанными), плюс список фрилансеров с активным бидом, с кем
  треда ещё нет (фронт должен уметь "начать чат" одной кнопкой).
- Фрилансер — только свой (если есть).

`orders/:orderId/chat/messages` — добавить обязательный (для клиента)
query-параметр `freelancerId`. Для фрилансера — если параметр не
передан или не совпадает с ним самим, использовать `userId` как
`freelancerId` (фрилансер физически не может читать чужой тред, значит
параметр для него избыточен, но не вреден, если передан верно).

### Gateway (`chat.gateway.ts`)

Комната `order:${orderId}` → `order:${orderId}:freelancer:${freelancerId}`.
`joinOrder` payload меняется с `orderId: string` на
`{ orderId: string; freelancerId: string }`. `sendMessage` аналогично.
Проверить, что `listMessages` (вызывается внутри `joinOrder` как
проверка прав) получает оба параметра.

### Фронтенд (`apps/web/src/app/orders/[id]/page.tsx`)

Сейчас `hasChat = Boolean(order?.chatThread ?? order?.acceptedBidId)`
— полностью переделать:
- Для клиента: у каждого отклика в секции "Отклики" — кнопка
  "Написать" рядом с суммой, открывает панель чата с этим
  `freelancerId` (state `activeChatFreelancerId`). Наверху панели чата
  — переключатель между тредами, если их несколько (список тех, с кем
  уже есть переписка).
- Для фрилансера: чат появляется, если у него есть свой `Bid`
  (`PENDING`/`ACCEPTED`) на заказ — `freelancerId` всегда `me.id`, без
  переключателя.
- Socket-эффект: re-join room при смене `activeChatFreelancerId`
  (`nextSocket.emit('joinOrder', { orderId, freelancerId })`), сброс
  `messages` при переключении треда.
- Инвойсы (`issueInvoice`) — фрилансер выставляет счёт в своём треде,
  значит на бэке `freelancerId` для инвойса всегда `me.id` со стороны
  фрилансера, ничего доп. на фронте передавать не нужно.

Проверить вживую (реальный Postgres+Redis, как раньше): два разных
браузерных контекста/токена — клиент открывает чат с двумя разными
откликнувшимися, сообщения не пересекаются между тредами.

## 2. % совместимости по тэгам в откликах

Зависит от `Order.tags` — **дождаться коммита Gemini**
([`TZ_GEMINI_9.md`](./TZ_GEMINI_9.md) п.1) или сделать миграцию самому
первым, если Gemini ещё не начал (проверить `git log`).

`matching.service.ts::rankBidsForOrder` (строка ~243) — сейчас грузит
`bids` с `include: { freelancer: { include: { profile: true, subscription: {...} } } }`
— добавить в `profile` вложенный `skills: { include: { skill: true } }`
(модель `ProfileSkill`, см. `schema.prisma:140`).

Чистая функция (по образцу существующих в файле, `clamp`/`decayScore`):

```ts
function compatibilityPercent(orderTags: string[], freelancerSkillNames: string[]): number | null {
  if (orderTags.length === 0) return null;
  const skillSet = new Set(freelancerSkillNames.map((s) => s.trim().toLowerCase()));
  const matched = orderTags.filter((t) => skillSet.has(t.trim().toLowerCase())).length;
  return Math.round((matched / orderTags.length) * 100);
}
```

Добавить `compatibilityPercent` в объект каждого кандидата в
возвращаемом массиве `rankBidsForOrder` (рядом с уже существующими
`matchScore`/`matchReasons`) — **не смешивать** с самим `matchScore`
(ранжирование по-прежнему сортирует по существующим весам из
`matching.weights.ts`, совместимость — только отображаемая метрика,
без своего веса, чтобы не переусложнять уже откалиброванный скоринг).
Юнит-тест в `matching/__tests__/matching.service.spec.ts` — заказ с
тэгами `['React','Node.js']`, фрилансер со скиллами `['React','Vue']`
→ `compatibilityPercent: 50`.

### Фронтенд

- Форма создания заказа (`dashboard/page.tsx`, секция "Создать заказ")
  — добавить поле тэгов (chip-инпут: Enter добавляет тег, клик по тегу
  удаляет; хранить как `string[]` в `orderForm.tags`).
- Карточка заказа (`dashboard/page.tsx` список, `orders/[id]/page.tsx`
  шапка) — показывать тэги как пилюли под заголовком.
- Секция "Отклики" на странице заказа — если у заказа есть `tags`,
  показывать `compatibilityPercent` бейджем рядом с суммой бида
  (например "72% совпадение", цвет по порогу: ≥70 sage, 40-70 sand,
  <40 нейтральный stone — без тревожных цветов, это не оценка "плохо",
  а просто информация).

## 3. Книга адресов вывода — фронтенд + интеграция в withdraw

Зависит от `SavedPayoutAddress` — дождаться коммита Gemini
([`TZ_GEMINI_9.md`](./TZ_GEMINI_9.md) п.2) для CRUD-эндпоинтов; сам
эндпоинт вывода — моя зона, не пересекается.

### Список сетей (заводится один раз, ~20 штук, популярные первыми)

Общий источник правды — `packages/shared-types/src/payout-networks.ts`
(и бэк через `@IsIn`, и фронт через пикер импортируют его же, не дублировать список):

```ts
export const PAYOUT_NETWORKS = [
  'TRC20', 'ERC20', 'BEP20', 'SOL', 'TON', 'BTC', 'MATIC', 'ARB', 'OP',
  'AVAX', 'BASE', 'LTC', 'DOGE', 'XRP', 'ADA', 'DOT', 'ATOM', 'NEAR',
  'ALGO', 'FTM',
] as const;
export type PayoutNetwork = (typeof PAYOUT_NETWORKS)[number];
```

Подключить `@IsIn(PAYOUT_NETWORKS)` в `POST /wallet/payout-addresses`
(мелкая правка в файле Gemini постфактум — согласовать через
`STATUS_GEMINI_9.md`, не переписывать остальной его код).

### Логотипы сетей — НЕ рисовать руками

Пакет `@web3icons/react` (MIT, npm, `packages/react`) — компонент
`<NetworkIcon network="ethereum" variant="branded" size={24} />`,
покрывает Ethereum/BNB Smart Chain/Solana/Polygon/Arbitrum/Optimism/
Base/Avalanche как минимум (подтверждено по README пакета). Поставить
`pnpm --filter @taskhunt/web add @web3icons/react`, свериться с
`docs/icons.md`/`networks.json` пакета на точные `network`-id для
каждого из 20 тикеров списка выше (Tron/TON/Bitcoin/Litecoin/Dogecoin/
XRP/Cardano/Polkadot/Cosmos/Near/Algorand/Fantom — не гарантированы
явно, проверить при интеграции). Если для конкретной сети иконки в
пакете нет — не выдумывать замену молча, взять официальный SVG из
публичного brand-kit сети (Arbitrum/Optimism/Base/TON публикуют свои)
через `WebFetch`/прямую ссылку, положить в `public/networks/`.
Обернуть иконку своим компонентом `NetworkLogo({ network })`, чтобb
переключение источника (пакет vs локальный SVG) было в одном месте, а
не размазано по вызовам.

### Компонент "Книга адресов" (`apps/web/src/components/PayoutAddressBook.tsx`)

- Список сохранённых адресов (`GET /wallet/payout-addresses`) —
  карточка на адрес: логотип сети + название/заметка + сокращённый
  адрес (`0x1234…abcd`) + бейдж "по умолчанию" + кнопки
  "Сделать основным"/"Удалить".
- Форма добавления: пикер сети (грид иконок, самые популярные —
  TRC20/ERC20/BEP20/SOL — первыми и покрупнее, остальные — под
  разворачивающимся "Показать все сети"), поле адреса, поле
  "Название/заметка" (необязательное, плейсхолдер вида "Мой основной
  Trust Wallet").

### Интеграция в вывод средств (`dashboard/page.tsx`, секция "Вывод средств")

- `WithdrawDto` на бэке (`wallet.controller.ts`) — добавить
  `savedAddressId?: string`, `network?: string`, `saveAddress?: boolean`,
  `label?: string`, сделать `payoutAddress` опциональным. Валидация в
  контроллере (не в DTO-декораторах — это межполевая логика): должен
  быть ровно один из `savedAddressId`/`payoutAddress`, иначе
  `BadRequestException`. Если `savedAddressId` — подставить адрес из
  БД (проверить владение), обновить `lastUsedAt`. Если `payoutAddress`
  + `saveAddress: true` — создать `SavedPayoutAddress` **до**
  постановки job в очередь (чтобы адрес сохранился даже если сам вывод
  зафейлится и откатится рефандом — это два независимых события).
- Форма на фронте: по умолчанию — выпадающий список сохранённых
  адресов (если есть хоть один, самый очевидный/дефолтный — уже
  выбран, вывод в 1-2 клика без ввода чего-либо). Ссылка/кнопка
  "Новый адрес" разворачивает поля сеть+адрес+заметка и чекбокс
  "Сохранить для следующего раза" (включен по умолчанию).

### Definition of done (весь раунд, моя часть)

- Два реальных браузерных контекста подтверждают изоляцию тредов
  чата (см. выше).
- `pnpm --filter @taskhunt/api test` и `build` зелёные после слияния
  своих правок с правками Gemini.
- `pnpm --filter @taskhunt/web exec tsc --noEmit` и `next build` чистые.
- Живой e2e-прогон вывода: сохранить адрес → вывести на него без
  повторного ввода → баланс/lastUsedAt обновились.
- `docs/PRODUCTION_READINESS.md` и `orchestration/README.md` обновлены
  по итогу раунда.
