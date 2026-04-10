# Multi-stage build for Jiffoo Mall API Service
FROM node:20-bookworm-slim AS base

# Build-time proxy configuration
ARG HTTP_PROXY=""
ARG HTTPS_PROXY=""
ARG NO_PROXY="localhost,127.0.0.1,192.168.0.0/16,10.0.0.0/8"
ARG NPM_REGISTRY=https://registry.npmmirror.com

# Build information for /health endpoint
ARG BUILD_SHA=development
ARG BUILD_TIME=unknown
ARG APP_VERSION=1.0.0

# Set proxy environment variables before installing system packages and npm deps
ENV HTTP_PROXY=${HTTP_PROXY}
ENV HTTPS_PROXY=${HTTPS_PROXY}
ENV NO_PROXY=${NO_PROXY}
ENV npm_config_proxy=${HTTP_PROXY}
ENV npm_config_https_proxy=${HTTPS_PROXY}
ENV npm_config_registry=${NPM_REGISTRY}
ENV NPM_CONFIG_REGISTRY=${NPM_REGISTRY}
# Skip binary downloads that require external network access
ENV ELECTRON_SKIP_BINARY_DOWNLOAD=1
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=1
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    netcat-openbsd \
    openssl && \
    rm -rf /var/lib/apt/lists/*

# Install pnpm from a vendored tarball so CI does not depend on external npm mirrors.
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# Set working directory
WORKDIR /app

# Dependencies stage
FROM base AS deps
# Copy workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies using a public npm mirror by default.
# CI can still override NPM_REGISTRY when an internal cache is healthy.
RUN pnpm config set fetch-retries 5 && \
    pnpm config set fetch-retry-mintimeout 20000 && \
    pnpm config set fetch-retry-maxtimeout 120000 && \
    pnpm config set registry ${NPM_REGISTRY} && \
    pnpm config set network-concurrency 8 && \
    pnpm config set child-concurrency 4 && \
    pnpm install --frozen-lockfile

# Builder stage
FROM base AS builder
WORKDIR /app

# Install pnpm in builder stage (needed for build commands) from the vendored tarball.
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules

# Copy source code
COPY . .

# Ensure plugins directory exists (create empty one if it doesn't exist)
RUN mkdir -p /app/plugins

# Build shared package first
RUN pnpm --filter shared build

# Build embedded official artifacts so free official installs do not depend on
# an external marketplace artifact host at runtime.
RUN pnpm --filter api exec tsx scripts/build-official-artifacts.ts || echo "Skipping embedded official artifacts for API image"

# Generate Prisma client
RUN pnpm --filter api prisma generate

# Build api service
RUN pnpm --filter api build && \
    echo "=== Build output ===" && \
    ls -la /app/apps/api/dist/ && \
    test -f /app/apps/api/dist/server.js || (echo "ERROR: server.js not found!" && exit 1)

# Production stage
FROM base AS runner
WORKDIR /app

# Redeclare ARGs after FROM
ARG BUILD_SHA
ARG BUILD_TIME
ARG APP_VERSION

ENV NODE_ENV=production
ENV PORT=3002
# Inject build info as environment variables for /health endpoint
ENV BUILD_SHA=${BUILD_SHA}
ENV BUILD_TIME=${BUILD_TIME}
ENV APP_VERSION=${APP_VERSION}

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 api

# Copy built application
COPY --from=builder --chown=api:nodejs /app/package.json ./
COPY --from=builder --chown=api:nodejs /app/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=api:nodejs /app/apps/api/package.json ./apps/api/
COPY --from=builder --chown=api:nodejs /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder --chown=api:nodejs /app/packages/shared/package.json ./packages/shared/
# Copy plugins directory (required by payment-manager)
COPY --from=builder --chown=api:nodejs /app/plugins ./plugins
# Copy Prisma schema and migrations for database migration
COPY --from=builder --chown=api:nodejs /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder --chown=api:nodejs /app/dist/official-artifacts ./dist/official-artifacts

# Copy production dependencies from builder (includes Prisma generated client)
# Must copy from builder, not deps, because prisma generate runs in builder stage
COPY --from=builder --chown=api:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=api:nodejs /app/apps/api/node_modules ./apps/api/node_modules

# Create logs, uploads, and extensions directories with proper permissions
RUN mkdir -p /app/logs /app/uploads /app/extensions && chown -R api:nodejs /app/logs /app/uploads /app/extensions

USER api

EXPOSE 3002

CMD ["node", "apps/api/dist/server.js"]
