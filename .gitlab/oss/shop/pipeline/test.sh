#!/usr/bin/env bash
set -euo pipefail

cd "${CI_PROJECT_DIR}"
corepack enable
corepack prepare pnpm@9.0.0 --activate
pnpm install --frozen-lockfile --ignore-scripts
pnpm --filter shared build
pnpm --filter @jiffoo/core-api-sdk build
pnpm --filter @jiffoo/theme-api-sdk build
pnpm --filter ui build
pnpm --filter shop build
