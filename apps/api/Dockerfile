# syntax=docker/dockerfile:1
FROM node:24-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS pruner
COPY . .
RUN pnpm dlx turbo@2.11.5 prune @shop/api --docker

FROM base AS builder
COPY --from=pruner /repo/out/json/ .
COPY --from=pruner /repo/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile
COPY --from=pruner /repo/out/full/ .
RUN pnpm turbo run build --filter=@shop/api
RUN pnpm --filter @shop/api deploy --prod --legacy /out

FROM node:24-alpine AS runner
ENV NODE_ENV=production PORT=4000
ARG APP_VERSION=dev
ENV APP_VERSION=$APP_VERSION
WORKDIR /app
COPY --from=builder --chown=node:node /out/ .
USER node
EXPOSE 4000
HEALTHCHECK --interval=10s --timeout=3s --start-period=60s --retries=5 CMD wget -qO- http://127.0.0.1:4000/api/health || exit 1
# Apply pending migrations before serving, so every deploy runs on the schema it was built for.
# Prisma takes an advisory lock, so concurrent starts are safe; a failed migration stops the container.
# Then create the site content rows (brand settings, rules draft and first edition) when missing:
# content-main.js never touches the catalog, roles or anything an admin edited, and holds its own
# advisory lock, so concurrent starts create them once. A failure stops the container too.
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node dist/seed/content-main.js && exec node dist/main.js"]
