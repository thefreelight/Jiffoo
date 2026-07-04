#!/bin/bash
set -e
pnpm --filter shared build
pnpm --filter @jiffoo/ui build
pnpm --filter @jiffoo/core-api-sdk build
pnpm --filter @jiffoo/theme-api-sdk build
pnpm --filter @shop-themes/default build
cd apps/shop
npx @opennextjs/cloudflare migrate
npx @opennextjs/cloudflare build
