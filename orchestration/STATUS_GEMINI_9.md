# STATUS — Gemini, раунд 9

## TODO

- [x] `Order.tags` в `schema.prisma` + миграция
- [x] DTO `CreateOrderDto.tags` + проверка в `OrdersService`
- [x] Модель `SavedPayoutAddress` в `schema.prisma`
- [x] `PayoutAddressesService` и `PayoutAddressesController`
- [x] `GET /wallet/payout-addresses`
- [x] `POST /wallet/payout-addresses` (дубликат -> `ConflictException`, первый адрес -> `isDefault: true`)
- [x] `PATCH /wallet/payout-addresses/:id` (смена дефолта в транзакции)
- [x] `DELETE /wallet/payout-addresses/:id` (перенос дефолта)
- [x] Юнит-тесты на DTO и сервис адресов вывода
- [x] `pnpm --filter @taskhunt/api test` — зелёное (114/114)
- [x] `pnpm --filter @taskhunt/api build` — чисто

## В процессе

- Все задачи Раунда 9 полностью выполнены и проверены. Детали в [`gemini_conv_9.md`](./gemini_conv_9.md).

## Готово

- [x] **Тэги заказа `Order.tags`**: Добавлено поле `tags String[] @default([])` в схему, миграция сгенерирована, `CreateOrderDto` расширен валидатором массива строк.
- [x] **Книга адресов вывода `SavedPayoutAddress`**: Модель создана в схеме. Реализован `PayoutAddressesService` и `PayoutAddressesController` отдельными файлами без пересечения с денежной логикой.
- [x] **CRUD Адресов**:
  - `GET /wallet/payout-addresses` (сортировка по дефолту и датам).
  - `POST /wallet/payout-addresses` (авто-дефолт для первого адреса, `ConflictException` при повторном сохранении пары сеть+адрес).
  - `PATCH /wallet/payout-addresses/:id` (транзакционный сброс остальных дефолтов при `isDefault: true`).
  - `DELETE /wallet/payout-addresses/:id` (авто-перенос дефолта на более свежий адрес при удалении дефолтного).
- [x] **Тестирование**: Добавлены юнит-тесты в `payout-addresses.service.spec.ts` и `orders.service.spec.ts`. Все 114/114 тестов прошëли успешно (17 сьютов), сборка бэкенда компилируется без ошибок.

## Вопросы к оркестратору / нужны правки в чужих файлах

1. Вопросов нет, бэкенд Раунда 9 полностью готов.

## Ответы оркестратора

_(оркестратор отвечает здесь)_
