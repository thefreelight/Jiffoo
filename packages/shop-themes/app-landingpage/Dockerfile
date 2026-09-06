ARG NODE_IMAGE=node:20-alpine

FROM ${NODE_IMAGE} AS builder
WORKDIR /workspace

COPY .tools/npm/ .tools/npm/
COPY tsconfig.json ./
COPY packages/shop-themes/app-landingpage/ packages/shop-themes/app-landingpage/

WORKDIR /workspace/packages/shop-themes/app-landingpage
RUN npm ci --workspaces=false --include=dev --legacy-peer-deps
ENV CORE_API_URL=http://api:80
RUN npm run build

FROM ${NODE_IMAGE} AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    CORE_API_URL=http://api:80

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /workspace/packages/shop-themes/app-landingpage/.next/standalone/ ./
COPY --from=builder --chown=nextjs:nodejs /workspace/packages/shop-themes/app-landingpage/.next/static/ ./packages/shop-themes/app-landingpage/.next/static/
COPY --from=builder --chown=nextjs:nodejs /workspace/packages/shop-themes/app-landingpage/public/ ./packages/shop-themes/app-landingpage/public/

USER nextjs
EXPOSE 3000

CMD ["node", "packages/shop-themes/app-landingpage/server.js"]
