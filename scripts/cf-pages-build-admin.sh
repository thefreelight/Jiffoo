#!/bin/bash
set -e
# CF Pages already runs pnpm install, so just build workspace deps
pnpm --filter shared build
pnpm --filter @jiffoo/ui build
pnpm --filter @jiffoo/core-api-sdk build
pnpm --filter @jiffoo/theme-api-sdk build
cd apps/admin
npx next build --webpack --experimental-build-mode=compile
npx @cloudflare/next-on-pages --skip-build
