FROM node:24.13.1-bookworm-slim@sha256:a81a03dd965b4052269a57fac857004022b522a4bf06e7a739e25e18bce45af2 AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app

FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile
ENV NEXT_TELEMETRY_DISABLED=1 API_SERVICE_URL=http://api-lb:8080 NEXT_PUBLIC_API_URL=/api/v1
RUN DATABASE_URL=postgresql://postgres:postgres@localhost:5432/jiffoo_core_test pnpm --filter shared build && DATABASE_URL=postgresql://postgres:postgres@localhost:5432/jiffoo_core_test pnpm --filter api build
RUN pnpm --filter admin build && pnpm --filter shop build

FROM base AS dependencies
COPY . .
RUN pnpm install --prod --frozen-lockfile
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
RUN DATABASE_URL=postgresql://postgres:postgres@localhost:5432/jiffoo_core_test pnpm --filter api exec prisma generate

FROM base AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
ARG REVISION
ARG RELEASE_VERSION
LABEL org.opencontainers.image.revision=$REVISION
LABEL org.opencontainers.image.version=$RELEASE_VERSION
LABEL org.opencontainers.image.source="https://github.com/thefreelight/Jiffoo"
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=dependencies /app/apps/admin/node_modules ./apps/admin/node_modules
COPY --from=dependencies /app/apps/shop/node_modules ./apps/shop/node_modules
COPY package.json pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/package.json
COPY packages/shared/config ./packages/shared/config
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY deploy/compose ./deploy/compose
COPY deploy/release ./deploy/release
COPY bin ./bin
RUN mkdir -p /data && chown node:node /data
USER 1000:1000

FROM runtime AS backend
ENV APP_VERSION=$RELEASE_VERSION BUILD_SHA=$REVISION
LABEL io.jiffoo.role=backend
COPY apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY apps/api/prisma ./apps/api/prisma
COPY apps/api/builtin-plugins ./apps/api/builtin-plugins
COPY apps/api/builtin-themes ./apps/api/builtin-themes
WORKDIR /app/apps/api
CMD ["node", "dist/server.js"]

FROM runtime AS admin
LABEL io.jiffoo.role=admin
COPY apps/admin/package.json apps/admin/next.config.js ./apps/admin/
COPY --from=build /app/apps/admin/.next ./apps/admin/.next
COPY --from=build /app/apps/admin/.next/static ./apps/admin/.next/standalone/apps/admin/.next/static
COPY apps/admin/public ./apps/admin/.next/standalone/apps/admin/public
COPY apps/admin/public ./apps/admin/public
WORKDIR /app/apps/admin
CMD ["node", ".next/standalone/apps/admin/server.js"]

FROM runtime AS shop
LABEL io.jiffoo.role=shop
COPY apps/shop/package.json apps/shop/next.config.js apps/shop/server.mjs ./apps/shop/
COPY apps/shop/lib ./apps/shop/lib
COPY --from=build /app/apps/shop/.next ./apps/shop/.next
COPY apps/shop/public ./apps/shop/public
WORKDIR /app/apps/shop
CMD ["node", "server.mjs"]
