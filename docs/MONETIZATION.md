# TaskHunt — монетизация

Приоритеты по запросу пользователя:

| Источник | Приоритет | Статус |
|---|---|---|
| Комиссия со сделки | ⭐⭐⭐⭐⭐ | Есть (`MARKETPLACE_FEE`, дефолт 10%) |
| Продвижение услуг и заказов | ⭐⭐⭐⭐⭐ | Нет — проектируем ниже |
| Pro-подписка | ⭐⭐⭐⭐☆ | Нет — проектируем ниже |
| Комиссия за вывод средств | ⭐⭐⭐⭐☆ | **Наполовину есть** — `WITHDRAWAL_FEE` (1%) засеян в БД ещё в Phase 1, но нигде не применяется. `PayoutProcessor` списывает 100% суммы без вычета комиссии. Это баг, не фича — чинится первым. |
| White Label | ⭐⭐⭐⭐☆ | Phase 3, не трогаем в этом раунде |
| API для партнёров | не оценено | Phase 3, не трогаем в этом раунде |

## 1. Тарифы (подписка)

Три тира, конфигурируемые из БД (не хардкод в коде — по аналогии с
`CommissionRule`), чтобить можно было менять цены/лимиты без деплоя.

| | **Starter** (бесплатно, дефолт) | **Pro** | **Premium** |
|---|---|---|---|
| Цена | $0 | $9.99/мес | $29.99/мес |
| Комиссия с сделки | 10% (текущий дефолт) | 7% | 5% |
| Активных откликов/заказов в месяц | 10 откликов (фрилансер) / 5 заказов (клиент) | 50 / 20 | Без лимита |
| Продвижение (boost) в комплекте | — | 1 буст/мес | 5 бустов/мес |
| Приоритет в поддержке | обычный | HIGH | URGENT |
| Бейдж в профиле | — | "Pro" | "Premium" |

Оплата подписки — как обычный инвойс через уже существующую
NOWPayments-интеграцию (`InvoiceService`/`NowPaymentsService`), просто
с `referenceType: 'SUBSCRIPTION'` вместо заказа. Продление — по крону,
подписка не продлевается автоматически сама по себе (нет сохранённого
способа оплаты для автосписания в крипте) — за 3 дня до истечения шлём
уведомление "продлите подписку", по истечении — тихий откат на Starter.

## 2. Продвижение (promotion / boost)

Разовая платная опция, доступна всем тирам (Pro/Premium получают
бесплатную квоту в месяц, см. таблицу выше).

| Что продвигаем | Эффект | Срок | Цена (если не из квоты) |
|---|---|---|---|
| Заказ (`Order`) | Поднимается в верх списка своей категории, визуальный бейдж "Продвигается" (SVG-иконка, не эмодзи) | 7 дней | $5 |
| Профиль фрилансера | Выше в поиске/списке фрилансеров категории | 30 дней | $10 |

## 3. Комиссия за вывод — доделать (P0, баг)

`WITHDRAWAL_FEE` (1%, засеяно) не применяется нигде. Нужно: при
создании `WITHDRAWAL`-транзакции удерживать комиссию отдельной проводкой
(`CREDIT system.MAIN` на сумму комиссии), пользователь получает
`amount - fee`, а не `amount`. Правится в
`WalletService.requestWithdrawal()`/`PayoutProcessor` — территория
Gemini (они там уже были в раунде 4).

## 4. Схема БД (новые модели)

```prisma
enum SubscriptionTierName {
  STARTER
  PRO
  PREMIUM
}

// Конфигурация тиров — редактируется из админки, не хардкод
model SubscriptionTier {
  id                    String               @id @default(uuid())
  name                  SubscriptionTierName @unique
  priceUsd              Decimal              @db.Decimal(8, 2)
  commissionPercent     Decimal              @db.Decimal(5, 2)
  maxActiveBidsPerMonth Int?                 // null = без лимита
  maxActiveOrdersPerMonth Int?
  freeBoostsPerMonth    Int                  @default(0)
  supportPriority       TicketPriority       @default(NORMAL)
  subscriptions         Subscription[]
}

enum SubscriptionStatus {
  ACTIVE
  EXPIRED
  CANCELLED
}

model Subscription {
  id          String             @id @default(uuid())
  userId      String             @unique // одна активная подписка на пользователя
  user        User               @relation(fields: [userId], references: [id])
  tierId      String
  tier        SubscriptionTier   @relation(fields: [tierId], references: [id])
  status      SubscriptionStatus @default(ACTIVE)
  startedAt   DateTime           @default(now())
  expiresAt   DateTime
  invoiceId   String?            // инвойс, которым оплачена
}

enum PromotedEntityType {
  ORDER
  PROFILE
}

model Promotion {
  id           String             @id @default(uuid())
  entityType   PromotedEntityType
  entityId     String             // orderId или profileId, без FK (полиморфно)
  purchasedById String
  startedAt    DateTime           @default(now())
  expiresAt    DateTime
  amountUsd    Decimal?           @db.Decimal(8, 2) // null, если списано из бесплатной квоты
  invoiceId    String?

  @@index([entityType, entityId])
}
```

`User.roles`/лимиты: у пользователя без активной `Subscription` —
эффективный тир `STARTER` (не создаём отдельную запись на каждого,
просто дефолт в коде, если `Subscription` не найдена или `status !=
ACTIVE`).

## 5. Разбивка на раунд 5 — 50/50

**Я (Claude): фронтенд + часть бэка**
- Схема (models выше) + миграция — делаю сам, т.к. это пересекается со
  всеми модулями сразу, лучше не дробить между двумя людьми одну миграцию
- `POST /subscriptions/checkout` (создать инвойс на апгрейд тира,
  переиспользуя `InvoiceService`) + `GET /subscriptions/me`
- `POST /promotions/checkout` (буст заказа/профиля — из квоты или за
  деньги) + `GET /promotions/active?entityType=&entityId=`
- Frontend: страница тарифов (`/pricing`) с сравнением, кнопка "Купить
  буст" на странице заказа и в профиле, бейджи Pro/Premium/Продвигается
  (снова кастомные SVG, без эмодзи)
- Довожу до конца отложенные P1 (вывод средств UI, профиль, поддержка)

**Gemini: только бэк** — см. [`orchestration/TZ_GEMINI_5.md`](../orchestration/TZ_GEMINI_5.md)
- Комиссия за вывод (доделать баг, P0)
- Применение `commissionPercent` тира вместо плоского `MARKETPLACE_FEE`
  при релизе эскроу (если у фрилансера/клиента есть активная подписка)
- Enforcement лимитов (`maxActiveBidsPerMonth`/`maxActiveOrdersPerMonth`)
  при создании отклика/заказа
- Сортировка `GET /orders` с учётом активных `Promotion` (продвинутые —
  выше)
- Фоновая джоба (BullMQ repeatable): подписки с истёкшим `expiresAt` →
  `status: EXPIRED`, уведомление за 3 дня до истечения
