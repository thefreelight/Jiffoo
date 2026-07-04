#!/bin/bash
set -e
pnpm --filter shared build
pnpm --filter @jiffoo/ui build
pnpm --filter @jiffoo/core-api-sdk build
pnpm --filter @jiffoo/theme-api-sdk build
pnpm --filter @shop-themes/default build
cd apps/shop
# vercel build runs `next build` with turbopack by default, which fails in monorepo
# set NEXT_TURBOPACK=0 to force webpack
NEXT_TURBOPACK=0 npx @cloudflare/next-on-pages
