# Статус: Gemini — раунд 5 (монетизация — бэкенд-логика)

Дописывай секции по ходу работы, не перезаписывай файл целиком.

Задание целиком — [`TZ_GEMINI_5.md`](./TZ_GEMINI_5.md). Бизнес-модель —
[`docs/MONETIZATION.md`](../docs/MONETIZATION.md).

## TODO

- [x] Комиссия за вывод средств (WITHDRAWAL_FEE реально удерживается)
- [x] Тесты на комиссию за вывод
- [x] Комиссия по тиру подписки в releaseEscrow (вместо плоской ставки)
- [x] Лимиты на отклики/заказы по тиру
- [x] Тесты на лимиты (+ проверка, что старые orders-тесты не сломались)
- [x] Сортировка GET /orders с учётом Promotion + поле isPromoted
- [x] Фоновая джоба экспирации подписок (BullMQ repeatable)
- [x] Событие SubscriptionExpiringSoon в shared-types
- [x] `pnpm --filter @taskhunt/api test` — зелёное (61/61)
- [x] `pnpm --filter @taskhunt/api build` — чисто

## В процессе

- Все бэкенд задачи Раунда 5 по монетизации полностью выполнены и протестированы. Детали в [`gemini_conv_5.md`](./gemini_conv_5.md).

## Готово

- [x] `WalletService.requestWithdrawal()` удерживает комиссию `WITHDRAWAL_FEE` (1% дефолт), формируя 3 сбалансированные проводки. `PayoutProcessor` выплачивает чистую сумму `netAmount = amount - fee`, а при отказе возвращает пользователю полные `amount`.
- [x] `WalletService.releaseEscrow()` считывает комиссию из активной подписки фрилансера (`tier.commissionPercent`), если у фрилансера есть `ACTIVE` подписка.
- [x] `OrdersService` контролирует лимиты заказов/откликов в текущем календарном месяце (`maxActiveBidsPerMonth` и `maxActiveOrdersPerMonth`) с выбросом `BadRequestException`.
- [x] `GET /orders` размечает продвинутые заказы бейджем `isPromoted: boolean` и ставит их в самое начало списка.
- [x] Добавлено событие `SubscriptionExpiringSoon` в `@taskhunt/shared-types`.
- [x] Реализована регулярная BullMQ джоба `SubscriptionExpirationProcessor` в `SubscriptionsModule` для автоматического перевода истёкших подписок в статус `EXPIRED` и рассылки уведомлений за 3 дня до истечения.
- [x] Успешно пройдены 61/61 юнит-тестов и проверена сборка `@taskhunt/api`.

## Вопросы к оркестратору / нужны правки в чужих файлах

1. Вопросов нет, весь бэкенд блок монетизации готов к мержу.

## Ответы оркестратора

_(сюда Claude пишет ответы/решения по вопросам выше)_
