# Руководство по Разработке TaskHunt (Contributing Guide)

Документ описывает правила локальной разработки, порядок работы с монорепозиторием, схемой базы данных, тестами и стандартами кода.

---

## 1. Требования к Окружению

- **Node.js**: v20.x или новее
- **pnpm**: v9.x (включается через `corepack enable`)
- **Docker & Docker Compose**: для локального запуска PostgreSQL, Redis и ClamAV.

---

## 2. Локальный Запуск для Разработчиков

1. **Установка зависимостей**:
   ```bash
   pnpm install
   ```

2. **Запуск инфраструктуры в Docker**:
   ```bash
   docker compose up postgres redis -d
   ```

3. **Настройка переменных окружения**:
   Скопируйте пример файла конфигурации:
   ```bash
   cp apps/api/.env.example apps/api/.env
   ```

4. **Миграция базы данных и начальный сид**:
   ```bash
   pnpm --filter @taskhunt/api prisma:migrate
   pnpm --filter @taskhunt/api prisma:seed
   ```
   > ⚠️ **Важно**: Без проведения `prisma:seed` система не сможет выполнять финансовые транзакции, так как в базе должен быть создан системный счет `system@taskhunt.internal`. Сид также читает `it_niches_tags.txt` и `programming_skills_tags.txt` из корня репозитория (`prisma/seed.ts` резолвит путь через `path.resolve(__dirname, '../../../', ...)`) — оба файла закоммичены в репо, при клонировании подтягиваются сами.

5. **Запуск сервера разработки**:
   ```bash
   pnpm dev
   ```
   Команда поднимет `apps/api` (порт `3001`) и `apps/web` (порт `3000`) одновременно через Turborepo.

---

## 3. Работа с Базой Данных и Схемой Prisma

* **Внесение изменений в схему**:
  1. Отредактируйте `apps/api/prisma/schema.prisma`.
  2. Создайте миграцию:
     ```bash
     pnpm --filter @taskhunt/api exec prisma migrate dev --name <migration_name>
     ```
  3. Обновите типы Prisma Client:
     ```bash
     pnpm --filter @taskhunt/api exec prisma generate
     ```

* **Никогда не используйте `prisma db push` на продакшн или демо-серверах**. Только `prisma migrate deploy`.

---

## 4. Тестирование и Сборка

* **Запуск юнит-тестов бэкенда**:
  ```bash
  pnpm --filter @taskhunt/api test
  ```

* **Запуск тестов фронтенда** (Vitest):
  ```bash
  pnpm --filter @taskhunt/web test
  ```

* **Проверка типов и полная сборка всех приложений**:
  ```bash
  pnpm build
  ```

---

## 5. Стандарты Добавления Новых Событий (Event Bus)

Если ваш функционал публикует новое событие:
1. Зарегистрируйте имя и схему payload в пакете `packages/shared-types/src/events.ts`.
2. Публикуйте ивент из сервиса с помощью `EventEmitter2` или `EventBusService`.
3. Подпишите воркеры `notifications-service` или `fraud-service` при необходимости реагировать на ивент.
