# Root Scripts Guide

The root `package.json` carries ~65 scripts. This file groups them so you can find the right entry point without reading the whole list (repo-hardening-2026h2 §5.2.3).

## Daily development

| Script | Purpose |
|--------|---------|
| `dev` / `dev:core` / `dev:minimal` | Start the full / core / minimal dev stack |
| `dev:api-only` · `dev:shop-only` · `dev:admin-only` · `dev:packages` | Start a single surface |
| `build` / `build:core` | Build everything / core packages |
| `lint` · `type-check` · `clean` | Static checks and cleanup (`lint` pending ESLint 9 migration) |
| `db:generate` · `db:migrate` · `db:studio` · `db:reset` · `db:seed` | Prisma workflows (see CONTRIBUTING for the drift-check warning) |

## Testing & CI-equivalent gates

| Script | Purpose |
|--------|---------|
| `test` / `test:api:quality` | API suites (CI's api-tests gate ≈ `cd apps/api && npx vitest run tests/`) |
| `test:e2e` (+ `:shop` / `:admin` / `:all` / `:ui` / `:report`) | Playwright end-to-end suites |
| `theme-matrix` (+ `:type-check` / `:validate` / `:ssr`) | Theme matrix gate |
| `surface:generate` / `surface:check` | Theme API surface snapshot |

## Targeted test entry points (subsets of the API suite)

`test:official-artifacts`, `test:self-hosted-detection`, `test:shop-runtime-truth`, `test:admin-market-theme-upgrade`, `smoke:admin-staff-rbac` — convenience filters over vitest/Playwright for one feature area. Safe to run anytime.

## Release verification (one-shot verifiers)

These wrap `scripts/verify-*.mjs` / `scripts/test-verify-*.mjs` — self-contained checks used around OSS releases. They do not publish anything.

- Release pipeline health: `verify:release-quality-gates`, `verify:release-publication-gate`, `verify:release-history-availability`, `verify:public-release-convergence`
- Runtime verification: `verify:live-runtime`, `verify:branded-storefront-runtime`, `verify:admin-quality-gate`
- Cross-client contracts: `verify:theme-clients` (+ `:strict`)
- Self-tests for the verifiers themselves: `test:update-feed-builder`, `test:update-feed-verifier`, `test:public-release-convergence-verifier`, `test:release-history-availability-verifier`, `test:release-helper-quarantine`, `test:live-runtime-verifier`, `test:branded-storefront-runtime-verifier`, `test:updater:docker-compose`

## Release & publishing (manual, deliberate)

| Script | Purpose |
|--------|---------|
| `release:oss:patch` | Prepare an OSS patch release |
| `release:update-feed:build` | Build the self-hosted update feed into `.release/self-hosted` |
| `build:official-artifacts` | Build official theme/plugin artifacts |
| `changeset` · `version:bump` · `release` | Versioning plumbing |

> Releases are intentionally manual — the GitHub workflows that publish images/feeds are `workflow_dispatch`-only.

## Cloudflare Pages

`pages:build:shop` / `pages:build:admin` / `pages:build:all` / `pages:preview:*` — local equivalents of the CF Pages builds (`scripts/cf-pages-build-*.sh`).

## One-off audits

`npx tsx scripts/audit-branches.ts` — branch inventory for `.kiro/specs/repo-hardening-2026h2/branch-audit.md`.
