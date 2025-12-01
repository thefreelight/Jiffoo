# Multi-stage build for Jiffoo Mall API Service
FROM node:18-alpine AS base

# Build-time proxy configuration
ARG HTTP_PROXY=http://192.168.0.106:7890
ARG HTTPS_PROXY=http://192.168.0.106:7890
ARG NO_PROXY=localhost,127.0.0.1,192.168.0.0/16,10.0.0.0/8

# Build information for /health endpoint
ARG BUILD_SHA=development
ARG BUILD_TIME=unknown
ARG APP_VERSION=1.0.0

# Set proxy environment variables for npm
ENV HTTP_PROXY=${HTTP_PROXY}
ENV HTTPS_PROXY=${HTTPS_PROXY}
ENV NO_PROXY=${NO_PROXY}

# Install system dependencies
RUN apk add --no-cache \
    libc6-compat \
    openssl \
    openssl-dev \
    netcat-openbsd \
    curl

# Install pnpm
RUN npm install -g pnpm@9.0.0

# Set working directory
WORKDIR /app

# Dependencies stage
FROM base AS deps

# Skip Prisma engine download during install (we'll do it in builder stage with retries)
ENV PRISMA_SKIP_POSTINSTALL_GENERATE=true

# Copy workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/

# Configure pnpm for better network handling
RUN pnpm config set network-timeout 300000 && \
    pnpm config set fetch-retries 5 && \
    pnpm config set fetch-retry-mintimeout 20000 && \
    pnpm config set fetch-retry-maxtimeout 120000

# Install dependencies
RUN pnpm install --frozen-lockfile

# Builder stage
FROM base AS builder
WORKDIR /app

# Install pnpm in builder stage
RUN npm install -g pnpm@9.0.0

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules

# Copy source code
COPY . .

# Ensure plugins directory exists (create empty one if it doesn't exist)
RUN mkdir -p /app/plugins

# Build shared package first
RUN pnpm --filter shared build

# Generate Prisma client with retries
RUN for i in 1 2 3 4 5; do \
      pnpm --filter api prisma generate && break || \
      echo "Prisma generate attempt $i failed, retrying in 10s..." && sleep 10; \
    done

# Build api service
RUN pnpm --filter api build

# Production stage
FROM base AS runner
WORKDIR /app

# Redeclare ARGs after FROM
ARG BUILD_SHA
ARG BUILD_TIME
ARG APP_VERSION

ENV NODE_ENV=production
ENV PORT=8001
# Inject build info as environment variables for /health endpoint
ENV BUILD_SHA=${BUILD_SHA}
ENV BUILD_TIME=${BUILD_TIME}
ENV APP_VERSION=${APP_VERSION}

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 api

# Copy built application
COPY --from=builder --chown=api:nodejs /app/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=api:nodejs /app/apps/api/package.json ./apps/api/
COPY --from=builder --chown=api:nodejs /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder --chown=api:nodejs /app/packages/shared/package.json ./packages/shared/
# Copy plugins directory (required by payment-manager)
COPY --from=builder --chown=api:nodejs /app/plugins ./plugins

# Copy production dependencies from builder (includes Prisma generated client)
COPY --from=builder --chown=api:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=api:nodejs /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder --chown=api:nodejs /app/packages/shared/node_modules ./packages/shared/node_modules

# Create logs and uploads directories with proper permissions
RUN mkdir -p /app/logs /app/uploads && chown -R api:nodejs /app/logs /app/uploads

USER api

EXPOSE 8001

CMD ["node", "apps/api/dist/apps/api/src/server.js"]
