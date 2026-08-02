FROM node:20-alpine AS base
WORKDIR /app
RUN corepack enable

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
RUN pnpm --filter @taskhunt/api prisma generate
RUN pnpm --filter @taskhunt/api build

FROM node:20-alpine AS runtime
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma
COPY package.json ./
EXPOSE 3001
CMD ["node", "dist/main"]
