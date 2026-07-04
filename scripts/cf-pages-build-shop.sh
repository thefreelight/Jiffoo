#!/bin/bash
set -e
pnpm --filter shared build
pnpm --filter @jiffoo/ui build
pnpm --filter @jiffoo/core-api-sdk build
pnpm --filter @jiffoo/theme-api-sdk build
pnpm --filter @shop-themes/default build
cd apps/shop
# Remove proxy.ts and install.sh route on CF Pages (they use Node.js APIs incompatible with edge runtime)
rm -f proxy.ts
rm -rf app/install.sh
npx @cloudflare/next-on-pages
