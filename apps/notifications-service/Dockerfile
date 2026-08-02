FROM node:20-alpine AS base
WORKDIR /app
RUN corepack enable

FROM base AS deps
# См. apps/api/Dockerfile — тот же паттерн и та же причина (иначе prisma CLI
# и @taskhunt/shared-types не устанавливаются, сборка падает).
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/notifications-service/package.json ./apps/notifications-service/package.json
COPY packages/shared-types/package.json ./packages/shared-types/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm --filter notifications-service build

FROM node:20-alpine AS runtime
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
CMD ["node", "dist/main.js"]
