# Multi-stage build for Jiffoo Mall Admin (商户管理后台)
FROM node:20-alpine AS base

# Build-time proxy configuration
ARG HTTP_PROXY=http://192.168.0.106:7890
ARG HTTPS_PROXY=http://192.168.0.106:7890
ARG NO_PROXY=localhost,127.0.0.1,192.168.0.0/16,10.0.0.0/8

# Install system packages BEFORE setting proxy (Alpine repos don't need proxy)
RUN apk add --no-cache libc6-compat

# Set proxy environment variables for npm/pnpm (after apk)
ENV HTTP_PROXY=${HTTP_PROXY}
ENV HTTPS_PROXY=${HTTPS_PROXY}
ENV NO_PROXY=${NO_PROXY}
# pnpm specific proxy settings
ENV npm_config_proxy=${HTTP_PROXY}
ENV npm_config_https_proxy=${HTTPS_PROXY}

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Install pnpm with proxy and npm mirror
RUN npm config set proxy ${HTTP_PROXY} && \
    npm config set https-proxy ${HTTPS_PROXY} && \
    npm config set registry https://registry.npmmirror.com && \
    npm install -g pnpm@9.0.0

# Copy workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/admin/package.json ./apps/admin/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies with npm mirror and retry settings
# Override .npmrc registry which may point to internal mirror
RUN sed -i 's|registry=http://npm.lafdru.local/|registry=https://registry.npmmirror.com/|g' .npmrc && \
    pnpm config set fetch-retries 5 && \
    pnpm config set fetch-retry-mintimeout 20000 && \
    pnpm config set fetch-retry-maxtimeout 120000 && \
    pnpm install --frozen-lockfile

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/admin/node_modules ./apps/admin/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules

# Copy source code
COPY . .

# Ensure public directory exists (create empty one if it doesn't exist)
RUN mkdir -p /app/apps/admin/public

# Set environment variables for build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
# Set backend URL for build-time rewrites configuration
# This URL is used by Next.js rewrites to proxy /api/* requests to the backend
ENV API_SERVICE_URL=http://jiffoo-mall-core-backend:3002

# Build shared package first (required for workspace dependency resolution)
RUN cd packages/shared && npm run build

# Build the Next.js application
RUN cd apps/admin && npx next build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

# Cache buster - changes force rebuild of runner stage
ARG BUILD_SHA=unknown
ENV BUILD_SHA=${BUILD_SHA}

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1
ENV PORT 3003

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy the built application
COPY --from=builder /app/apps/admin/public ./apps/admin/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/admin/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/admin/.next/static ./apps/admin/.next/static

USER nextjs

EXPOSE 3003

ENV HOSTNAME "0.0.0.0"

# Start with explicit port (Next.js standalone reads PORT env var)
CMD ["sh", "-c", "PORT=${PORT:-3003} node apps/admin/server.js"]
