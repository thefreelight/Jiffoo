# Known Test Failures

> **Date**: 2026-07-13
> **Suite**: `apps/api` — 91 files, 1494 passed / 0 failed / 2 skipped (1496)
> **Status**: Historical technical debt is **cleared**. The suite is expected to be green.
> (Debt history and per-file fix notes live in this file's git history and in
> `.kiro/specs/repo-hardening-2026h2/wip-split-log.md`.)

## Current exemptions (2 skipped)

| Test | Where | Why | Exit condition |
|------|-------|-----|----------------|
| `business JSON operations should use ApiResponse<T> envelope with typed data` | `tests/contract/api-standards.test.ts` | ~200 routes still lack typed response schemas in their OpenAPI declarations (documentation debt, not behavior) | Annotate route schemas, then remove the `.skip` |
| `paging endpoints should return PageResult<T>` | `tests/contract/api-standards.test.ts` | Same as above | Same as above |

Also excluded from vitest discovery (not a failure): `tests/performance/benchmarks.test.ts` — a `node:test` benchmark suite, run via `node --test` when benchmarking (see `vitest.config.ts` exclude).

## How the 2026-07 debt was cleared (summary)

- **State leakage family** (discount-e2e, orders, payments, forecasting flakiness): root cause was cross-suite default-warehouse contention — vitest fixtures and playwright E2E each claim their own default warehouse in the shared `jiffoo_test` database, plus a persistent `warehouse:default` Redis cache (db 15). Both suites now demote other warehouses before claiming the flag and clear `warehouse:*` keys at setup.
- **openapi-contract "empty suites"**: the spec-driven suites silently skipped when `apps/api/openapi.json` was absent. Generate the spec before running (`pnpm --filter api export:openapi`; CI does this in the api-tests job) — 350+ contract tests actually run.
- **official-launch-plugins**: first real end-to-end pass of the official plugin install chain (security scan → trust level → manifest validation → dedicated plugin DB migrations → configure → enable → gateway calls). Required product fixes (install route undefined deref, Prisma engine allowlist, webhook gateway-path validation) and test modernization (artifact-index mock, artifact fixture matching the real builder, current plugin API surface).
- **sendgrid-provider**: removed — it tested a provider module that no longer exists (Resend is the mail provider).

## Adding a new exemption

1. Prefer fixing the test or the code. An exemption is a last resort with an owner and an exit condition.
2. Mark the test `it.skip`/`describe.skip` with a comment pointing at this file and the tracking task.
3. Add a row to "Current exemptions" above with the reason and exit condition.
4. Never exclude whole files in `vitest.config.ts` to hide failures — the only allowed excludes are non-vitest suites (e.g. `node:test` benchmarks) and `tests/e2e/**` (playwright).
