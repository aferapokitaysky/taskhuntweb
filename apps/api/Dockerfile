FROM node:20-alpine AS base
WORKDIR /app
RUN corepack enable
# node:20-alpine не ставит openssl вообще (даже CLI отсутствует) — без него
# Prisma не может определить версию OpenSSL ни на generate, ни на рантайме,
# и в обоих случаях молча выбирает неправильный движок (см. binaryTargets в
# schema.prisma: генерирует ОБА варианта верно, но при старте всё равно
# грузит linux-musl без -openssl-3.0.x суффикса и падает с "Error loading
# shared library libssl.so.1.1: No such file or directory" — поймали живьём
# на реальном деплое). Установка openssl чинит детекцию у самого Prisma.
RUN apk add --no-cache openssl

FROM base AS deps
# apps/api зависит от @taskhunt/shared-types (workspace-пакет) и от prisma
# как devDependency СВОЕГО package.json, а не корневого — копировать только
# корневой package.json (как было раньше) означает pnpm install ставит
# пустой набор зависимостей, "prisma" CLI просто не появляется на PATH, и
# сборка падает на первом же `pnpm prisma generate` (см. git blame/сессию
# первого прод-деплоя). Тот же паттерн, что и в apps/web/Dockerfile.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/package.json
COPY packages/shared-types/package.json ./packages/shared-types/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
# "--filter <pkg> prisma generate" (без exec) — pnpm ищет package.json СКРИПТ
# с именем "prisma", не находит, печатает предупреждение и молча завершается
# успешно, ничего не сделав (клиент собирается из того, что уже сгенерировал
# postinstall-хук @prisma/client при `pnpm install` — обычно совпадает со
# схемой, но полагаться на это не стоит). "exec" — явный вызов бинаря.
RUN pnpm --filter @taskhunt/api exec prisma generate
# --filter @taskhunt/api build (без "...") ставит только nest build без
# @taskhunt/shared-types — тот компилируется отдельно, а pnpm его резолвит
# через workspace-симлинк на СЫРОЙ TS (без build), что валится с "Cannot
# find module" у зависящих пакетов. "..." тянет shared-types в топологическом
# порядке первым, тем же путём, что раньше делал `pnpm build` через turbo
# на весь монорепо — только теперь не собирая заодно web/notifications/fraud.
RUN pnpm exec turbo run build --filter=@taskhunt/api...

FROM node:20-alpine AS runtime
WORKDIR /app
RUN apk add --no-cache openssl
# pnpm в build-стадии кладёт реальные файлы в node_modules/.pnpm и
# символьные ссылки на них в node_modules каждого пакета — flatten в
# /app/dist ломает эти относительные симлинки. Переносим монорепо целиком
# (без исходников — только то, что нужно для рантайма) и держим ту же
# относительную структуру, что была на сборке.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/packages/shared-types ./packages/shared-types
COPY --from=build /app/apps/api ./apps/api
# prisma/seed.ts читает эти файлы по path.resolve(__dirname, '../../../', ...)
# т.е. ожидает их в /app — без этого `prisma db seed` падает с ENOENT.
COPY --from=build /app/it_niches_tags.txt ./it_niches_tags.txt
COPY --from=build /app/programming_skills_tags.txt ./programming_skills_tags.txt
WORKDIR /app/apps/api
EXPOSE 3001
CMD ["node", "dist/main"]
