# Multi-stage build for Jiffoo Mall Shop Frontend
ARG NODE_BASE_IMAGE=harbor.lafdru.local/library/node:20-alpine
FROM ${NODE_BASE_IMAGE} AS base

# Build-time proxy configuration
ARG HTTP_PROXY=http://192.168.0.106:7890
ARG HTTPS_PROXY=http://192.168.0.106:7890
ARG NO_PROXY=localhost,127.0.0.1,192.168.0.0/16,10.0.0.0/8
ARG NPM_REGISTRY=https://registry.npmmirror.com

# Set proxy environment variables before installing Alpine packages and npm/pnpm deps
ENV HTTP_PROXY=${HTTP_PROXY}
ENV HTTPS_PROXY=${HTTPS_PROXY}
ENV NO_PROXY=${NO_PROXY}
# pnpm specific proxy settings
ENV npm_config_proxy=${HTTP_PROXY}
ENV npm_config_https_proxy=${HTTPS_PROXY}
ENV npm_config_registry=${NPM_REGISTRY}
ENV NPM_CONFIG_REGISTRY=${NPM_REGISTRY}
# Skip binary downloads that require external network access
ENV ELECTRON_SKIP_BINARY_DOWNLOAD=1
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=1
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

# The Shop image only needs Node.js and the standalone Next.js output.
# Avoid apk network fetches here so CI is not coupled to external Alpine mirrors.

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Install pnpm from a vendored tarball so CI doesn't depend on external npm availability.
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# Copy workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/shop/package.json ./apps/shop/
COPY packages/shared/package.json ./packages/shared/
COPY packages/shop-themes/default/package.json ./packages/shop-themes/default/
COPY packages/shop-themes/bokmoo/package.json ./packages/shop-themes/bokmoo/
COPY packages/shop-themes/digital-vault/package.json ./packages/shop-themes/digital-vault/
COPY packages/shop-themes/esim-mall/package.json ./packages/shop-themes/esim-mall/
COPY packages/shop-themes/imagic-studio/package.json ./packages/shop-themes/imagic-studio/
COPY packages/shop-themes/navtoai/package.json ./packages/shop-themes/navtoai/
COPY packages/shop-themes/yevbi/package.json ./packages/shop-themes/yevbi/

COPY packages/ui/package.json ./packages/ui/
COPY packages/theme-api-sdk/package.json ./packages/theme-api-sdk/
COPY packages/core-api-sdk/package.json ./packages/core-api-sdk/

# Install dependencies using a public npm mirror by default.
# CI can still override NPM_REGISTRY when an internal cache is healthy.
RUN pnpm config set fetch-retries 5 && \
    pnpm config set fetch-retry-mintimeout 20000 && \
    pnpm config set fetch-retry-maxtimeout 120000 && \
    pnpm config set registry ${NPM_REGISTRY} && \
    pnpm config set network-concurrency 8 && \
    pnpm config set child-concurrency 4 && \
    pnpm install --frozen-lockfile

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app

# Install pnpm (needed for build commands) from the same vendored tarball.
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/shop/node_modules ./apps/shop/node_modules

# Copy source code
COPY . .

# Set environment variables for build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build-time argument for API service URL
# This URL is used by Next.js rewrites to proxy /api/* requests to the backend
# Using K8s internal service name (must match deployment service name in the same namespace)
ARG API_SERVICE_URL=http://api:80
ENV API_SERVICE_URL=${API_SERVICE_URL}

# Build-time NEXT_PUBLIC_* environment variables for Next.js static generation
# These are embedded into the JavaScript bundle at build time
ARG NEXT_PUBLIC_SHOP_URL=http://localhost:3004
ENV NEXT_PUBLIC_SHOP_URL=${NEXT_PUBLIC_SHOP_URL}
ARG NEXT_PUBLIC_API_URL=/api
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

# Build workspace packages first (required for workspace dependency resolution)
RUN cd packages/shared && npm run build
RUN cd packages/ui && npm run build

# Build the Next.js application (use pnpm to ensure correct binary resolution)
RUN cd apps/shop && pnpm run build

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
