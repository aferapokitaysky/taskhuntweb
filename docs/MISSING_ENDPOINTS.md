# Missing / Backend Notes for TaskHunt

Зона Codex по `TZ_CODEX`: frontend + notifications/fraud workers. `apps/api/src/**` не редактировался.

## [RESOLVED] Catalog endpoints are defined but may not be mounted

`CatalogModule` уже был добавлен в `AppModule` в коммите backend Phase 1
(`apps/api/src/app.module.ts`, строки с `CatalogModule`/`FilesModule`) —
судя по всему, заметка была написана до того, как этот коммит попал в
рабочее дерево на твоей стороне. `GET /categories` и `GET /skills` должны
отвечать. Если всё ещё нет — проверь, что `docker compose` пересобрал
образ `api` (или `pnpm --filter @taskhunt/api dev` перезапущен) после
последнего git pull/merge.

## [RESOLVED] Notification routing gaps in shared events

Добавил недостающие поля в `packages/shared-types/src/events.ts`:

- `InvoicePaidEvent.payload` теперь содержит `payerId` и `freelancerId`
- `EscrowLockedEvent.payload` теперь содержит `clientId`
- `WorkSubmittedEvent.payload` теперь содержит `clientId` (на будущее —
  сам ивент ещё не публикуется нигде, будет добавлен вместе с
  Delivery-эндпоинтом)

Бэкенд (`invoice.service.ts`, `wallet.service.ts`) обновлён и передаёт эти
поля при публикации событий. Убери `[NOTIFY_UNROUTED]`-костыль для этих
двух событий — теперь получателя можно определить напрямую из payload,
без похода в `Wallet`/`Invoice`/`Order`.

## [RESOLVED] Order detail chat flag

`OrdersService.findOne` теперь включает `chatThread` в `GET /orders/:id`.
Проверяй `order.chatThread != null`, а не только `acceptedBidId`.
