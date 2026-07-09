# WIP Split Log — Task 1 (repo-hardening-2026h2)

> Records the verification evidence for each commit of the WIP split (task group 1).
> Branch: `codex/runtime-single-source-truth-wip`. Safety snapshot: `stash@{0}` (`pre-split-snapshot`).

## 1.1 Baseline (2026-07-10, before any commit)

- **Drift check (1.1.3)**: ✅ zero drift — ran `check-drift.sh` against throwaway DB `jiffoo_drift_check` (NOT the dev DB: the script uses `$DATABASE_URL` as Prisma shadow DB, which gets reset).
- **Full API suite (1.1.2)**: `cd apps/api && npx vitest run tests/`
  - Test Files: **5 failed | 82 passed (87)**
  - Tests: **4 failed | 1136 passed | 2 skipped (1142)** — duration 202s
  - The 4 failed tests are all `tests/routes/discount-e2e.test.ts` (known pending item → task 3.2).
  - File-level failures (no test-level failures, pre-existing, → task 3.1 reconciliation):
    - `tests/performance/benchmarks.test.ts` — "No test suite found in file"
    - `tests/plugins/sendgrid-provider.test.ts` — imports missing module `src/plugins/email-providers/sendgrid-provider`
    - `tests/contract/openapi-contract.test.ts` — suite-level hook errors (2 suites)
    - `tests/routes/official-launch-plugins.test.ts` — suite-level hook error
  - **Finding for task 3.1**: `vitest.config.ts` exclude list contains only node_modules/dist/e2e — the "15 excluded files" from KNOWN-FAILURES.md are NOT excluded anymore; total discovered tests = 1142, not the documented 925. The doc is stale.
- **Commit-order correction vs. original plan**: theme contract types + theme packs must land BEFORE shop runtime, because `apps/shop/lib/themes/registry.ts` imports `@shop-themes/app-landingpage/src/runtime`, and theme packs use the new `app-download` archetype from `packages/shared/src/types/theme.ts`. Revised order: ① themes+contract → ② shop runtime → ③ API test debt → ④ admin → ⑤ meta.
- **New guard**: added `.gitignore` rules `packages/shop-themes/*/public/downloads/` + `*.apk` — the new `app-landingpage` package contained a 12MB APK (`public/downloads/EasyEUICC-v1.6.2.apk`) that must not enter git history; binaries belong in release storage.

## 1.3 Commit ①′ — themes (`1c25a62c`, 131 files)

- Scope: theme contract types (`app-download` archetype + app distribution fields), SDK surface snapshot, new `@shop-themes/app-landingpage` package, theme content updates (default/imagic-studio/serene/modelsfind), `.gitignore`, root `package.json` (next 16.0.7 override), `pnpm-lock.yaml`.
- Verified: `pnpm theme-matrix:validate` 73/73; `pnpm theme-matrix:type-check` 2/2; `pnpm surface:check` snapshot matches; app-landingpage discovered by matrix (6/6 manifest checks); no APK/.next staged.
- Note: theme-matrix type-check only covers `@shop-themes/default` + SDK build — the other theme packages are not type-checked by the matrix (potential gap for task 2.1.5 / theme-gate).

## 1.2 Commit ②′ — shop runtime (`3c97d5ca`, 8 files)

- Scope: server store context dedupe (React cache), focus-reload throttling (ThemePackProvider + StoreContextProvider), app-landingpage embedded renderer registration, next.config.js/Dockerfile.
- Verified: shop theme tests 23/24; `pnpm --filter shop type-check` 0 errors.
- **Pre-existing failure** (fails identically without WIP changes, verified via temp stash): `tests/themes/store-context-provider.test.tsx` › "falls back to the server theme slug when no embedded renderer contract is present" — expects `builtin-default`, gets `unknown-market-theme`. Either the fallback semantics changed intentionally (branch is "runtime single source of truth") and the test is stale, or the fallback regressed earlier. Needs an owner decision → tracked as follow-up in task 3.1 notes.
- **Finding**: root script `test:shop-runtime-truth` references 4 test files that do not exist (`theme-pack-loader`, `theme-provider-remote-runtime`, `storefront-runtime-source-of-truth`, `esim-mall-runtime-registry`) — script is aspirational/stale; only 2 of 6 files exist. Fold into task 5.2 script cleanup.

## 1.4 Commit ③ — API test debt (`54e41f48`, 21 files)

- Verified: full suite 1136 passed | 4 failed | 2 skipped (1142); all 4 failures = discount-e2e (task 3.2). Drift check before/after: zero drift.
- File-level errors (pre-existing/environmental, task 3.1): benchmarks (empty suite), sendgrid-provider (imports deleted module), official-launch-plugins (`spawn zip ENOENT`), openapi-contract (2 empty suites when OpenAPI spec absent).

## 1.5 Commit ④ — admin (`3f74d622` + `79f73ea9`)

- `3f74d622`: WIP admin changes as-is (managedPackageApi.provision, useProvisionManagedPackage hook, admin E2E proxy env + click-flow assertions).
- `79f73ea9`: fixes for pre-existing admin type-check failures found during verification:
  1. `lib/store.ts` login: `extendedUserData` read `userData` before its declaration — real TDZ runtime bug on every login, not just a type error.
  2. `lib/api.ts` `OfficialCatalogItem`: missing `solutionOffer`/`solutionPackage` fields already consumed by 4 extension components (types imported from shared).
  3. `InstanceHealthCard`: `resolveApiErrorMessage(err)` missing required `t` arg.
- After fixes: `pnpm --filter admin type-check` 0 errors (also cleared stale local `.next` that referenced deleted staff pages — gitignored artifact).
- Admin E2E full run deferred to 1.7.2 pre-merge regression.
