# Known Test Failures — Pre-existing Technical Debt

> **Date**: 2026-07-06
> **Suite**: `apps/api` — 1142 tests total, 53 failed, 1087 passed, 2 skipped (95.4% pass rate)
> **Status**: All failures are **pre-existing** — they existed before Platform Evolution 2026 H2 work.
> These must be fixed or explicitly skipped before Task 10.2 (Release Gate) can be marked complete.

## Failing Files (14 files, 53 failures)

| # | File | Tests | Failed | Category |
|---|------|-------|--------|----------|
| 1 | `tests/integration/versioning.test.ts` | 34 | 29 | API versioning middleware (x-api-version header, v2 routing) |
| 2 | `tests/core/forecasting-service.test.ts` | 30 | 10 | Forecasting service (mock data drift) |
| 3 | `tests/routes/discount-e2e.test.ts` | 14 | 6 | Discount E2E (database state leakage) |
| 4 | `tests/core/auth-service.test.ts` | 15 | 5 | Auth service (emailVerified column missing in dev DB) |
| 5 | `tests/routes/admin-market-install.test.ts` | 5 | 5 | Plugin market install (signature verification not mocked) |
| 6 | `tests/middleware/deprecation.test.ts` | 27 | 4 | Deprecation middleware (assertion format mismatch) |
| 7 | `tests/contract/openapi-contract.test.ts` | 37 | 2 | OpenAPI contract (schema drift from R3 schema split) |
| 8 | `tests/integration/plugin-compatibility.test.ts` | 29 | 2 | Plugin compatibility (manifest schema evolved) |
| 9 | `tests/middleware/store-context.test.ts` | 2 | 1 | Store context middleware (initialization order) |
| 10 | `tests/routes/market-install-binding.test.ts` | 2 | 1 | Market install binding (signature not mocked) |
| 11 | `tests/plugins/plugin-loader.test.ts` | 40 | 1 | Plugin loader (manifest schema field) |
| 12 | `tests/middleware/versioning.test.ts` | 19 | 1 | Versioning middleware (header assertion) |
| 13 | `tests/routes/seo.test.ts` | 47 | 1 | SEO redirect (non-idempotent, 409 on re-run) |
| 14 | `tests/core/official-artifact-builder.test.ts` | 1 | 1 | Artifact builder (stripe manifest missing) |

## Root Causes

1. **Database schema drift** (auth-service, forecasting, discount-e2e): Local dev DB missing columns/migrations
2. **API versioning refactor** (versioning ×2): Middleware changed but tests not updated
3. **Plugin manifest schema evolution** (plugin-loader, plugin-compatibility, market-install ×2): R2 added trustLevel/runtimeType, old mocks don't provide them
4. **Test isolation** (seo, discount-e2e): Tests don't clean up between runs
5. **Missing fixtures** (official-artifact-builder): stripe plugin manifest not in repo
6. **Assertion drift** (deprecation, store-context, openapi-contract): Implementation changed but assertions not updated

## How to Reproduce

```bash
cd apps/api && npx vitest run tests/
# Expected: 53 failed | 1087 passed | 2 skipped (1142 total)
```

## Action Plan

- **Phase 1**: Add `describe.skip` with issue references to isolate failures from CI signal
- **Phase 2**: Fix categories 1, 4, 5 (database, isolation, fixtures)
- **Phase 3**: Fix categories 2, 3 (versioning, plugin schema)
- **Phase 4**: Fix category 6 (assertion drift)
- **Gate**: All 53 must be resolved (fixed or explicitly waived) before Task 10.2 can be marked `[x]`
