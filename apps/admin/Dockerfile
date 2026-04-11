# Multi-stage build for Jiffoo Mall Admin (Merchant Admin Panel)
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

# The Admin image only needs Node.js and the standalone Next.js output.
# Install git because Next.js may inspect repository metadata during build.
RUN apk add --no-cache git

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Install pnpm from a vendored tarball so CI does not depend on external npm mirrors.
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# Copy workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/admin/package.json ./apps/admin/
COPY packages/shared/package.json ./packages/shared/
COPY packages/ui/package.json ./packages/ui/

# Install dependencies using a public npm mirror by default.
# CI can still override NPM_REGISTRY when an internal cache is healthy.
RUN pnpm config set fetch-retries 5 && \
    pnpm config set fetch-retry-mintimeout 20000 && \
    pnpm config set fetch-retry-maxtimeout 120000 && \
    pnpm config set registry ${NPM_REGISTRY} && \
    pnpm config set network-concurrency 8 && \
    pnpm config set child-concurrency 4 && \
    pnpm install --filter=admin... --frozen-lockfile

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app

# Install pnpm (needed for build commands) from the vendored tarball.
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# Copy dependencies from deps stage.
# Keep only the workspace root node_modules to avoid duplicate Next.js module
# resolution between /app/node_modules and /app/apps/admin/node_modules.
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/admin/node_modules ./apps/admin/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/packages/ui/node_modules ./packages/ui/node_modules

# Copy source code
COPY . .

# Ensure public directory exists (create empty one if it doesn't exist)
RUN mkdir -p /app/apps/admin/public

# Set environment variables for build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
# Set backend URL for build-time rewrites configuration
# This URL is used by Next.js rewrites to proxy /api/* requests to the backend
# For production: uses K8s internal service name 'api' in jiffoo-mall namespace
# Build ARG allows override during docker build if needed
ARG API_SERVICE_URL=http://api:80
ENV API_SERVICE_URL=${API_SERVICE_URL}

# Build workspace packages first (required for workspace dependency resolution)
RUN cd packages/shared && npm run build
RUN cd packages/ui && npm run build

# Build the Next.js application (use pnpm to ensure correct binary resolution)
RUN cd apps/admin && pnpm run build

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
