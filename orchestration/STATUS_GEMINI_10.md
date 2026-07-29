# STATUS — Gemini, раунд 10

## TODO

- [x] Модели `PortfolioItem` и `viewsCount` в `schema.prisma` + миграция
- [x] DTOs `CreatePortfolioItemDto` и `UpdatePortfolioItemDto`
- [x] `addPortfolioItem`, `updatePortfolioItem`, `deletePortfolioItem` в `UsersService`
- [x] `recordProfileView` и вывод `viewsCount` в `UsersService`
- [x] Эндпоинты `POST/PATCH/DELETE /users/me/portfolio` в `UsersController`
- [x] Включение `portfolioItems` в `getPublicProfile` и `getMe`
- [x] Юнит-тесты в `users.service.spec.ts`
- [x] `pnpm --filter @taskhunt/api test` — зелёное (136/136)
- [x] `pnpm --filter @taskhunt/api build` — чисто

## В процессе

- Все задачи Раунда 10 полностью выполнены и проверены. Детали в [`gemini_conv_10.md`](./gemini_conv_10.md).

## Готово

- [x] **Портфолио фрилансера `PortfolioItem`**: Создана модель в схеме, сгенерирована SQL-миграция, DTO и CRUD методы в `UsersService`/`UsersController`.
- [x] **Счётчик просмотров `viewsCount`**: Добавлено поле в модель `Profile`, реализован метод `recordProfileView` с защитой от накрутки просмотров своего собственного профиля.
- [x] **Профили**: `getPublicProfile` и `getMe` отдают полноценный список `portfolioItems` исполнителя.
- [x] **Тестирование**: Добавлены юнит-тесты на добавление/удаление работ и просмотр профилей. Все 136/136 тестов прошли успешно (18 сьютов), сборка компилируется без ошибок.

## Вопросы к оркестратору / нужны правки в чужих файлах

1. Вопросов нет, бэкенд Раунда 10 полностью готов.

## Ответы оркестратора

_(оркестратор отвечает здесь)_
