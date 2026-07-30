# STATUS — Gemini, раунд 14

## TODO

- [x] 1. Сертификация навыков — **ОТМЕНЕНО ПОЛЬЗОВАТЕЛЕМ** ("квиз опрос нет")
- [x] 2. Доказательства по спору (`DisputeFile`, `POST /orders/:id/disputes/:disputeId/attach`, `GET /disputes/:id/files`)
- [x] 3. Запрос на продление дедлайна (`DeadlineExtensionRequest`, `POST /orders/:id/deadline-extension`, `POST .../respond`)
- [x] 4. Планировщик recurring-заказов (`OrderTemplate`, CRUD `/users/me/order-templates`, BullMQ hourly job)
- [x] 5. Расширенная лента фрод-флагов для админки (курсорная пагинация, фильтр по `userId` в `GET /admin/fraud-flags`)
- [x] 6. Тренды поиска (`SearchLog`, `GET /search/trending`, асинхронное логирование запросов)
- [x] 7. Отклонение отклика с причиной (`Bid.rejectionReason`, `POST /orders/:id/bids/:bidId/reject`)
- [x] 8. Чёрные списки клиентов (`ClientBlock`, `POST/DELETE/GET /users/me/blocks`)
- [x] 9. Экспорт счетов заказа в CSV (`GET /orders/:id/invoices/export.csv`)
- [x] 10. Уведомление о скором дедлайне (`Order.deadlineWarningSentAt`, BullMQ daily job)
- [x] 11. Массовое приостановление аккаунтов (`POST /admin/users/bulk-suspend`)
- [x] 12. Сброс 2FA админом (`POST /admin/users/:id/reset-2fa` с AuditLog)
- [x] `pnpm --filter @taskhunt/api test` — зелёное
- [x] `pnpm --filter @taskhunt/api build` — чисто

## В процессе

- Все задачи раунда завершены.

## Готово

- 🚫 **п.1 (Квизы и сертификация)**: отменён по указанию пользователя.
- ✅ **п.2 (Файлы к спору)**: модель `DisputeFile`, роуты `POST /orders/:id/disputes/:disputeId/attach` (с проверкой `scanStatus === 'CLEAN'` и роли участника) и `GET /disputes/:id/files`.
- ✅ **п.3 (Продление дедлайна)**: модель `DeadlineExtensionRequest`, роуты `POST /orders/:id/deadline-extension` и `POST .../respond` (с транзакционным обновлением `order.deadline` и событиями).
- ✅ **п.4 (Шаблоны заказов)**: модель `OrderTemplate`, CRUD `/users/me/order-templates`, BullMQ hourly воркер `OrderTemplateProcessor`.
- ✅ **п.5 (Пагинация фрод-флагов)**: курсорная пагинация (`cursor`, `limit`) и фильтрация по `userId` в `GET /admin/fraud-flags`.
- ✅ **п.6 (Тренды поиска)**: модель `SearchLog`, асинхронное фоновое логирование поисковых запросов, эндпоинт `GET /search/trending`.
- ✅ **п.7 (Причина отклонения бида)**: поле `Bid.rejectionReason`, эндпоинт `POST /orders/:id/bids/:bidId/reject` с отправкой уведомления.
- ✅ **п.8 (Чёрный список клиентов)**: модель `ClientBlock`, CRUD `/users/me/blocks`, автоматический отклон попытки отклика заблокированного фрилансера в `submitBid`.
- ✅ **п.9 (Экспорт инвойсов в CSV)**: метод `InvoiceService.exportOrderInvoicesCsv` и эндпоинт `GET /orders/:id/invoices/export.csv`.
- ✅ **п.10 (Уведомление о дедлайне)**: поле `Order.deadlineWarningSentAt`, BullMQ daily воркер `DeadlineWarningProcessor`.
- ✅ **п.11 (Массовый бан пользователей)**: роут `POST /admin/users/bulk-suspend` с защитой от бана себя/staff и единой записью в AuditLog.
- ✅ **п.12 (Сброс 2FA админом)**: роут `POST /admin/users/:id/reset-2fa` с полной очисткой TOTP секретов/кодов и ведением AuditLog.

## Вопросы к оркестратору / нужны правки в чужих файлах

- Вопросов нет, все задачи 2–12 полностью автономно интегрированы и проверены.
