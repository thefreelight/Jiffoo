#!/bin/bash
set -e
pnpm --filter shared build
pnpm --filter @jiffoo/ui build
pnpm --filter @jiffoo/core-api-sdk build
pnpm --filter @jiffoo/theme-api-sdk build
pnpm --filter @shop-themes/default build
cd apps/shop
# Remove proxy.ts on CF Pages (it conflicts with edge runtime requirement)
rm -f proxy.ts
npx @cloudflare/next-on-pages
