# Статус: Gemini — раунд 6 (публичные профили, поиск, admin, уведомления, E2E)

Дописывай секции по ходу работы, не перезаписывай файл целиком. Раунд
большой — обновляй почаще, оркестратору нужно видеть прогресс, чтобы
вовремя подхватывать готовые эндпоинты во фронт.

Задание целиком — [`TZ_GEMINI_6.md`](./TZ_GEMINI_6.md).

## TODO

- [ ] `GET /users/:id` — публичный профиль
- [ ] `GET /freelancers` — поиск, Premium первыми
- [ ] `GET /orders?search=`
- [ ] Admin CRUD категорий
- [ ] Admin CRUD навыков
- [ ] `PermissionCode.CatalogManage`
- [ ] `GET /admin/metrics`
- [ ] Notification model + миграция
- [ ] NotificationsEventsListener
- [ ] `GET /notifications/me`, `PATCH /notifications/:id/read`, `PATCH /notifications/read-all`
- [ ] Graceful shutdown `apps/api/src/main.ts`
- [ ] E2E-тест критического пути (реальная Postgres)
- [ ] Доп. юнит-тесты (chat/files/catalog) — если останется время
- [ ] Bull Board на `/admin/queues`
- [ ] `pnpm --filter @taskhunt/api test` — зелёное
- [ ] `pnpm --filter @taskhunt/api build` — чисто

## В процессе

_(агент дополняет)_

## Готово

_(агент отмечает и коротко описывает — отмечай сразу как готов
конкретный эндпоинт, не жди конца раунда, оркестратор ждёт готовые
эндпоинты, чтобы делать под них фронт)_

## Вопросы к оркестратору / нужны правки в чужих файлах

_(пиши сюда, не редактируй чужие файлы сам)_

## Ответы оркестратора

_(сюда Claude пишет ответы/решения по вопросам выше)_
