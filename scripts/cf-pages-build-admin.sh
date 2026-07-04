#!/bin/bash
set -e
pnpm --filter shared build
pnpm --filter @jiffoo/ui build
pnpm --filter @jiffoo/core-api-sdk build
pnpm --filter @jiffoo/theme-api-sdk build
cd apps/admin
npx next build --webpack --experimental-build-mode=compile
npx wrangler pages deploy .next --project-name=jiffoo-admin --branch=main
