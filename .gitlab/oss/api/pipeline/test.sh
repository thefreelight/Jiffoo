#!/usr/bin/env bash
set -euo pipefail

cd "${CI_PROJECT_DIR}"
corepack enable
corepack prepare pnpm@9.0.0 --activate
pnpm install --frozen-lockfile --ignore-scripts
pnpm --filter shared build
pnpm --filter api exec prisma generate
pnpm --filter api exec tsc --noEmit
