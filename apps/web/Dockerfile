# Сборка из корня монорепо как контекст (см. docker-compose.yml,
# context: ., dockerfile: apps/web/Dockerfile) — как и apps/api/Dockerfile.
FROM node:20-alpine AS base
WORKDIR /app
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/web/package.json ./apps/web/package.json
COPY packages/shared-types/package.json ./packages/shared-types/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
# NEXT_PUBLIC_* переменные должны быть доступны на этапе сборки — они
# запекаются в клиентский бандл, а не читаются из окружения в рантайме.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_WEB_URL
ARG NEXT_PUBLIC_GA_MEASUREMENT_ID
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_WEB_URL=${NEXT_PUBLIC_WEB_URL}
ENV NEXT_PUBLIC_GA_MEASUREMENT_ID=${NEXT_PUBLIC_GA_MEASUREMENT_ID}
# "..." тянет @taskhunt/shared-types первым (топологически) — см.
# apps/api/Dockerfile для полного объяснения; @taskhunt/web тоже на него
# завязан (PayoutAddressBook.tsx и другие), просто раньше сборка ни разу не
# доходила до этого шага живьём (соседний сервис падал первым).
RUN pnpm exec turbo run build --filter=@taskhunt/web...

# output: 'standalone' (next.config.mjs) кладёт минимальный рантайм в
# .next/standalone/apps/web/ — полный путь от корня монорепо, не просто
# server.js в корне. Статика и public/ в standalone не попадают сами,
# копируем их отдельно (стандартная особенность Next.js standalone).
FROM node:20-alpine AS runtime
WORKDIR /app
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/apps/web/public ./apps/web/public
EXPOSE 3000
ENV PORT=3000
CMD ["node", "apps/web/server.js"]
