# Multi-stage build for Jiffoo Mall Shop Frontend
FROM node:20-alpine AS base

# Build-time proxy configuration
ARG HTTP_PROXY=http://192.168.0.106:7890
ARG HTTPS_PROXY=http://192.168.0.106:7890
ARG NO_PROXY=localhost,127.0.0.1,192.168.0.0/16,10.0.0.0/8

# Set proxy environment variables for npm
ENV HTTP_PROXY=${HTTP_PROXY}
ENV HTTPS_PROXY=${HTTPS_PROXY}
ENV NO_PROXY=${NO_PROXY}

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@9.0.0

# Copy workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/shop/package.json ./apps/shop/
COPY packages/shared/package.json ./packages/shared/
COPY packages/shop-themes/default/package.json ./packages/shop-themes/default/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app

# Install pnpm in builder stage too
RUN npm install -g pnpm@9.0.0

# Copy ALL node_modules from deps stage (pnpm hoists to root)
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/shop/node_modules ./apps/shop/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules

# Copy source code
COPY . .

# Create shop-themes node_modules symlink for pnpm workspace resolution
RUN mkdir -p packages/shop-themes/default/node_modules && \
    cd packages/shop-themes/default/node_modules && \
    ln -sf ../../../node_modules/.pnpm/clsx@*/node_modules/clsx clsx 2>/dev/null || true && \
    ln -sf ../../../node_modules/.pnpm/framer-motion@*/node_modules/framer-motion framer-motion 2>/dev/null || true && \
    ln -sf ../../../node_modules/.pnpm/lucide-react@*/node_modules/lucide-react lucide-react 2>/dev/null || true

# Set environment variables for build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV BACKEND_SERVICE_URL=http://backend:3001

# Build shared package first
RUN cd packages/shared && npm run build

# Install shop-themes dependencies directly if symlinks failed
RUN cd packages/shop-themes/default && pnpm install --ignore-scripts 2>/dev/null || true

# Build the Next.js application
RUN cd apps/shop && npx next build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1
ENV PORT 3000

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/apps/shop/public ./apps/shop/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/shop/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/shop/.next/static ./apps/shop/.next/static

USER nextjs

EXPOSE 3000

ENV HOSTNAME "0.0.0.0"

CMD ["node", "apps/shop/server.js"]
