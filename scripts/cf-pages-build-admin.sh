#!/bin/bash
set -e
pnpm --filter shared build
pnpm --filter @jiffoo/ui build
pnpm --filter @jiffoo/core-api-sdk build
pnpm --filter @jiffoo/theme-api-sdk build
cd apps/admin
npx vercel build --prod
npx @cloudflare/next-on-pages --skip-build
