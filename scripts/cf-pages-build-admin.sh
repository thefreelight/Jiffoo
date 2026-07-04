#!/bin/bash
set -e
pnpm --filter shared build
pnpm --filter @jiffoo/ui build
pnpm --filter @jiffoo/core-api-sdk build
pnpm --filter @jiffoo/theme-api-sdk build
cd apps/admin
# Remove proxy.ts on CF Pages (conflicts with edge runtime)
rm -f proxy.ts
npx @cloudflare/next-on-pages
