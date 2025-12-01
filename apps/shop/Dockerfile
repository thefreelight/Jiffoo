# Multi-stage build for Jiffoo Mall Shop Frontend
FROM node:20-alpine AS base

# Build-time proxy configuration
ARG HTTP_PROXY=http://192.168.0.106:7890
ARG HTTPS_PROXY=http://192.168.0.106:7890
ARG NO_PROXY=localhost,127.0.0.1,192.168.0.0/16,10.0.0.0/8

ENV HTTP_PROXY=${HTTP_PROXY}
ENV HTTPS_PROXY=${HTTPS_PROXY}
ENV NO_PROXY=${NO_PROXY}

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@9.0.0

# Copy workspace config files INCLUDING .npmrc
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/shop/package.json ./apps/shop/
COPY packages/shared/package.json ./packages/shared/
COPY packages/shop-themes/default/package.json ./packages/shop-themes/default/

# Install ALL dependencies (with shamefully-hoist from .npmrc)
RUN pnpm install --frozen-lockfile

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app

# Copy ENTIRE node_modules from deps (hoisted to root)
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/shop/node_modules ./apps/shop/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules

# Copy source code
COPY . .

# Set environment variables for build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV BACKEND_SERVICE_URL=http://backend:3001

# Build shared package first
RUN cd packages/shared && npm run build

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
