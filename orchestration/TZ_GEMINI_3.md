# TaskHunt — ТЗ для Gemini, раунд 3: тесты OrdersService/AdminService + реальный email

Codex вышел из проекта — теперь над TaskHunt работают только Claude
(оркестратор) и ты. Оркестратор в этом заходе берёт на себя весь
оставшийся фронтенд (milestones/delivery/reviews UI, файловый аплоад —
наследие Codex). Твоя зона — снова бэкенд, чтобы физически не
пересекаться на файлах.

Прочитай `git log --oneline -20` перед стартом. С прошлого раза (round 2)
добавились: `apps/api/src/modules/orders/__tests__/milestones.service.spec.ts`
(тесты на приёмку работы/релиз эскроу — используй как образец паттерна
для этого захода), OAuth-кнопки и `oauth/callback` на фронте,
`notifications-service`/`fraud-service` теперь тоже в `main`.

## 1. Тесты на `OrdersService`

Файл: `apps/api/src/modules/orders/__tests__/orders.service.spec.ts`.
Мокай `PrismaService` и `EventBusService` через `jest.fn()`, ровно как в
`milestones.service.spec.ts` и `wallet.service.spec.ts` (смотри их перед
стартом — паттерн должен быть один и тот же во всех тестах проекта).

Обязательные кейсы (`apps/api/src/modules/orders/orders.service.ts`):

- `update()`: запрещает редактировать чужой заказ (`ForbiddenException`)
- `update()`: запрещает редактировать заказ не в статусе `OPEN`/`DRAFT`
  (`BadRequestException`) — например, если уже `IN_PROGRESS`
- `submitBid()`: запрещает отклик на не-`OPEN` заказ
- `submitBid()`: запрещает клиенту откликнуться на свой же заказ
- `acceptBid()`: **самое важное** — при принятии одного отклика все
  остальные `PENDING`-отклики того же заказа переводятся в `REJECTED`,
  создаётся `chatThread`, заказ переходит в `IN_PROGRESS`, публикуется
  событие `BidAccepted`
- `acceptBid()`: запрещает принять отклик на уже не-`OPEN` заказ
- `openDispute()`: запрещает открыть спор не участнику заказа (ни
  клиент, ни принятый фрилансер)
- `openDispute()`: у участника (клиент или принятый фрилансер) —
  создаёт `Dispute`, переводит заказ в `DISPUTED`, публикует
  `DisputeOpened`

## 2. Тесты на `AdminService.resolveDispute()`

Файл: `apps/api/src/modules/admin/__tests__/admin.service.spec.ts`.

Это тоже денежный путь (наравне с `MilestonesService.approve()`) — спор
разрешается либо в пользу фрilансера (`releaseEscrow`), либо в пользу
клиента (`refundEscrow`). Мокай `WalletService` целиком (`jest.fn()` на
`releaseEscrow`/`refundEscrow`), не нужно мокать `LedgerService` отдельно.

Обязательные кейсы (`apps/api/src/modules/admin/admin.service.ts`,
метод `resolveDispute`):

- бросает `BadRequestException`, если нет оплаченного (`PAID`) инвойса
  по заказу — `walletService` при этом вообще не должен вызываться
- `resolution: 'RESOLVED_FREELANCER'` → вызывает `releaseEscrow` с
  правильными `clientWalletId`/`freelancerWalletId`/`amount`, НЕ вызывает
  `refundEscrow`
- `resolution: 'RESOLVED_CLIENT'` → вызывает `refundEscrow`, НЕ вызывает
  `releaseEscrow`
- после любого разрешения — `dispute.status` обновляется на переданный
  `resolution`, `resolvedAt` проставляется

## 3. Реальная отправка email в `notifications-service`

Сейчас `apps/notifications-service/src/senders/console-sender.ts` — это
единственная реализация `NotificationSender`, просто логирует в консоль
(см. интерфейс в этом же файле). Задача — добавить вторую реализацию,
которая реально шлёт email, и переключаться между ними по наличию ключа.

Создай `apps/notifications-service/src/senders/email-sender.ts`:

```ts
import { Resend } from 'resend'; // добавь зависимость resend в package.json
import type { NotificationChannel, NotificationPayload, NotificationSender } from './console-sender';
import type { PrismaClient } from '../../generated/prisma-client';

export class EmailNotificationSender implements NotificationSender {
  private resend: Resend;

  constructor(
    private readonly prisma: PrismaClient,
    apiKey: string,
    private readonly fromAddress: string,
  ) {
    this.resend = new Resend(apiKey);
  }

  async send(userId: string, channel: NotificationChannel, payload: NotificationPayload): Promise<void> {
    if (channel !== 'EMAIL') return; // остальные каналы (PUSH/TELEGRAM/SMS) — не эта реализация

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.email) return;

    await this.resend.emails.send({
      from: this.fromAddress,
      to: user.email,
      subject: payload.title,
      text: payload.message,
    });
  }
}
```

(Не копируй один в один — это набросок структуры, адаптируй под реальный
SDK `resend`, проверь актуальную сигнатуру `emails.send`.)

В `apps/notifications-service/src/main.ts` — если задан `RESEND_API_KEY`
в env, использовать `EmailNotificationSender`, иначе (локальная
разработка без ключа) — падать обратно на `ConsoleNotificationSender`,
как сейчас. Не должно быть падения процесса при отсутствии ключа — это
must have, точно так же, как OAuth-стратегии на бэке не роняют
приложение без `GOOGLE_CLIENT_ID` (см. `apps/api/src/modules/auth/strategies/google.strategy.ts`
для примера паттерна "safe fallback").

Добавь `RESEND_API_KEY` и `RESEND_FROM_ADDRESS` в
`apps/notifications-service/.env.example`.

**Про множественные каналы (PUSH/TELEGRAM/SMS) — не делай.** Это Phase 3,
не входит в задачу. `EmailNotificationSender` должен просто игнорировать
(`return`) любой `channel !== 'EMAIL'`, чтобы не было иллюзии, что
push/telegram тоже работают.

## Definition of done

- [ ] `pnpm --filter @taskhunt/api test` — все тесты (старые + новые)
      зелёные
- [ ] `pnpm --filter @taskhunt/api build` — чисто
- [ ] `pnpm --filter notifications-service build` (или как называется
      скрипт в его `package.json` — проверь) — чисто
- [ ] Ручная проверка: без `RESEND_API_KEY` в env воркер стартует и
      логирует в консоль как раньше (не падает)
- [ ] `STATUS_GEMINI_3.md` заполнен

## Как отчитываться

[`STATUS_GEMINI_3.md`](./STATUS_GEMINI_3.md) — дописывай секции, не
перезаписывай файл целиком.
