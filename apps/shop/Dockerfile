# Multi-stage build for Jiffoo Mall Shop Frontend
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
# Skip binary downloads that require external network access
ENV ELECTRON_SKIP_BINARY_DOWNLOAD=1
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=1
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

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
COPY apps/shop/package.json ./apps/shop/
COPY packages/shared/package.json ./packages/shared/
COPY packages/shop-themes/default/package.json ./packages/shop-themes/default/
COPY packages/ui/package.json ./packages/ui/

# Install dependencies using local Verdaccio registry (npm.lafdru.local)
# DNS resolution is handled by CI/CD pipeline (adds npm.lafdru.local to /etc/hosts)
RUN pnpm config set fetch-retries 5 && \
    pnpm config set fetch-retry-mintimeout 20000 && \
    pnpm config set fetch-retry-maxtimeout 120000 && \
    pnpm install --frozen-lockfile

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/shop/node_modules ./apps/shop/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/packages/shop-themes/default/node_modules ./packages/shop-themes/default/node_modules
COPY --from=deps /app/packages/ui/node_modules ./packages/ui/node_modules

# Copy source code
COPY . .

# Set environment variables for build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build-time argument for API service URL
# This URL is used by Next.js rewrites to proxy /api/* requests to the backend
# Using K8s internal service name (must match deployment service name in the same namespace)
ARG API_SERVICE_URL=http://jiffoo-mall-api-dev:80
ENV API_SERVICE_URL=${API_SERVICE_URL}

# Build workspace packages first (required for workspace dependency resolution)
RUN cd packages/shared && npm run build
RUN cd packages/ui && npm run build

# Build the Next.js application (use root node_modules since pnpm hoists deps)
RUN cd apps/shop && /app/node_modules/.bin/next build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

# Cache buster - changes force rebuild of runner stage
ARG BUILD_SHA=unknown
ENV BUILD_SHA=${BUILD_SHA}

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1
ENV PORT 3001

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy the built application
COPY --from=builder /app/apps/shop/public ./apps/shop/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/shop/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/shop/.next/static ./apps/shop/.next/static

USER nextjs

EXPOSE 3001

ENV HOSTNAME "0.0.0.0"

# Start with explicit port (Next.js standalone reads PORT env var)
CMD ["sh", "-c", "PORT=${PORT:-3001} node apps/shop/server.js"]
