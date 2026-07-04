#!/bin/bash
set -e
pnpm install --no-frozen-lockfile
pnpm --filter shared build
pnpm --filter @jiffoo/ui build
pnpm --filter @jiffoo/core-api-sdk build
pnpm --filter @jiffoo/theme-api-sdk build
cd apps/admin
npx next build --webpack --experimental-build-mode=compile
npx @cloudflare/next-on-pages --skip-build
