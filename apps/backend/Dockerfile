# Backend Dockerfile
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat openssl openssl-dev
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json pnpm-lock.yaml* ./
COPY packages/shared/package.json ./packages/shared/
RUN npm install -g pnpm@8.15.0 && pnpm i --force

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client
RUN npm install -g pnpm@8.15.0 && pnpm add -w prisma @prisma/client && cd apps/backend && pnpm exec prisma generate

# Skip build for now, run in development mode
# RUN pnpm run build

# Development image, copy all the files and run the app
FROM base AS runner
WORKDIR /app

ENV NODE_ENV development

RUN apk add --no-cache openssl openssl-dev
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 fastify

# Copy the source code and dependencies
COPY --from=builder /app/apps/backend ./apps/backend
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/plugins ./plugins
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml

# Create uploads directory and npm cache
RUN mkdir -p apps/backend/uploads && chown fastify:nodejs apps/backend/uploads
RUN mkdir -p apps/backend/logs && chown fastify:nodejs apps/backend/logs
RUN mkdir -p /home/fastify/.npm && chown fastify:nodejs /home/fastify/.npm

# Install pnpm globally as root before switching user
RUN npm install -g pnpm@8.15.0

USER fastify

EXPOSE 8001

ENV PORT 8001
ENV HOST 0.0.0.0

# Start the server in development mode
CMD ["sh", "-c", "cd apps/backend && pnpm dev"]
