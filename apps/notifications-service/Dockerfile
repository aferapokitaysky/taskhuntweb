FROM node:20-alpine AS base
WORKDIR /app
RUN corepack enable
# См. apps/api/Dockerfile — node:20-alpine не ставит openssl вообще, без
# него Prisma не может определить версию OpenSSL и грузит не тот движок.
RUN apk add --no-cache openssl

FROM base AS deps
# См. apps/api/Dockerfile — тот же паттерн и та же причина (иначе prisma CLI
# и @taskhunt/shared-types не устанавливаются, сборка падает).
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/notifications-service/package.json ./apps/notifications-service/package.json
COPY packages/shared-types/package.json ./packages/shared-types/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
# "..." тянет @taskhunt/shared-types первым (топологически) — см.
# apps/api/Dockerfile для полного объяснения.
RUN pnpm exec turbo run build --filter=notifications-service...

FROM node:20-alpine AS runtime
WORKDIR /app
RUN apk add --no-cache openssl
# Сохраняем структуру монорепо в рантайме — см. apps/api/Dockerfile,
# та же причина (pnpm-симлинки в node_modules ссылаются относительными
# путями на node_modules/.pnpm, flatten их ломает).
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/packages/shared-types ./packages/shared-types
COPY --from=build /app/apps/notifications-service ./apps/notifications-service
WORKDIR /app/apps/notifications-service
CMD ["node", "dist/main.js"]
