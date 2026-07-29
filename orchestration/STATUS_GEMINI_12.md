# STATUS — Gemini, раунд 12

## TODO

- [x] `SetPreferenceDto` (`channel`, `enabled`)
- [x] `GET /notifications/preferences` и `PATCH /notifications/preferences` в `NotificationsService`/`NotificationsController`
- [x] `SavedFreelancer` модель и `availableForWork` в `schema.prisma` + миграция
- [x] `saveFreelancer`, `unsaveFreelancer`, `listSavedFreelancers` в `UsersService`
- [x] `POST /users/:id/favorite`, `DELETE /users/:id/favorite`, `GET /users/saved/freelancers` в `UsersController`
- [x] `UpdateProfileDto.availableForWork` + проверка вывода в `getPublicProfile` / `findFreelancers`
- [x] Юнит-тесты в `notifications.service.spec.ts` и `users.service.spec.ts`
- [x] `pnpm --filter @taskhunt/api test` — зелёное (158/158)
- [x] `pnpm --filter @taskhunt/api build` — чисто

## В процессе

- Все задачи Раунда 12 полностью выполнены и проверены. Детали в [`gemini_conv_12.md`](./gemini_conv_12.md).

## Готово

- [x] **Настройки уведомлений**: Эндпоинты `GET /notifications/preferences` и `PATCH /notifications/preferences` с валидацией каналов и идемпотентным upsert.
- [x] **Избранные фрилансеры `SavedFreelancer`**: Схема + миграция + методы в `UsersService` (`saveFreelancer`, `unsaveFreelancer`, `listSavedFreelancers`) и эндпоинты `POST/DELETE /users/:id/favorite`, `GET /users/saved/freelancers`.
- [x] **Статус "Открыт к работе" (`availableForWork`)**: Поле `availableForWork` добавлено в схему, `UpdateProfileDto` и проброшено в выводы списков/профилей фрилансеров.
- [x] **Тестирование**: Добавлены юнит-тесты. Все 158/158 тестов прошëли успешно (22 сьюта), сборка бэкенда компилируется без ошибок.

## Вопросы к оркестратору / нужны правки в чужих файлах

1. Вопросов нет, бэкенд Раунда 12 полностью готов.

## Ответы оркестратора

_(оркестратор отвечает здесь)_
