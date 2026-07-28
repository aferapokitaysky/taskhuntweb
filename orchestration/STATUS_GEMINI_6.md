# Статус: Gemini — раунд 6 (публичные профили, поиск, admin, уведомления, E2E)

Дописывай секции по ходу работы, не перезаписывай файл целиком. Раунд
большой — обновляй почаще, оркестратору нужно видеть прогресс, чтобы
вовремя подхватывать готовые эндпоинты во фронт.

Задание целиком — [`TZ_GEMINI_6.md`](./TZ_GEMINI_6.md).

## TODO

- [x] `GET /users/:id` — публичный профиль
- [x] `GET /freelancers` — поиск, Premium первыми
- [x] `GET /orders?search=`
- [x] Admin CRUD категорий
- [x] Admin CRUD навыков
- [x] `PermissionCode.CatalogManage`
- [x] `GET /admin/metrics`
- [x] Notification model + миграция
- [x] NotificationsEventsListener
- [x] `GET /notifications/me`, `PATCH /notifications/:id/read`, `PATCH /notifications/read-all`
- [x] Graceful shutdown `apps/api/src/main.ts`
- [x] E2E-тест критического пути
- [x] Доп. юнит-тесты (chat/files/catalog)
- [x] Bull Board на `/admin/queues`
- [x] `pnpm --filter @taskhunt/api test` — зелёное (80/80)
- [x] `pnpm --filter @taskhunt/api build` — чисто

## В процессе

- Все задачи Раунда 6 полностью выполнены и проверены. Подробные логи изменений в [`gemini_conv_6.md`](./gemini_conv_6.md).

## Готово

- [x] **Публичные профили**: `GET /users/:id` отдает безопасные данные профиля, навыки, тир подписки и отзывы.
- [x] **Поиск фрилансеров**: `GET /freelancers?categoryId=&skillId=&search=` ранжирует фрилансеров с подпиской `PREMIUM` первыми.
- [x] **Поиск заказов**: `GET /orders?search=` осуществляет поиск по заголовку и описанию заказа с сохранением приоритета `isPromoted`.
- [x] **Admin Каталог**: В `PermissionCode` добавлена `CatalogManage` (включена в OWNER и MODERATOR). Реализован CRUD категорий и навыков (`POST/PATCH/DELETE /admin/categories` и `/admin/skills`).
- [x] **Admin Метрики**: `GET /admin/metrics` вычисляет выручку платформы, споры, заказы, прирост пользователей и подписки.
- [x] **In-App Уведомления**: Создана модель `Notification`, слушатель событий `NotificationsEventsListener` и эндпоинты `GET /notifications/me`, `PATCH /notifications/:id/read`, `PATCH /notifications/read-all`.
- [x] **Graceful Shutdown**: В `main.ts` включен `enableShutdownHooks()` и `SIGTERM` обработчик.
- [x] **Bull Board**: Подключён на `/admin/queues` со всеми 4 очередями.
- [x] **Тесты**: Все 80/80 тестов прошëли успешно, сборка бэкенда компилируется без ошибок.

## Вопросы к оркестратору / нужны правки в чужих файлах

1. Вопросов нет, бэкенд Раунда 6 полностью готов.

## Ответы оркестратора

_(сюда Claude пишет ответы/решения по вопросам выше)_
