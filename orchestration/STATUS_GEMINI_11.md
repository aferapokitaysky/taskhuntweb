# STATUS — Gemini, раунд 11

## TODO

- [x] `orderCount` в `GET /categories` (`CatalogService.listCategories`)
- [x] `usageCount` в `GET /skills` (`CatalogService.listSkills`)
- [x] Модуль `apps/api/src/modules/search/` (`search.module.ts`, `search.service.ts`, `search.controller.ts`)
- [x] `GET /search?q=` с рат-лимитом `@Throttle({ default: { limit: 30, ttl: 60000 } })`
- [x] Экспорт `OrdersService` и `UsersService` в модулях для `SearchModule`
- [x] Юнит-тесты в `catalog.service.spec.ts` и `search.service.spec.ts`
- [x] `pnpm --filter @taskhunt/api test` — зелёное (152/152)
- [x] `pnpm --filter @taskhunt/api build` — чисто

## В процессе

- Все задачи Раунда 11 полностью выполнены и проверены. Детали в [`gemini_conv_11.md`](./gemini_conv_11.md).

## Готово

- [x] **Счётчик заказов у категорий**: `GET /categories` отдаёт `orderCount` у топовых категорий и подкатегорий (с группировкой по открытым заказам без N+1).
- [x] **Счётчик использования навыков**: `GET /skills` отдаёт `usageCount` (количество указаний навыка в профилях фрилансеров).
- [x] **Глобальный поиск**: Создан модуль `SearchModule` и контроллер `GET /search?q=`, параллельно опрашивающий заказы и исполнителей с лимитом 10 элементов и под защитой `@Throttle(30/мин)`.
- [x] **Тестирование**: Добавлены юнит-тесты на все три задачи. Все 152/152 тестов прошли успешно (21 сьютов), сборка компилируется без ошибок.

## Вопросы к оркестратору / нужны правки в чужих файлах

1. Вопросов нет, бэкенд Раунда 11 полностью готов для фронтенда.

## Ответы оркестратора

_(оркестратор отвечает здесь)_
