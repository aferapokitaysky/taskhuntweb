FROM node:20-alpine AS base
WORKDIR /app
RUN corepack enable

FROM base AS deps
# См. apps/api/Dockerfile — тот же паттерн и та же причина (иначе prisma CLI
# и @taskhunt/shared-types не устанавливаются, сборка падает).
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/fraud-service/package.json ./apps/fraud-service/package.json
COPY packages/shared-types/package.json ./packages/shared-types/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
# "..." тянет @taskhunt/shared-types первым (топологически) — см.
# apps/api/Dockerfile для полного объяснения.
RUN pnpm exec turbo run build --filter=fraud-service...

FROM node:20-alpine AS runtime
WORKDIR /app
# Сохраняем структуру монорепо в рантайме — см. apps/api/Dockerfile,
# та же причина (pnpm-симлинки в node_modules ссылаются относительными
# путями на node_modules/.pnpm, flatten их ломает).
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/packages/shared-types ./packages/shared-types
COPY --from=build /app/apps/fraud-service ./apps/fraud-service
WORKDIR /app/apps/fraud-service
EXPOSE 3002
CMD ["node", "dist/main.js"]
