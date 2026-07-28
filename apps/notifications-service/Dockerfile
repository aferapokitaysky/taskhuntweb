FROM node:20-alpine AS base
WORKDIR /app
RUN corepack enable

FROM base AS deps
COPY package.json ./
RUN npm install -g pnpm && pnpm install --no-frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm build

FROM node:20-alpine AS runtime
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
CMD ["node", "dist/main.js"]
