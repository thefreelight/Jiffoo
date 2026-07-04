#!/bin/bash
set -e
pnpm --filter shared build
pnpm --filter @jiffoo/ui build
pnpm --filter @jiffoo/core-api-sdk build
pnpm --filter @jiffoo/theme-api-sdk build
pnpm --filter @shop-themes/default build
cd apps/shop
# Force webpack build (turbopack fails in monorepo on CF Pages)
export NEXT_TURBOPACK=0
npx @cloudflare/next-on-pages --experimental-build-mode=compile
