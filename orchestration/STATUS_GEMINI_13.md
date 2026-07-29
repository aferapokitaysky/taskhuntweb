# STATUS — Gemini, раунд 13

## TODO

- [x] 1. Расчёт статистик фрилансера (`successRate`, `completionRate`, `avgResponseMins`, `disputesCount`, `lateDeliveries`)
- [x] 2. Отпускной режим фрилансера (`vacationUntil`) + исключение в `findFreelancers`/`recommendFreelancersForOrder`
- [x] 3. "Нанять снова" (`listPreviousFreelancers`, `GET /users/me/previous-freelancers`)
- [x] 4. Клонирование заказа (`cloneOrder`, `POST /orders/:id/clone`)
- [x] 5. Подтверждение навыков (`SkillEndorsement`, `POST /orders/:id/endorse`, `endorsementCount`)
- [x] 6. Admin слияние навыков (`POST /admin/skills/:id/merge-into/:targetId`)
- [x] 7. Автоархивация заказов (`OrderStatus.EXPIRED`, BullMQ job)
- [x] 8. Дайджест уведомлений (`DigestFrequency`, `PATCH /notifications/preferences/digest`, BullMQ job)
- [x] 9. Автовывод средств (`autoWithdrawThreshold`, `PATCH /wallet/auto-withdraw`, BullMQ job)
- [x] 10. Rate limit по тиру подписки (`SubscriptionAwareThrottlerGuard`)
- [x] 11. Похожие заказы (`GET /orders/:id/similar`)
- [x] 12. Бейдж "Проверенный плательщик" (`verifiedPayer` у клиента)
- [x] 13. CSV-экспорт транзакций (`GET /wallet/transactions/export.csv`)
- [x] `pnpm --filter @taskhunt/api test` — зелёное
- [x] `pnpm --filter @taskhunt/api build` — чисто

## В процессе

- Все задачи выполнены.

## Готово

- ✅ **п.1 (Статистики фрилансера)**: реализован расчёт по формулам, вызовы добавлены на события создания бида, принятия бида, открытия спора, сдачи и одобрения милстоунов. Написаны юнит-тесты.
- ✅ **п.2 (Отпускной режим)**: добавлено `Profile.vacationUntil`, фильтрация в `findFreelancers` и `recommendFreelancersForOrder`.
- ✅ **п.3 (Нанять снова)**: добавлены `listPreviousFreelancers` и эндпоинт `GET /users/me/previous-freelancers`.
- ✅ **п.4 (Клонирование заказа)**: создаётся клон заказа в статусе `DRAFT` со сбросом `deadline`. Эндпоинт `POST /orders/:id/clone`.
- ✅ **п.5 (Skill Endorsements)**: создана модель `SkillEndorsement`, эндпоинт `POST /orders/:id/endorse`, агрегация `endorsementCount` на навыках.
- ✅ **п.6 (Слияние навыков в админке)**: реализован метод `AdminService.mergeSkill` и роут `POST /admin/skills/:id/merge-into/:targetId` в транзакции.
- ✅ **п.7 (Автоархивация)**: добавлен статус `EXPIRED` и BullMQ джоба `ExpiredOrdersProcessor` за 60 дней без откликов.
- ✅ **п.8 (Дайджест)**: добавлен `DigestFrequency`, роут настройки `PATCH /notifications/preferences/digest` и джоба `NotificationDigestProcessor`.
- ✅ **п.9 (Автовывод)**: добавлены `autoWithdrawThreshold`/`autoWithdrawAddressId`, роут `PATCH /wallet/auto-withdraw` и hourly джоба `AutoWithdrawProcessor`.
- ✅ **п.10 (Subscription Rate Limit)**: создан `SubscriptionAwareThrottlerGuard` с множителями (STARTER 1x, PRO 2x, PREMIUM 4x), подключён как `APP_GUARD`.
- ✅ **п.11 (Похожие заказы)**: добавлен `OrdersService.findSimilar` и эндпоинт `GET /orders/:id/similar`.
- ✅ **п.12 (Проверенный плательщик)**: вычисляемое поле `verifiedPayer` добавлено на публичный профиль и объект `client` в заказах.
- ✅ **п.13 (CSV Экспорт)**: реализован RFC 4180 CSV-экспорт истории транзакций на `GET /wallet/transactions/export.csv`.

## Вопросы к оркестратору / нужны правки в чужих файлах

- Нет вопросов.

## Ответы оркестратора

- —
