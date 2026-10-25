# Coordination Ledger — Jiffoo Core parallel development

**Status:** active
**Purpose:** single shared task ledger for the two parallel lines working on Jiffoo Core.
**Owner of integration merge & push:** the P-3/P-4 main line. The boundary-remediation line
produces **independent commits + verification evidence** and participates in review. Unified merge
is a Git-conflict-avoidance measure only; it is not a seniority relation.

> **Mirror rule.** The canonical copy of this file lives on branch `codex/lane-orders`
> (`docs/coordination-ledger.md`). In the integration worktree
> (`worktrees/jiffoo-core-extension-boundary`) the same path holds a **read-only mirror** for
> immediate visibility: do not commit the mirror from the integration worktree — take the file from
> the lane branch during merge. If the two ever differ, the lane branch wins and the mirror is
> re-synced on the next handoff.

---

## 1. Resource allocation rules

1. **Register before starting.** Every batch is entered in §3 *before* any executor runs.
2. **Real parallelism requires isolation.** Different worktree + different branch + different
   registered lane database. Two sides may never share `jiffoo_core_test`.
3. **Until isolated, one writer and one verifier per worktree.** A worktree has at most one active
   write owner and one active verify owner at any moment.
4. **Overlapping files are serial.** The sets in §4 may not be edited by both sides concurrently.
   Even across isolated worktrees, an interface change needs prior contract agreement.
5. **Sub-executors are bound the same way.** A coordinator may not bypass an occupancy by spawning
   a child thread. Every executor must be told: which files it may change, which database it may
   use, and that it must not commit.
6. **Handover is explicit.** Process exit does not release a worktree. A handover states: draft
   ownership, verification result, unfinished items, usable baseline.

## 2. Current occupancy

| Resource | Holder | Worktree / branch | Test DB | Redis DB | Since |
|---|---|---|---|---|---|
| Write: integration tree | P-3/P-4 main line | `worktrees/jiffoo-core-extension-boundary` / `codex/core-extension-boundary` | `jiffoo_core_test` | 15 | 2026-10-22 |
| Verify: integration tree | P-3/P-4 main line | `worktrees/jiffoo-core-extension-boundary` | `jiffoo_core_test` | 15 | 2026-10-22 |
| Write: orders lane | Boundary-remediation line | `worktrees/jiffoo-lane-orders` / `codex/lane-orders` | `jiffoo_core_test_orders` | 12 | 2026-10-22 |
| Verify: orders lane | Boundary-remediation line | `worktrees/jiffoo-lane-orders` | `jiffoo_core_test_orders` | 12 | 2026-10-22 |
| Plugins lane (third party) | plugins lane | `worktrees/jiffoo-lane-plugins` / `codex/lane-plugins` | `jiffoo_core_test_plugins` | 13 | pre-existing |

Lane registry (`scripts/lane-config.cjs`): `plugins`→13, `orders`→12, `storefront`→11.
`jiffoo_core_test_orders` was provisioned on 2026-10-22 with `scripts/lane-provision.mjs --apply`.

## 3. Batch registry

| Batch | Owner | Branch / worktree | Baseline SHA | Allowed files | Test DB | Executor ID | Status | Handover evidence |
|---|---|---|---|---|---|---|---|---|
| **B-P3P4** — plugin pages P-3/P-4, SDK consumption, imager dependency | P-3/P-4 main line | `codex/core-extension-boundary` / `worktrees/jiffoo-core-extension-boundary` | `49dc5ff1a` | `apps/api/src/core/plugin-pages/**`, `apps/api/src/core/order/{service,idempotency,schemas,types}.ts`, `apps/api/prisma/schema/plugin-pages.prisma`, `apps/api/prisma/migrations/20261022023424_plugin_page_sessions/**`, `packages/shared/src/plugin-pages/**`, `packages/plugin-bridge/**`, `packages/shared/src/{error-codes.ts,i18n/**}`, `apps/shop/app/(storefront)/**`, `apps/shop/components/plugin-*.tsx`, `apps/shop/lib/plugin-pages.ts`, `apps/shop/tests/plugin-pages.test.ts`, `apps/admin/app/[locale]/(themed)/plugins/**`, `apps/admin/components/plugins/Declared*`, `apps/api/src/{server.ts,routes/v1/index.ts,config/env.ts}`, `apps/api/src/core/auth/**`, `apps/api/src/core/account/service.ts`, `apps/api/src/core/admin/{user-management,staff-management,plugin-management,extension-installer}/**`, `scripts/verify*.mjs`, `scripts/cookie-route-inventory.json` | `jiffoo_core_test` (integration) | p3-p4 coordinator (`coordinator-launch.py p3-p4-20261022`, session `01a15dd3-9b82-7443-b67d-6f349fc594b4`) | **draft, uncommitted** | migration `20261022023424_plugin_page_sessions` present and matching the schema; gate blocked on `apps/shop/tests/checkout-contract.test.ts` (see B-BOUND-A) |
| **B-BOUND-A** — cart & inventory write-side consolidation (WP-A) | Boundary-remediation line | `codex/lane-orders` / `worktrees/jiffoo-lane-orders` | `49dc5ff1a` | `apps/api/src/core/cart/service.ts`, `apps/api/src/core/inventory/service.ts`, `apps/api/src/core/product/service.ts`, `apps/api/src/core/admin/product-management/service.ts` | `jiffoo_core_test_orders` | `wp-a-cart-inventory` (pi session `01a1618f-53db-7312-a05c-e79a1bd62a0e`, model `minimax/MiniMax-M3.1-Flash:medium`) | **committed `4d83fa2c6`, merge-ready** (lane gate green, §5) | §5 |
| **B-BOUND-B** — order domain single owner (WP-B) | Boundary-remediation line | `codex/lane-orders` / `worktrees/jiffoo-lane-orders` | `49dc5ff1a` + B-BOUND-A | `apps/api/src/core/order/**`, `apps/api/src/core/payment/**`, `apps/api/src/core/admin/order-management/**`, `apps/api/src/core/notifications/service.ts` | `jiffoo_core_test_orders` | `wp-b-order-domain` (pi session `01a1623c-d126-7486-8e17-bc93fd298db5`, model `minimax/MiniMax-M3.1-Flash:medium`) | **committed `6a99ec298`, merge-ready** (lane gate green, §5b) | §5b |
| **B-BOUND-C** — neutral layer + directory re-layering (WP-C) | Boundary-remediation line | `codex/lane-orders` / `worktrees/jiffoo-lane-orders` | `6a99ec298` | new `apps/api/src/core/shared/**`; move `core/admin/system-settings`→`core/settings`, `core/admin/{plugin-management,extension-installer}`→`core/extensions`; retarget imports in `core/storage/**`, `core/plugin-pages/asset-routes.ts` | `jiffoo_core_test_orders` | `wp-c-neutral-layer` (pi session `01a162d0-2774-7588-9e96-3b543210b169`) | **committed `add8de45b`, merge-ready** (lane gate green, §5c) | §5c |
| **B-BOUND-D1** — audit outlet + dead user module + last core→admin edge (WP-D1) | Boundary-remediation line | `codex/lane-orders` / `worktrees/jiffoo-lane-orders` | `add8de45b` | new `apps/api/src/core/audit/service.ts` + 21 audit call sites; `core/audit/records.ts`; `core/admin/extension-installer/security.ts`→`core/extensions/shared/security.ts`; deleted `apps/api/src/core/user/**` | `jiffoo_core_test_orders` | `wp-d1-audit-outlet` (pi session `01a162ec-e93a-720f-bfe7-43601a8cf294`) | **committed `a65695b70`, merge-ready** (lane gate green, §5d) | §5d |
| **B-BOUND-D2** — the boundary guard (WP-D2) | Boundary-remediation line | `codex/lane-orders` / `worktrees/jiffoo-lane-orders` | `a65695b70` | new `apps/api/tests/core/module-boundary-audit.test.ts`, new `apps/api/tests/core/builtin-plugin-slug-parity.test.ts`, `packages/shared/src/extensions/plugin-contract.ts`, `BUILTIN_PLUGIN_SLUGS` | `jiffoo_core_test_orders` | `wp-d2-boundary-guard` (pi session `01a16309-9c62-71f3-8ccf-114cc071b48d`) | **committed `2c2a40e24`, merge-ready** (lane gate green, §5e) | §5e |
| **B-BOUND-D3** — the last mechanical audit-outlet gap (WP-D3) | Boundary-remediation line | `codex/lane-orders` / `worktrees/jiffoo-lane-orders` | `2c2a40e24` | `apps/api/src/core/admin/storefront-code/service.ts` | `jiffoo_core_test_orders` | `wp-d3-audit-gap` (pi session `01a1633f-…`) | **committed `b55714018`, merge-ready** (lane gate green, §5f) | §5f |
| **B-BOUND-E1** — one public owner for `users` and `auth_tokens` (WP-E1) | Boundary-remediation line | `codex/lane-orders` / `worktrees/jiffoo-lane-orders` | `b55714018` | new `apps/api/src/core/auth/identity-service.ts` + the `core/account`, `core/admin/user-management`, `core/admin/staff-management` and `core/install` call sites | `jiffoo_core_test_orders` | `wp-e1-user-owner` (pi session `01a163e5-…`) | **committed `41d30671c`, merge-ready** (lane gate green, §5h) | §5h |
| **B-BOUND-E2** — the last three table owners (WP-E2) | Boundary-remediation line | `codex/lane-orders` / `worktrees/jiffoo-lane-orders` | `41d30671c` | `apps/api/src/core/settings/**`, `apps/api/src/core/notifications/**`, `apps/api/src/core/audit/**` + their call sites | `jiffoo_core_test_orders` | `wp-e2-table-owners` (pi session `01a163f7-…`) | **committed `ede8a7f3b`, merge-ready** (lane gate green, §5i) | §5i |
| **B-BOUND-E3** — the guard becomes domain-aware (WP-E3) | Boundary-remediation line | `codex/lane-orders` / `worktrees/jiffoo-lane-orders` | `ede8a7f3b` | `apps/api/tests/core/module-boundary-audit.test.ts` | `jiffoo_core_test_orders` | `wp-e3-domain-guard` (pi session `01a1640a-…`) | **committed `ac2fa9b1a`, merge-ready** (lane gate green, §5j) | §5j |
| **B-BOUND-F** — guard blind spot + stale references (WP-F1) | Boundary-remediation line | `codex/lane-orders` / `worktrees/jiffoo-lane-orders` | `c9fdf14d8` | `apps/api/tests/core/module-boundary-audit.test.ts`, `apps/api/src/core/storage/plugin-operation-lease.ts`, `apps/api/src/core/admin/extension-installer/{plugin-migration-executor,plugin-migration-gate,plugin-recovery}.ts`, `apps/api/src/infra/core-process.ts`, `apps/api/src/core/payment/reconciliation.ts`, `apps/api/src/core/cart/service.ts`, `apps/api/src/core/extensions/registry/service.ts`, `docs/coordination-ledger.md`, `AGENTS.md` | `jiffoo_core_test_orders` | `wp-f1-guard-blind-spot` (pi session —, model `minimax/MiniMax-M3.1-Flash:medium`) | **committed `eddea4a9e`, merge-ready** (lane gate green, §5k) | §5k |
| **B-BOUND-G** — plugin marker reclaim through the owning modules | Boundary-remediation line | `codex/lane-orders` / `worktrees/jiffoo-lane-orders` | `c9fdf14d8` | `apps/api/src/core/admin/extension-installer/plugin-marker-reclaim.ts`, `apps/api/src/core/storage/plugin-operation-lease.ts`, `apps/api/src/infra/core-process.ts`, `apps/api/src/core/audit/service.ts` | `jiffoo_core_test_orders` | not assigned | **withdrawn** — its premise is void since B-BOUND-H: the marker reclaim writes into the plugin's own namespace schema, which is not a Core table, so those three writes were never violations (§5g, §5m) | §5g |
| **B-BOUND-H** — Tier 2 cleanup: wrappers, dead inputs, one contract catalogue (WP-F2) | Boundary-remediation line | `codex/lane-orders` / `worktrees/jiffoo-lane-orders` | `eddea4a9e` | `apps/api/src/core/extensions/registry/service.ts`, `apps/api/src/core/{checkout,order,notifications,payment,inventory,audit,settings}/**`, `apps/api/src/core/admin/{extension-installer,product-management,order-management,plugin-management}/**` (+ the deleted `apps/api/src/core/admin/extension-installer/plugin-registry-version.ts`), `packages/shared/src/extensions/plugin-contract.ts`, `apps/api/tests/core/{module-boundary-audit,order-service,payment-routes,startup-plugin-prewarm}.test.ts`, `docs/coordination-ledger.md` | `jiffoo_core_test_orders` | `wp-f2-slop` (pi session `2026-10-23T02-46-35-836Z_01a166a7-323b-70d9-9d8e-76bb06ac8c1`, model `minimax/MiniMax-M3.1-Flash:medium`) | **committed `7a95368e1`, merge-ready** (lane gate green, §5m) | §5m |
| **B-BOUND-J** — the step 1 review follow-up: neutral layer, cross-domain reads, inventory ledger, sharded local gate (WP-F5) | Boundary-remediation line | `codex/lane-orders` / `worktrees/jiffoo-lane-orders` | `0fd920f37` | `apps/api/src/core/{extensions,shared,auth,inventory,order,checkout,payment,notifications,upload,plugins,storage}/**`, `apps/api/src/core/admin/**`, `apps/api/src/infra/**`, `apps/api/src/routes/multipart-content.ts`, `apps/api/tests/core/**`, `scripts/verify-lane-shards.*`, `AGENTS.md`, `package.json`, `docs/coordination-ledger.md` | `jiffoo_core_test_orders` | `wp-f5` (two independent pi reviews, five worker runs, one lane workflow) | **committed `f58c6b49b`, merge-ready** (lane gate green, §5q) | §5q |
| **B-BOUND-I** — step 1 review follow-up: registry projections, dead shims, cycle detection (WP-F3) | Boundary-remediation line | `codex/lane-orders` / `worktrees/jiffoo-lane-orders` | `b133c416f` | `apps/api/src/core/extensions/registry/service.ts`, `apps/api/src/core/{checkout,order,notifications,payment}/**`, `apps/api/src/core/admin/{extension-installer,plugin-management,order-management,product-management,user-management}/**` (+ 12 deleted files), `apps/api/tests/**`, `docs/coordination-ledger.md` | `jiffoo_core_test_orders` | `wp-f3` (two pi subagent runs: `worker` for the source side, `worker` for the guard) | **committed `76b4aa807`, merge-ready** (lane gate green, §5n) | §5n |
| **B-BOUND-B** — order domain single owner (WP-B) | Boundary-remediation line | `codex/lane-orders` | `49dc5ff1a` + B-BOUND-A | `apps/api/src/core/order/**`, `apps/api/src/core/payment/{reconciliation,session,order-paid-event}.ts`, `apps/api/src/core/admin/order-management/**`, `apps/api/src/core/notifications/service.ts` | `jiffoo_core_test_orders` | `wp-b-order-domain` | **superseded** — the batch ran as `wp-b-order-domain`, **committed `6a99ec298`**; the executed row is above | §5b |
| **B-BOUND-C** — neutral layer + directory re-layering (WP-C) | Boundary-remediation line | `codex/lane-orders` | `6a99ec298` | new `apps/api/src/core/shared/**`; move `core/admin/system-settings`→`core/settings`, `core/admin/plugin-management`+`extension-installer`→`core/extensions`; retarget imports in `core/storage/**`, `core/plugin-pages/asset-routes.ts` | `jiffoo_core_test_orders` | `wp-c-neutral-layer` | **superseded** — the batch ran as `wp-c-neutral-layer`, **committed `add8de45b`**; the executed row is above | §5c |
| **B-BOUND-D** — audit outlet, dead code, boundary guard, plugin risk register (WP-D) | Boundary-remediation line | `codex/lane-orders` | `add8de45b` | new `apps/api/src/core/audit/service.ts` + 9 audit call sites; delete `apps/api/src/core/user/`, `apps/api/src/core/order/hooks.ts`; new `apps/api/tests/core/module-boundary-audit.test.ts`; `docs/agentra-001-core-v1-product-charter.md`; `packages/shared/src/extensions/plugin-contract.ts`; `BUILTIN_PLUGIN_SLUGS` → `@jiffoo/shared` | `jiffoo_core_test_orders` | `wp-d1-audit-outlet`, `wp-d2-boundary-guard`, `wp-d3-audit-gap` | **superseded** — the batch ran as three executors, **committed `a65695b70` / `2c2a40e24` / `b55714018`**; the executed rows are above | §5d, §5e, §5f |
| **B-ORCH** — orchestration config + architecture guardrails | Boundary-remediation line | `codex/lane-orders` | `49dc5ff1a` | `.pi/settings.json`, `.gitignore`, `AGENTS.md`, `docs/coordination-ledger.md` | n/a | orchestrator session | **committed `6c838d865`** | §6 |

## 4. Serial overlap set — never edited by both sides at once

| Path | Why | Agreement needed before editing |
|---|---|---|
| `apps/api/src/core/order/**` | B-P3P4 added `pluginPurchaseOrigin` binding + return target (3 lines in `service.ts`, plus `idempotency/schemas/types`); B-BOUND-B owns the order state machine | **B-P3P4 × B-BOUND-B**: the 3 P-3 lines stay untouched by WP-B; WP-B must not move the `bindPurchaseOrigin` call out of the order transaction |
| `apps/api/src/core/auth/**` | plugin-page token / strict identity work (P-3) | serial |
| `packages/shared/**` | `plugin-pages` types, `error-codes`, i18n, `plugin-contract.ts` | serial; a shared change re-expands the mandatory verification gate for every consumer |
| `packages/plugin-sdk/**`, `packages/plugin-bridge/**` | SDK consumption delivery | P-3/P-4 owns |
| `apps/api/prisma/**` | schema + migration ledger; one migration per change, timestamps ordered | serial |
| `scripts/verify*.mjs`, `scripts/lane-config.*`, `scripts/cookie-route-inventory.json` | the verification gate itself | serial — a gate change silently changes both sides' results |
| `apps/api/src/routes/v1/index.ts`, `apps/api/src/server.ts` | route/hook registration | serial |
| `apps/shop/**`, `apps/admin/**` | storefront + admin shells | P-3/P-4 owns |
| `apps/api/tests/core/module-state-audit.test.ts` | static scenario-12/15 allowlist; both sides add module state | serial |

## 5b. Handover evidence — B-BOUND-B (order domain single owner)

**Commit:** `6a99ec298` on `codex/lane-orders`. 8 files changed, +674 / −389, plus the new
`apps/api/src/core/payment/service.ts` (262 lines). No schema change, no migration, no route,
envelope, error-code or status-code change, no test file touched.

**Table ownership after this package (verified by the orchestrator, independently of the executor):**

| Table | Writers found by `grep -rnE "\b(tx\|prisma)\.<table>\.(create\|update\|updateMany\|delete\|deleteMany\|upsert)"` |
|---|---|
| `orders` | `core/order/service.ts` only (11 sites) |
| `order_items`, `order_shipping_addresses` | nested create inside `core/order/service.ts` `tx.order.create` |
| `order_status_history` | `core/order/status-history.ts` only |
| `shipments`, `shipment_items` | `core/order/service.ts` only |
| `payments` | `core/payment/{observations,reconciliation,service,session}.ts` |
| `payment_ledgers` | `core/payment/{reconciliation,service,session}.ts` |
| `refunds`, `refund_ledgers` | `core/payment/service.ts` only (were admin-only) |

`core/admin/order-management/service.ts` writes **none** of them. The parallel order state machine
in the admin module is gone. `core/payment/**` imports **no** order-internal helper.

**New public API**
- `core/payment/service.ts` → `PaymentService.cancelPendingForOrder`,
  `getOrderPaymentSummary`, `refundOrder`, `resolveRefundRequiredPayment`
- `core/order/service.ts` → `OrderService.applyPaymentSucceeded`, `applyPaymentFailed`,
  `recordPaymentAttempt`, `markRefunded`, `shipOrder`, `deliverOrder`, `cancelOrderByAdmin`,
  `getOrderProjection`, `catalogSnapshotView`

**Status-history actor identity preserved exactly** (a nullable column; the old rows store NULL):
ship / deliver / admin cancel still write `actorType: 'admin'` with no `actorId`; the admin refund
still writes the administrator id and `metadata: { refundId }`.

**Gate** (lane `orders`, `jiffoo_core_test_orders`, Redis DB 12):

```
=== Final test summary ===
Scope: default
Lane: orders
Database: jiffoo_core_test_orders
Planner added suites: none
Run API tests:
   Start at  15:32:25
 Test Files  21 passed (21)
      Tests  323 passed (323)
Run Admin tests:
   Start at  15:38:55
 Test Files  3 passed (3)
      Tests  26 passed (26)
Run Shop tests:
   Start at  15:38:57
 Test Files  2 passed (2)
      Tests  3 passed (3)

| Step | Result | Duration |
| --- | --- | --- |
| Prisma generate | PASS | 0.01s |
| Type-check API, Admin, Shop and shared | PASS | 15.67s |
| Lint Shop | PASS | 10.62s |
| Reset test database | PASS | 3.99s |
| Run API tests | PASS | 389.33s |
| Run Admin tests | PASS | 2.31s |
| Run Shop tests | PASS | 1.71s |
```

Exit code 0. The planner added 13 authentication suites (the changed file
`core/payment/session.ts` matches its `/session/i` rule) and they ran and passed.

**Executor-reported deviations from the task contract (all accepted, none behavioural):**
`PaymentStatus` is a const object, not a type — the type is `PaymentStatusType`; the admin
"NOT_CHARGED" review resolution has no slot in the mandated `PaymentService` shape, so
`recordPaymentNotCharged` was added as a public export of the payment module; `getSellableCatalog`
had to switch from a `select` shape to `include: { variants: true }` plus a second translations
query because `tests/core/order-service.test.ts` asserts the exact product read — the projection now
costs two queries; `apps/api/openapi.json` (a gitignored artifact) had to be generated with
`pnpm --filter api export:openapi` for the state-machine suite; `tests/core/event-delivery.test.ts`
→ "measures the real claim query over 100000 due rows" timed out in one of three runs and passed
in the other two (a load-dependent performance test, unrelated to this change).

## 5c. Handover evidence — B-BOUND-C (neutral layer + dependency direction)

**Commit:** `add8de45b` on `codex/lane-orders`.

**What moved (renames, not copies):**
- `core/payment/locks.ts` → `core/shared/locks.ts` (the order row lock was owned by the payment module)
- `core/payment/minor-units.ts` → `core/shared/money.ts`
- `core/order/current-pricing.ts` → `core/shared/pricing.ts`
- `core/admin/system-settings/{service,schemas}.ts` → `core/settings/`
- `core/admin/extension-installer/{utils,types,errors,version-utils}.ts` → `core/extensions/shared/`
- new `core/extensions/registry/` owns the read-only extension provider queries
  (`listProviders`, `resolveSingleProvider`, `getAllPluginPackages`, `getDefaultInstance`)

Every old path keeps a re-export shim, so no consumer import and no test import had to change.
The only test edits were nine lines across three files: the `vi.mock` paths and the matching
`import` paths for the two moved modules. The state-audit allowlist changed by exactly seven
renames, in place, not re-sorted.

**Orchestrator-verified after the merge:**
- no module under `apps/api/src/core/` outside `core/admin/**` imports
  `@/core/admin/system-settings/**` or `@/core/admin/plugin-management/**` — **the commerce → admin
  dependency inversion is gone**
- `core/extensions/**` has no import of `@/core/admin/extension-installer/**`
- the three test files changed by exactly 9 lines, all of them mock/import paths

**Gate:** API 26 files / 464 tests passed, Admin 3 files / 26 tests passed, Shop 2 files / 3 tests
passed; all steps PASS; exit code 0.

**Residual found by the orchestrator after the merge** (folded into B-BOUND-D1): `core/extensions/
shared/utils.ts` still reached `extension-installer/security` through a **dynamic** `import()` —
a static import scan misses it. Closed in `a65695b70`.

## 5d. Handover evidence — B-BOUND-D1 (audit outlet + dead user module + last core→admin edge)

**Commit:** `a65695b70` on `codex/lane-orders`.

- new `core/audit/service.ts` — `AuditService.write(tx, entry)` is now the **only** place that
  writes an admin audit event (orchestrator-verified: the only remaining
  `adminAuditEvent.create` / `adminAuditEvent.upsert` calls in `apps/api/src` are the three inside
  that file). 21 write sites across 12 files now call it.
- `core/admin/audit-events/records.ts` → `core/audit/records.ts`, **byte-identical** (same git
  blob `5deda49c`), with a shim at the old path; the admin HTTP surface stays put.
- `writePluginAudit` and the theme runtime's `audit()` keep their exported names and behaviour
  (including the `writePluginAudit` test barrier); only the final write delegates.
- `apps/api/src/core/user/` deleted — it had no consumer at all.
- `core/admin/extension-installer/security.ts` → `core/extensions/shared/security.ts` (shim kept),
  so `core/extensions/**` no longer imports the installer folder **at all**, dynamic import
  included.
- The state-audit allowlist changed by exactly four lines: two keys renamed, two dead `core/user`
  keys removed.

**Gate:** API 22 files / 350 tests passed, Admin 3 files / 26 tests passed, Shop 2 files / 3 tests
passed; all steps PASS; exit code 0.

## 5e. Handover evidence — B-BOUND-D2 (the boundary guard)

**Commit:** `2c2a40e24`. New `apps/api/tests/core/module-boundary-audit.test.ts` (650 lines, 8
assertions) and `apps/api/tests/core/builtin-plugin-slug-parity.test.ts`.

The guard has two independent static checks over `apps/api/src/core/**`:
1. **cross-module import graph** — every `@/core/...` import is resolved to the module it reaches
   and compared with an explicit allowlist of legal edges (each with a reason); an import that does
   not bind to a **public export** of the target module is rejected by a separate assertion.
2. **cross-domain table writes** — table ownership is derived from the Prisma schema; a write to a
   table from a module that does not own it is a violation. Reads are not violations.

Every residual is listed in a `knownViolations` array anchored to file, table/module, reason and
owning batch, and the list is required to stay anchored to real violations so it cannot go stale.

**The guard was verified non-vacuous** (orchestrator): a temporary probe file in `core/cart/` that
imported another module's private helper and wrote a foreign domain's table made **three** of its
assertions fail; deleting the probe restored green. The probe was removed — no tracked file was
touched by the probe.

Also in this commit: `BUILTIN_PLUGIN_SLUGS` consolidated into `@jiffoo/shared` (installer, upload
validator and SDK scaffold now share one constant, SDK still self-contained); the
`PluginContext.database` comment made precise; a `Plugin Trust Model in V1` note added to the
charter §3, stating the accepted in-process model and pointing at the concrete code locations.

**Gate:** API PASS, Admin PASS, Shop PASS; all steps PASS; exit code 0.

## 5f. Handover evidence — B-BOUND-D3 (last mechanical audit-outlet gap)

**Commit:** `b55714018`. `admin/storefront-code/service.ts` now imports `AuditService` from
`@/core/audit/service` instead of the `audit` helper that lived in the theme runtime, so the
`admin/storefront-code -> admin/extension-installer` edge is gone and the guard's
`knownViolations` list loses that entry.

**Gate:** API PASS (13.70s); all steps PASS; exit code 0.

## 5g. The boundary audit result — what is still open

**State after batches B-BOUND-A … B-BOUND-E3 and the Tier 2 cleanup (WP-F2): 23 known violations → 2.** The five that were registered after B-BOUND-F were the ones the guard could see. B-BOUND-F (§5k) closed the three stray writers among them and, in the same batch, removed the guard's blind spot — so the list became **5 registered violations again, but a different five**, and every one of them was real, registered, and anchored to a file and a table.

The Tier 2 cleanup (WP-F2) corrected that raw-SQL pattern once more. A raw write is a write to a **Core** table only when the matched path is unqualified (the Core connection resolves it in `public`) or qualified with the literal schema `public`. A path qualified with any other schema — the marker reclaim writes into the plugin's own namespace schema — is a write into that namespace, not into a Core table, so those entries were never violations. The list is now **2 registered violations**, and both of them are real, registered, and anchored to a file and a table.

| # | File | Table | Nature | Owner / next step |
|---|---|---|---|---|
| 1 | `admin/extension-installer/plugin-migration-executor.ts` | `admin_audit_events` | **legitimate exception** — raw SQL inside a manual `pg` transaction that provisions a plugin schema; a Prisma-based outlet cannot join it | keep registered |
| 2 | `inventory/service.ts` | `product_variants` | **column-level ownership split** — the product domain owns the variant row, the inventory domain owns the `stock` column; a table-level owner map cannot express that | either accept the split explicitly or give the stock column its own owner |

Items 1–3 of the old list (the migration gate, the recovery sweep and the migration executor
writing `plugin_operation_leases` and `core_processes` directly) were the same shape as the work
already done and **are closed in B-BOUND-F**: the three writes now go through the storage lease
API and the infra process registry.

Items 3–5 of the B-BOUND-F list were **invisible to the old guard**. Its raw-SQL pattern required the
table to be spelled `public.<table>`, so an unqualified `UPDATE plugin_operation_leases …` and a
schema given as a template variable (`DELETE FROM "${schema}".plugin_operation_leases`) were never
reported. B-BOUND-F broadened the pattern to take the last identifier of any qualified path, which
registered those three entries — but the broadened pattern also reported writes into a plugin's own
namespace schema as writes to a Core table. They are not: the marker reclaim deletes the lease rows
and confirms the dead process rows of the **plugin namespace**, and the charter explicitly allows
that ("the package-derived default schema is a naming convention, not a permission boundary"). The
corrected pattern skips every path that is qualified with a schema other than `public`, so those
three entries are withdrawn and the two entries above are what remains.

**B-BOUND-G is withdrawn with them.** That registered follow-up batch existed to route the three
marker-reclaim writes through their owning modules. They were never violations — they write into
the plugin's own namespace schema — so there is nothing left for the batch to do. It is closed
without ever being started (§3, §5m).

Item 2 is the one remaining **decision**: does the `stock` column belong to the product domain or
to the inventory domain? The current code and the guard both put the row in the product domain and
the column in the inventory domain. **Recommendation: keep the split and record it in the guard's
owner map as a column-level exception**, because the inventory module is the only writer of
`stock` and the product module is the only writer of the rest of the row, and both behaviours are
correct.

**What is tracked now.** Every remaining violation is in the guard with a reason and an owner, so
it is visible in CI and cannot silently grow. The pattern now sees the unqualified and the
`public`-qualified raw writes and skips the writes into a plugin namespace schema, so a new stray
writer of either shape fails the guard instead of slipping through.

## 5h. Handover evidence — B-BOUND-E1 (one public owner for `users` and `auth_tokens`)

**Commit:** `41d30671c`.

**Decision taken, and the change from the earlier recommendation.** The ledger previously
recommended a new `core/user` module. The guard's own `TABLE_OWNERS` already declared
`users: 'auth'` and `auth_tokens: 'auth'` — the auth module is where identity, credentials and
sessions already live. Creating a separate `core/user` module would have meant relocating the
most security-sensitive writes in the repository (login, registration, email verification,
password reset, token issuance) for a naming benefit only, with no change in the number of
modules or in the single-owner rule. The smaller, safer change that satisfies the same rule was
taken instead: **`core/auth` is the one public owner**, and it now exposes the row operations the
other modules need.

- new `apps/api/src/core/auth/identity-service.ts` → `AuthIdentityService` with
  `updateProfile`, `removeAvatar`, `changeEmail`, `deactivateCustomer`, `createCustomer`,
  `updateCustomer`, `deleteCustomer`, `createStaff`, `removeStaff`, `reinviteStaff`,
  `revokeStaffInvites`, `createBootstrapAdmin` — each performing exactly the Prisma write it
  replaces.
- `core/account`, `core/admin/user-management`, `core/admin/staff-management` and `core/install`
  call that API. Every `where` guard is preserved (customer update and delete stay scoped to
  `role: 'USER'`, staff token revocation stays scoped to the `STAFF_INVITE` purpose).
- `core/auth`'s own flows are unchanged.

**Orchestrator-verified:** after the change, the only modules writing `users` or `auth_tokens` are
under `core/auth/**`. The guard's known-violations list lost five entries (23 → 18).

**Gate:** API PASS (80.40s), Admin PASS, Shop PASS; exit code 0.

## 5i. Handover evidence — B-BOUND-E2 (the last three table owners)

**Commit:** `ede8a7f3b`.

- `system_settings` → owned by `core/settings`. The api-token module and the installer now call
  public settings operations; the api-token read-modify-write on the settings blob (including its
  `JSON.stringify` and the cache invalidation that follows) is preserved exactly.
- `notifications` → owned by `core/notifications`. The admin **resend** operation moved into the
  notifications module as a public method that performs the same create + dedup-key update in the
  same order; the route's HTTP behaviour is unchanged.
- `admin_staff_audit_logs` → owned by `core/audit`. The audit outlet now covers the legacy staff
  audit table as well, and the four writers that reached around it (builtin sync, theme service,
  staff management, account recovery) call the outlet. Each call site keeps writing exactly the
  fields it wrote before — the admin audit API unions the two tables, so a renamed field would
  change the admin history. The two tables are not merged.

**Orchestrator-verified:** `system_settings` is written only by `core/settings/service.ts`,
`notifications` only by `core/notifications/service.ts`, `admin_staff_audit_logs` only by
`core/audit/service.ts`. The guard's known-violations list lost eight entries (18 → 10).

**Gate:** API PASS (96.46s), Admin PASS, Shop PASS; exit code 0.

## 5j. Handover evidence — B-BOUND-E3 (the guard becomes domain-aware)

**Commit:** the last commit on `codex/lane-orders`.

The guard's owner map gave every table one owning module. That is right for the commerce domain
and wrong for the extension domain, which is deliberately split across the installer, plugin
management and the durable task engine — producing eight known violations that were a granularity
mismatch, not defects.

- `TABLE_OWNERS` may now name a **domain**. `DOMAIN_MEMBERS.extensions` = the three extension
  modules; `DOMAIN_TABLES.extensions` records which tables the domain owns, so it cannot silently
  acquire a table it does not own.
- `plugin_installations`, `plugin_installs` and `plugin_task_execution_slots` are now owned by the
  domain. `plugin_operation_leases` stays owned by `storage` and `core_processes` by `infra`:
  their remaining cross-module writers are **real** violations, so they keep a module owner and
  stay registered.
- A new assertion, `keeps the domain model safe and free of loopholes`, fails the guard if a
  domain has no members, if a member is not a real module, if a member is a commerce module, if a
  table is assigned to a domain it does not declare, if a declared table is owned by something
  else, or if a domain member writes a table the domain does not own.

**Orchestrator-verified non-vacuous twice** (temporary probe files, removed afterwards):
a cart write from the order module, and an order write from the `plugins` domain member, were
both rejected with the owning module named — the second one by the write check **and** by the new
loophole assertion.

**Gate:** API PASS (5.90s); exit code 0.

## 5k. Handover evidence — B-BOUND-F (the guard's blind spot and the stale references)

**State:** committed as `eddea4a9e` on `codex/lane-orders` (lane gate green, §5k).

**Superseded in part.** The raw-SQL pattern described in §1 below was corrected again by
B-BOUND-H (§5m): a write into a plugin namespace schema is not a write to a Core table. §5g
carries the current list.

**1 — the guard's blind spot (`apps/api/tests/core/module-boundary-audit.test.ts`).**
The raw-SQL pattern required the table to be spelled `public.<table>`, so an unqualified
`UPDATE plugin_operation_leases …` and a schema given as a template variable
(`DELETE FROM "${schema}".plugin_operation_leases`) were invisible. The pattern now takes an
optional schema qualifier (`public`, `"public"`, `"${schema}"`, or none) and extracts the **last**
identifier of the qualified name as the table; the `if (!tables.has(table)) continue;` filter is
kept, so a word that is not a table (`UPDATE SET`, a column name) is still ignored. The
`raw SQL against public.<table>` label and the reported file/line are unchanged.

**2 — the three stray writers are now routed through their owners.**

| Write | New owner operation | Caller |
|---|---|---|
| `plugin-migration-executor.ts` — `UPDATE plugin_operation_leases …` | `renewPluginOperationLease(client, …)` in `core/storage/plugin-operation-lease.ts` | `renewPluginMigrationLease` |
| `plugin-migration-gate.ts` — `INSERT INTO public.plugin_operation_leases …` | `insertPluginOperationLease(client, …)` in `core/storage/plugin-operation-lease.ts` | `withPluginMigrationGate` |
| `plugin-recovery.ts` — `DELETE FROM public.core_processes p …` | `pruneCoreProcesses(client, limit)` in `apps/api/src/infra/core-process.ts` | `sweepPluginRecovery` |

The owner operations take the client the caller already has, so the write stays inside the
caller's transaction, and they keep the SQL exactly as it was (same columns, same predicates, same
row counts, same ordering). The two `plugin_operation_leases` model writes that the installer
performed directly — the lease release in `updateOwnedPluginMigrationOperation`, the marker release
in `withPluginMigrationGate` and the lease release in `recoverPluginOperation` — now go through
`releasePluginOperationLeaseWith(client, …)` in the storage module as well, because the
`plugin_operation_leases` entries could only be removed once no write of that table was left in
the installer.

**3 — the known-violation list.** The three entries for `plugin_operation_leases` (gate) and
`core_processes` (recovery) are gone; they no longer match a real violation. The
`admin_audit_events` entry (the raw-SQL migration executor) and the `product_variants` entry stay.
The guard still requires every remaining entry to be anchored to a real violation, so the list
cannot go stale.

**4 — the stale references.** The ledger's §3 batch rows now carry all nine cells; `AGENTS.md`
names `core/shared/locks.ts` (the real home of the row locks) instead of the one-line re-export
shim `core/payment/locks.ts`; the guard's commerce module list no longer names the deleted
`core/user` module; the guard uses the shared `apiSourceFiles` helper instead of a hand-copied
walk and no longer asserts filler thresholds; the `payment.succeeded` payload throws
`ApiError('NOT_FOUND')` instead of degrading a missing order into `userId: ''`; a cart line whose
variant is not in the catalog is an error instead of a free line; and
`core/extensions/registry/service.ts` no longer validates the constant `'default'` against
itself.

**Deviation — one thing the task description did not anticipate.**
The task expected the fixed pattern to surface exactly three writes. It surfaces **six**: the
three above and three more in `admin/extension-installer/plugin-marker-reclaim.ts`
(`DELETE FROM "${schema}".plugin_operation_leases`, `UPDATE "${schema}".core_processes`,
`INSERT INTO "${schema}".admin_audit_events`). Those are the writes of the operator-driven marker
reclaim, which runs on a dedicated `pg` connection in its own manual transaction and therefore
cannot join the Prisma transaction of the storage, infra or audit owner — the same shape as the
`admin_audit_events` exception that was already registered. The file is outside this batch's
allowed file set, so the three writes are **registered** as known violations with a reason and an
owner (B-BOUND-G) instead of being routed. The registered list is therefore 5 entries again, but
a different five; §5g carries the new table.

**Gate** (lane `orders`, `jiffoo_core_test_orders`, Redis DB 12):

```
=== Final test summary ===
Scope: default
Lane: orders
Database: jiffoo_core_test_orders
Planner added suites: none
Run API tests:
   Start at  10:42:13
 Test Files  8 passed (8)
      Tests  153 passed (153)

| Step | Result | Duration |
| --- | --- | --- |
| Prisma generate | PASS | 0.01s |
| Type-check API, Admin, Shop and shared | PASS | 3.38s |
| Lint Shop | PASS | 10.04s |
| Reset test database | PASS | 3.25s |
| Run API tests | PASS | 116.43s |
```

Exit code 0. `Planner added suites: none` — no foreign change expanded the selection.

**Non-vacuity probe.** With the three raw writes temporarily put back into the three installer
files, the guard failed with exactly this output (probe removed afterwards, no tracked file was
left changed):

```
admin/extension-installer/plugin-migration-executor.ts:63 writes "plugin_operation_leases" (raw SQL against public.plugin_operation_leases) but the table is owned by "storage"
admin/extension-installer/plugin-migration-gate.ts:77 writes "plugin_operation_leases" (raw SQL against public.plugin_operation_leases) but the table is owned by "storage"
admin/extension-installer/plugin-recovery.ts:76 writes "core_processes" (raw SQL against public.core_processes) but the table is owned by "infra"
```

The first line is the write that the old pattern could not see at all.

## 5m. Handover evidence — B-BOUND-H (the Tier 2 cleanup: wrappers, dead inputs, one contract catalogue)

**Commit:** `7a95368e1`. **State:** committed on `codex/lane-orders`, **not pushed**. The merge is
the P-3/P-4 main line's job.

**1 — where this batch came from.** Two fresh-context, read-only reviewers ran over
`git diff 49dc5ff1a..HEAD` of this branch: a **deslop** pass (15 findings) and a **verbosity**
pass (13 findings). The decision was to apply only the findings worth doing now — Tier 1 and
Tier 2 — and to leave the optional ones alone. The batch below is exactly that set; the
executor's task book was `tmp/wp-f2-task.md` (F2-1 … F2-13).

**2 — what was applied.**

| # | Change | Where |
|---|---|---|
| 1 | The registry publishes its four reads once: the `PluginManagementService` class that only delegated to the four module functions is gone, and the four commerce callers import the functions | `core/extensions/registry/service.ts`, `core/{checkout,order,notifications,payment}/**` |
| 2 | The one-line `incrementPluginRegistryVersion` wrapper is deleted; its call sites call the settings service that owns the `system_settings` row | `core/admin/extension-installer/plugin-registry-version.ts` (deleted), `plugin-fs-installer.ts`, `admin/plugin-management/service.ts`, `tests/core/startup-plugin-prewarm.test.ts` |
| 3 | The notifications module no longer reads the `users` table for the recipient address; it consumes the order module's `getOrderRecipient` projection, which keeps the `customerEmail → account email → ''` precedence | `core/notifications/service.ts`, `core/order/service.ts` |
| 4 | The capability-contract catalogue is published once, from the shared package; the registry and the contract runtime read the version from it | `packages/shared/src/extensions/plugin-contract.ts`, `core/extensions/registry/service.ts`, `core/admin/extension-installer/contract-v1-runtime.ts` |
| 5 | The copy-pasted refund idempotency preamble is one private helper | `core/payment/service.ts` |
| 6 | The two dead inputs of `refundOrder` are gone; the audit metadata that is written is unchanged | `core/payment/service.ts`, `core/admin/order-management/service.ts` |
| 7 | The dead members of the structural transaction types are gone; the two that are used became their own intersection type (`OrderTransitionTx`, `PaymentAuditTx`), so the member list still catches a typo | `core/{order,payment,inventory}/service.ts` |
| 8 | The audit outlet has two methods instead of a control flag inside the data type | `core/audit/service.ts`, `core/admin/extension-installer/plugin-audit.ts` |
| 9 | The comment that was repeated three times is kept once | `core/admin/product-management/service.ts` |
| 10 | The settings payload is built once, and the single-use transaction type is replaced by the module's own client type | `core/settings/service.ts` |
| 11 | The single-use helper with the hand-rolled count is one expression | `core/order/service.ts` |
| 12 | The guard drops the check that another check already makes, the dead `knownEdges` list and the doc comment that did not match the code | `tests/core/module-boundary-audit.test.ts` |
| 13 | The raw-SQL pattern no longer reports a plugin-namespace write as a Core write; the three entries it had registered for the marker reclaim are withdrawn | `tests/core/module-boundary-audit.test.ts`, §5g |

**3 — what was deliberately NOT applied, and why.**

| Finding | Disposition |
|---|---|
| the `getVariantStockMap` helper is a one-line pass-through | **rejected — factually wrong**: the helper has four call sites, so inlining it removes nothing |
| replace the `args: any` transaction bags with `Pick<Prisma.TransactionClient, …>` | **deferred — it does not compile**: Prisma's `InternalArgs` and `DefaultArgs` do not match the extended client |
| one catalog query instead of two | **deferred — blocked**: `tests/core/order-service.test.ts:254` asserts the exact `findMany({ include: { variants: true } })` shape |
| the parity test's literal slug list | **intentional**: the literal list is the test's independent oracle; a shared constant would make the assertion tautological |
| the deeper type remedy, the commit-message length, the charter/comment duplication | **declined as optional** |

**4 — the guard's state.** Two registered violations remain (§5g): the raw-SQL `admin_audit_events`
write in `plugin-migration-executor.ts` and the `product_variants` stock-column split in
`inventory/service.ts`. The ownership check is unchanged: every table has exactly one writing
module, and `product_variants` has the two that the recorded column-level decision allows.

**5 — the gate** (lane `orders`, `jiffoo_core_test_orders`, Redis DB 12):

```
=== Final test summary ===
Scope: default
Lane: orders
Database: jiffoo_core_test_orders
Run API tests:
   Start at  13:38:29
 Test Files  164 passed (164)
      Tests  2374 passed | 2 skipped (2376)
Run Admin tests:
   Start at  14:17:17
 Test Files  58 passed (58)
      Tests  570 passed (570)
Run Shop tests:
   Start at  14:17:45
 Test Files  32 passed (32)
      Tests  240 passed (240)

| Step | Result | Duration |
| --- | --- | --- |
| Prisma generate | PASS | 0.01s |
| Type-check selected scope and shared | PASS | 3.44s |
| Lint Shop | PASS | 9.87s |
| Reset test database | PASS | 3.89s |
| Run API tests | PASS | 2328.54s |
| Run Admin tests | PASS | 28.36s |
| Run Shop tests | PASS | 27.13s |
```

Exit code 0. The planner expanded the selection because `packages/shared` changed, so the API
suite ran in full (164 files) next to the admin and shop suites.

**Two earlier attempts failed on one timing-sensitive fixture, not on a defect.**
`tests/core/plugin-recovery.test.ts` waits with a 15-second wall-clock deadline for a forked child
process to reach a migration barrier. Both failures were that deadline
(`Recovery fixture timed out waiting for plugin-migration-barrier`), and both happened while the
P-3/P-4 integration tree was running its own `verify.mjs --quick` on the same machine
(12:51–13:37). The third attempt, on an idle machine, passed the whole suite. **Do not run the
two gates at the same time**; this fixture needs the machine.

**6 — one integration hazard.** This batch deletes
`apps/api/src/core/admin/extension-installer/plugin-registry-version.ts` and repoints its call
sites to `systemSettingsService.incrementPluginRegistryVersion(tx)`. The P-3/P-4 main line still
imports that module in `plugin-fs-installer.ts`, `admin/plugin-management/service.ts` and
`tests/core/startup-plugin-prewarm.test.ts`, so those three files must be repointed the same way
during the merge — otherwise the merged tree does not compile. That is also why this batch touches
`apps/api/src/core/admin/plugin-management/service.ts` and
`apps/api/tests/core/startup-plugin-prewarm.test.ts`, which are otherwise P-3's files: the change
there is mechanical (the import of the deleted module and its call sites), not a design change.

**7 — what is still open.** The notifications module still reads the `users` table for the
recipient **locale** (`createNotification`). That is a read and not a write, so the guard does not
see it; routing it through a public auth projection is a follow-up, not part of this batch.

## 5n. Handover evidence — B-BOUND-I (the step 1 review follow-up: projections, dead shims, cycles)

**Commit:** `76b4aa807`. **State:** committed on `codex/lane-orders`, **not pushed**.

**1 — where this batch came from.** A read-only review of the whole branch
(`git diff 49dc5ff1a..HEAD`, the "step 1 architecture review") produced a four-item acceptance table:
0 FAIL, 3 WARN, 1 PASS. This batch applies the part that is safe to do now — the registry stops
publishing database rows, the contract catalogue is no longer repeated at the call sites, the dead
relocation shims are gone, and the guard can see a module dependency cycle. The rest is registered as
the open debt in §5o.

**2 — what was applied** (73 files, +495/−230).

- `core/extensions/registry` publishes explicit projections (`ProviderProjection`,
  `PluginPackageProjection`, `InstalledPluginPackageProjection`, `PluginInstanceProjection`). Every
  query names its fields in a `select` instead of pulling the row with `include: { plugin: true }`,
  and no Prisma entity type appears in a public signature. The admin installer listing reads its own
  projection through the new `listInstalledPluginPackages`, so the commerce readers keep the narrow
  one. The filter, the order, the `includeDeleted` and the `null` semantics are unchanged, and the
  projection still happens after the contract test.
- The twelve `callContract` call sites take their version from `PLUGIN_CONTRACT_VERSIONS`, and
  `callContract` is generic over the contract name, so a call that passes the wrong version for its
  contract does not compile.
- `checkout` and the payment routes use `declaresContract` instead of repeating the contract test.
- Twelve dead files are gone: the relocation shims under `core/admin/extension-installer`,
  `core/admin/system-settings`, `core/payment` and `core/order`, plus `core/order/hooks.ts`, which no
  production code imported. The call sites now import the real module.
- `PluginManagementService` no longer re-exports the four reads that `core/extensions/registry`
  already publishes.
- The guard registers the three new module edges and drops the three the relocation removed, and it
  now detects module dependency cycles. **There are twenty-three cycles in the tree**, in the
  commerce family and in the extension family; every one of them is registered with a reason, and a
  registration that no longer matches the tree fails as well. The assertion therefore catches a *new*
  cycle, not the existing ones.

**3 — the gate.** (lane `orders`, `jiffoo_core_test_orders`, Redis DB 12)

```
=== Final test summary ===
Scope: default
Lane: orders
Database: jiffoo_core_test_orders
Run API tests:
   Start at  17:23:47
 Test Files  28 passed (28)
      Tests  587 passed | 2 skipped (589)
Run Admin tests:
   Start at  17:27:02
 Test Files  3 passed (3)
      Tests  26 passed (26)
Run Shop tests:
   Start at  17:27:04
 Test Files  2 passed (2)
      Tests  3 passed (3)

| Step | Result | Duration |
| --- | --- | --- |
| Prisma generate | PASS | 0.01s |
| Type-check selected scope and shared | PASS | 10.43s |
| Lint Shop | PASS | 5.76s |
| Reset test database | PASS | 3.25s |
| Run API tests | PASS | 195.08s |
| Run Admin tests | PASS | 2.23s |
| Run Shop tests | PASS | 1.67s |
```

Exit code 0. A wider affected-suite run (`vitest --changed`, 117 files) ran before it and caught one
real regression: the payment routes read the declared contract through `declaresContract` now, and
the registry mock in the payment routes test did not provide it, so the route answered 500. The mock
keeps the real implementation now, so the declared contract of the package is still checked.

**4 — the merge hazard grew.** This batch deletes twelve modules that the P-3/P-4 main line still
imports: `core/admin/extension-installer/{utils,errors,types,security,version-utils}`,
`core/admin/system-settings/service`, `core/payment/{locks,minor-units}`, `core/order/current-pricing`,
`core/order/hooks` and `core/admin/audit-events/records` — about **43 import sites** in roughly thirty
files on that branch. Those call sites must be repointed at the real modules during the merge, exactly
like the `plugin-registry-version` import of §5m. The main line also still uses the `admin/system-settings`
shim in eighteen places, so that path disappears with this batch.

**5 — the gate is too long, and now we know why.** The API suite is 164 files / 2376 tests and takes
about 38 minutes locally, while `apps/api/vitest.config.ts` runs it with `singleFork: true` and
`fileParallelism: false` — one file at a time, because the files share one PostgreSQL database. CI
already solves this with infrastructure: `.github/workflows/ci.yml` runs the same suite as four
parallel matrix jobs, each with its own PostgreSQL and Redis service and `vitest --shard=N/4`. So the
local full-suite run is the only place that pays the serial price, and it pays it again on every
commit. The scoped gate for this batch took **195 seconds** against **2328 seconds** for the full
suite. §5p records the decision.

## 5o. The open debt of the step 1 review — what this branch does NOT fix

**Status after B-BOUND-J (WP-F5):** items **2, 3, 5 and 6 are closed**; item **1 is partially closed**;
items **4 and 7 stay open**. §5q carries the evidence.

These are the review findings that stay open on purpose. They are registered here so that they are
not mistaken for done work.

| # | Finding | Why it stays open |
|---|---|---|
| 1 | **W2 — the gateway still lives in the admin layer.** `callContract`, `ContractCallError`, `getPluginTimeoutMs` and `recordPluginFailure` are still imported from `core/admin/extension-installer/**` by `order`, `checkout`, `payment`, `notifications` and `storage`, although `core/extensions/**` exists as the neutral home. | Moving the gateway is a cross-batch change: it moves the plugin runtime's public surface and touches the P-3/P-4 line's plugin pages. It needs its own batch and the main line's agreement. |
| 2 | **W4 — cross-domain reads still bypass the owning module.** `core/notifications/service.ts` reads the `users` table for the recipient locale, `core/order/service.ts` reads `user.email` and `user.locale` through the order relation, and `plugin-pages/asset-routes.ts` reads `plugin_installations` directly. | The guard binds writes, not reads (by design, §5g). Routing the reads through public projections of `core/auth` and `core/extensions/registry` is a design decision, not a cleanup. |
| 3 | **W5 — the guard only scans `src/core`.** `src/infra/**` and `src/jobs/**` are outside it, and `infra/core-process.ts`, `infra/shared-protection.ts` and `infra/events/delivery.ts` depend on `core/admin/extension-installer/**` — including the platform circuit-breaker configuration that reuses the plugin gateway's constants. | The infrastructure layer is not in the boundary's scope, and those files are outside every batch's allowed set. The platform breaker configuration belongs in `core/shared` or `src/infra/config`; that is a follow-up. |
| 4 | **The inventory ledger is invisible on the order path.** `InventoryService.decrementStock` and `incrementStock` write the stock column but no `inventory_adjustments` row, while `applyDesiredStock`, `adjustStock` and `setStockById` do write one. | Pre-existing behaviour, not introduced by this branch — the same code path existed before the boundary work. It is an observability gap, not a boundary violation. |
| 5 | **`core/shared/money.ts` throws the native `Error`.** `decimalToMinor` and `minorToDecimal` are called from the order and checkout main flows, so a bad amount escapes as a 500 instead of a 4xx. | A behaviour change on the money path needs its own decision on the error contract, not a silent fix inside a cleanup batch. |
| 6 | **`core/upload/service.ts` takes a Fastify `MultipartFile`.** A framework type reaches the business layer. | The neutral input shape belongs to the upload service's own API change; the adapter belongs in the route layer. |
| 7 | **Twenty-three module cycles.** The guard now sees them and registers them, but they are not removed. | They are real and they are documented; removing them means restructuring the commerce and extension families, which is larger than a cleanup batch. |

## 5p. The local gate decision — scope locally, full suite in CI

**Measured on this branch** (lane `orders`, `jiffoo_core_test_orders`):

| Gate | Scope | Wall clock |
|---|---|---|
| `pnpm verify:quick` with `--test-files` | 17 affected suites + the planner's mandatory suites | **195 s** (API 28 files / 587 tests) |
| `pnpm verify:quick` without `--test-files` | `vitest --changed` | 1872 s (117 files / 1951 tests) |
| `pnpm verify:quick` with the full selection | 164 files / 2376 tests | **2329 s** (38.8 min) |
| the same suite in CI | four parallel shards, own PostgreSQL and Redis per shard | ~10 min per shard, in parallel |

The full local run is the only place that pays the serial price, and it pays it on every commit. The
decision for this lane:

1. **The local pre-commit gate is the scoped one.** `AGENTS.md` already says the scope and the
   `--test-files` selection come from the lane advisor; that is the default, and a batch records the
   scope it used in its handover section.
2. **The full suite belongs to CI**, which already runs it sharded and in parallel with isolated
   services. A lane that does not push gets its full-suite evidence at integration time.
3. **A local full-suite run stays possible** for the batches that want it (a risky batch, a release
   candidate), and the ledger records that it happened.

**Still open:** the suite itself is serial because the files share one database, so a local full-suite
run stays 38 minutes. The fix is a local sharded gate — four parallel shards, each with its own
database and Redis — which needs a shard-aware lane configuration (`scripts/lane-config.*` is on the
serial overlap set, §4) and a Redis database allocation per shard. That is a separate batch with the
P-3/P-4 main line.

## 5q. Handover evidence — B-BOUND-J (the step 1 review follow-up: neutral layer, cross-domain reads, inventory ledger, local sharded gate)

**Commit:** `f58c6b49b`. **State:** committed on `codex/lane-orders`, **not pushed**; the merge is the
P-3/P-4 main line's job.

**1 — what this batch did.** Five blocks, all of them the "safe now" part of the step 1 review:

- **The neutral layer grew.** The plugin gateway's leaf pieces moved out of
  `core/admin/extension-installer/**` into `core/extensions/runtime/**` (contract errors, contract
  versions, failure recording, gateway protection parameters); the platform-wide circuit-breaker
  parameters moved into `core/shared/config.ts`; the plugin recovery test-control module moved into
  `src/infra/recovery-test-control.ts`. Every admin-side path became a **re-export**, so the
  P-3/P-4 main line's imports keep working and no export surface shrank. `src/infra/**` no longer
  depends on `core/admin/**` except for one deliberate leftover (`deliverInstallationEvent`, which
  belongs to the `callContract` batch).
- **Cross-domain reads go through the owner.** `core/auth/identity-service.ts` gained a public
  identity projection (`readProfile` / `requireProfile`, a neutral DTO, no Prisma entity type in the
  signature); the order service and the notification service read the user through it instead of
  reading `users` directly.
- **The inventory ledger is visible on the order path.** `decrementStock` and `incrementStock` now
  write an `inventory_adjustments` row with the same columns and the same signed-quantity convention
  as the three paths that already wrote one, and the stock write itself is unchanged.
- **The money module speaks a neutral error.** `core/shared/money.ts` throws `MoneyError` with a
  diagnostic reason, and the API error boundary maps it to `VALIDATION_ERROR`. **This is a contract
  change: an invalid amount answers 4xx where it used to answer 5xx.** It is registered here and
  covered by `tests/core/money-error-mapping.test.ts`.
- **A local sharded gate and the rules that go with it.** `scripts/verify-lane-shards.mjs` runs the
  API suite in four parallel shards, each in its own PostgreSQL and Redis container on a
  dynamically published port, with the same database name and Redis DB the lane configuration already
  validates. It checks the executed file set against the catalogue, reports the test verdict and the
  resource-cleanup verdict separately, and says in its own output that it is **not** wired into the
  approved runner and that its result is **not** delivery evidence. `AGENTS.md` carries the gate
  policy and a new `## Agent Orchestration` section. **The gate owners of both sides approved the
  integration**, so the sharded run is now part of the approved runner: `pnpm verify:quick --shards=N`
  keeps every step of the quick gate (type check, lint, database reset, the admin and shop suites)
  and replaces only the API suite step with the sharded run. The end-to-end measurement: four shards,
  166 of 166 catalogue files covered, 2389 tests, 443 suites, `API PASS / cleanup PASS`, and every
  container it created removed by id.

**2 — the review loop.** Two independent reviewers worked read-only over the whole diff, one on the
horizontal contract and the vertical isolation, one on zero regression, cohesion and the gate tool.
They returned no FAIL from the first and three blocking findings from the second; all three were
fixed by the worker that owned the files (resume, not a new worker): the money contract change had
no test and no registration, the inventory ledger had no behaviour test at all, and `AGENTS.md`
contradicted both the current rules and the script's own behaviour. The medium findings were fixed
too: four consumers still imported the relocated modules from the admin layer, the new transaction
type used `any`, the upload helper was duplicated, the expected file set was the assigned subset
rather than the catalogue, a single-shard run could report a pass, the catalogue was collected
outside the shard environment, the upload storage containers were not identified, and the destructive
migration ran without a `current_database()` check.

**3 — the gate** (lane `orders`, `jiffoo_core_test_orders`, Redis DB 12):

```
=== Final test summary ===
Scope: default
Lane: orders
Database: jiffoo_core_test_orders
Run API tests:
   Start at  21:19:13
 Test Files  59 passed (59)
      Tests  1001 passed | 2 skipped (1003)
Run Admin tests:
   Start at  21:32:22
 Test Files  3 passed (3)
      Tests  26 passed (26)
Run Shop tests:
   Start at  21:32:24
 Test Files  2 passed (2)
      Tests  3 passed (3)

| Step | Result | Duration |
| --- | --- | --- |
| Prisma generate | PASS | 0.01s |
| Type-check selected scope and shared | PASS | 10.93s |
| Lint Shop | PASS | 8.12s |
| Reset test database | PASS | 2.88s |
| Run API tests | PASS | 788.97s |
| Run Admin tests | PASS | 2.22s |
| Run Shop tests | PASS | 2.21s |
```

Exit code 0. The selection was the fifty suites this batch touches; the planner expanded it to
fifty-nine API files. The guard's ten assertions pass, including the module-cycle detection and the
edge set. One known flake is recorded: `tests/core/plugin-recovery.test.ts` waits on a fifteen-second
wall-clock deadline for a forked child, and it fails when the machine is loaded; it passes on an idle
machine (measured: nine files, 115 tests, all green).

**4 — what is still open, and who owns it.**

| Item | Owner |
|---|---|
| `core/plugin-pages/asset-routes.ts` still reads `plugin_installations` directly. The neutral projection `getInstallationById` is in place; the file belongs to the P-3/P-4 main line and the two trees have diverged, so the one-line change is left to the main line. | main line |
| `apps/api/src/server.ts` and `apps/api/src/worker-runtime.ts` still import `pluginSecretsKey` from the admin layer. Both are entry points on the serial overlap set (§4). | main line |
| `callContract` itself did not move: the charter names `plugin-runtime.ts` as the gateway's home and it drags the runtime lifecycle with it. Commerce now depends on the admin layer for **that one symbol only**. | next batch |
| **The sharded gate is approved and wired into the runner.** `pnpm verify:quick --shards=N` keeps the whole quick gate and replaces only the API suite step; `--shards` and `--test-files` are mutually exclusive; the no-argument mode and the `--test-files` mode behave exactly as before, and CI's own path (`ciSteps`, the four shards, the `jiffoo_core_test` guard, the isolated-service preflight) is unchanged. The script's own unit test is registered in `scripts/verify-selection.mjs`, so a gate can run it. | closed |
| **The shards are not balanced.** The split is by file count, not by measured time: the four shards took 428 s, 928 s, 725 s and 684 s, so the wall clock is the slowest shard, about 928 s against 2328 s serial — 2.5×, not 4×. Splitting by the historical duration of each test file is the next lever, and it is the item the main line already asked for. | next batch |
| The inventory adjustment `type` vocabulary gained `sale`; the admin request enum was left unchanged. A database enum for that column would be a separate migration. | next batch |
| The guard now registers **thirty-one** module cycles (twenty-three before this batch). They are real and documented, but the number grows as the neutral layer is introduced; reducing them is its own work. | next batch |
| `core/auth/identity-service.ts` is on the serial overlap set (§4); this batch only added to it. | merge |

**5 — what the P-3/P-4 main line asked for, and what it got.** The main line reviewed this material
read-only and accepted the method with conditions. Its corrections are taken: the sharded gate is a
tool rather than a delivery gate until both sides' gate owners agree; the script says so in its own
output; the model tiers and tool budgets are written as runner-specific observations; "a serial full
run buys nothing" was withdrawn as too absolute; "two gates are never a duplicate" became "the same
scope over the same frozen input is never a duplicate". It also required the executed-file
comparison, the separate resource-cleanup verdict, the timeout as an unfinished handover, and the
catalogue from the same frozen snapshot with the same exclusions — all four are implemented and
visible in the script's summary.

**6 — the lessons that became rules, and the ones that cost time.** A workflow script that is
malformed fails **silently at evaluation time** and starts no child at all: it is syntax-checked
before dispatch. A subagent inherits a thirty-minute ceiling that can kill a half-written change:
every dispatch sets an explicit `timeoutMs`. A running gate must not overlap source edits: an
orphaned test process from a killed worker read the same database and crashed a run, which cost a
clean-up cycle (processes terminated gracefully, then forcibly, and the lane's own containers removed
by id). And the coordinator's own mistake: a pre-flight gate over the same tree as the real gate
wasted half an hour and is now forbidden by name.

## 5r. The merge attempt into the main line — what happened, what is preserved, what is next

**Status: the merge is prepared but NOT completed, and nothing was pushed.** The main line is back at
`8893e9504` with a clean tree, and the P-3/P-4 main line's own in-flight work is preserved in
`stash@{0}` (`mainline-wip-2026-10-24T00:35`, 26 files) with a second copy in
`%TEMP%\mainline-wip-2026-10-24.patch`.

**What was done.** `git merge --no-ff codex/lane-orders` into `codex/core-extension-boundary` produced
**seven** conflicting files (not the sixteen the changed-file intersection suggested, because the main
line's own edits to those files were one to twenty-one lines each). All nine conflict hunks were
resolved, with the rule that the main line's product behaviour and the boundary line's ownership
changes both survive. The three resolutions that matter were checked by hand: the account service now
does `AuthIdentityService.deactivateCustomer` **and** keeps the main line's
`PluginPageService.revokePrincipalSessions`; the recovery path writes the staff audit row through
`AuditService.writeStaffAudit` and keeps the main line's session revocation; the script-test
catalogue keeps both entries. One type repair was needed on top: `core/shared/locks.ts` required
`LockClient` to be `Pick<Prisma.TransactionClient, '$queryRaw'>`, which the boundary line's own
transaction surface does not satisfy, so the requirement is now structural
(`{ $queryRaw: (...args: any[]) => Promise<any> }`) and both callers type-check. The merged tree then
type-checked clean (2 of 2 tasks).

**The gate on the merged tree.** `pnpm verify:quick --shards=4` ran the whole thing with the local
sharded gate: **168 of 168 catalogue files covered**, every container removed by id, cleanup `PASS` —
and **5 test files failed** (15 tests): the boundary guard, the new inventory-ledger test, the plugin
installer test, the order state machine test and the theme runtime test. The guard failure is expected
and mechanical: it was calibrated on the boundary branch, and the main line's own new modules add
module edges, so its edge and cycle registers have to be recalculated for the merged tree. The other
four are merge artefacts, where the main line's new behaviour and the boundary line's refactored
behaviour have to be reconciled rather than one side winning.

**Why it was not finished.** A worker was dispatched to fix the five files; it rewrote parts of two
test files (adding concurrency coverage for the main line's new row locks) and changed nine files in
total, but its verification run crashed and the re-run was still unverified when it ran out of budget.
Meanwhile **the P-3/P-4 main line's own session became active in that worktree again**. Continuing to
write in a tree another agent is working in violates the occupancy rule in §2, and pushing a merge
whose suite has never been observed green would violate the rule that a push needs a green local
check. So the merge was rolled back and nothing was pushed.

**What is preserved, and where.**
- The boundary branch itself is complete and green: `codex/lane-orders` at `88ccdb0e7`, 29 commits ahead
  of `49dc5ff1a`, working tree clean, and the last scoped gate on it was green.
- The merged tree, exactly as it stood: `%TEMP%\merge-attempt-2026-10-24T0300-merged-tree.patch`
  (the whole merge result against the old main-line tip).
- The worker's follow-up changes on top of that: `%TEMP%\merge-attempt-2026-10-24T0300-worker-unstaged.patch`.
- The file-by-file state of the merge: `%TEMP%\merge-attempt-2026-10-24T0300-status.txt`.
- The main line's in-flight work: `stash@{0}` in the main tree, plus
  `%TEMP%\mainline-wip-2026-10-24.patch`.

**The next step, in order.**
1. Recalibrate the guard for the merged tree (edge and cycle registers) — mechanical, and the
   recalculation is the same procedure the boundary branch used.
2. Reconcile the four remaining test files as merge artefacts, keeping both sides' behaviour.
3. Re-run `pnpm verify:quick --shards=4` in the main tree until it is green.
4. Commit the merge, push `codex/core-extension-boundary`, and let the four CI shards run.
5. Only then re-apply `stash@{0}` on top of the merged tree, and settle the overlaps by hand.

This needs a **coordinated window** on the main tree, because the P-3/P-4 line works there.

## 5s. Convergence — the state of the boundary work and of the two branches

This is the closing record of the boundary remediation line. It says what was delivered, what each
branch holds now, and what is still open with an owner.

### 1. What landed

The boundary remediation line (`codex/lane-orders`, base `49dc5ff1a`) became the main line
(`codex/core-extension-boundary`) in three merges, each with a green local gate and a green CI run:

| Merge | Content |
|---|---|
| `d52120afd` | B-BOUND-A … B-BOUND-J: the table ownership model, the neutral layer, the extension leaf modules, the boundary guard, the auth read projection, the inventory ledger on the order path, the money error contract, the upload adapter, the local sharded gate, and the gate policy and orchestration rules in `AGENTS.md` |
| `be29e4d79` | the shard gate balanced by measured duration, and the guard widened to `src/infra` and `src/jobs` |
| `d97763dd3` | the guard's registers recalculated **for the tree it runs in** |

Both branches are green on CI: `codex/lane-orders` at `4d6eb5356` and `codex/core-extension-boundary` at
`d97763dd3`.

### 2. What each branch is now

- **`codex/core-extension-boundary`** is the integration branch and the **authoritative** copy: CI runs it,
  and the boundary guard's registers are calibrated for it. The P-3/P-4 main line's own in-flight work sits
  in its working tree, uncommitted, exactly as it was.
- **`codex/lane-orders`** is the historical development branch. Its own guard registers are correct for the
  lane tree but **not** for the main tree, so the lane branch must not be evolved further on its own: the next
  boundary change goes on the main line, where the guard is calibrated. A later merge of the lane branch into
  the main line would collide in the guard file; when it happens, take the main line's version and recalculate.

### 3. The guard's registers are a fingerprint, not a filter

With the scan widened to `src/infra` and `src/jobs`, the tree has **446 registered module cycles**. The
cycle check therefore no longer means "the tree is acyclic"; it means **the module graph's cycle set may
only change through an explicit registration with a reason** — a new cycle fails, and a registered cycle that
disappears fails too. That is worth keeping, and it is also the honest description of what it is.

The cycle count is the debt that grows whenever the scan widens. Reducing it is real work: the long rings
reach for a shared piece, and that piece belongs in a neutral module rather than in one of the ring members.

### 4. Open items, with their owner

| Item | Owner |
|---|---|
| `callContract` itself did not move: the charter names `plugin-runtime.ts` as the gateway's home, and it drags the runtime lifecycle with it. Commerce now depends on the admin layer for that one symbol only. | next batch, with a charter decision |
| `infra/events/delivery.ts` still reaches into `admin/extension-installer` for `deliverInstallationEvent` — the last infra-to-admin edge. | next batch, with the `callContract` move |
| One real cross-domain table write was found by the widened scan. It is registered as a tracked exception, not as a legal edge. | next batch |
| The known-cycle count is 446 and the guard's cycle check is a fingerprint rather than a filter. | next batch |
| The shard gate is wired into the approved runner and its own unit test is registered, but the runners of both sides should agree on the policy before it becomes the default way to run the local full suite. | both gate owners |
| The P-3/P-4 main line's in-flight work sits uncommitted in the integration tree; it overlaps with the merged tree in three places and needs a human pass. | P-3/P-4 main line |
| The `plugin_installations` read in the plugin page asset route now goes through the registry's projection on this branch; the main line's own copy of that file was merged from the branch, so it needs the same change if it diverges again. | P-3/P-4 main line |

### 5. What the method turned out to be

The verification cost of this repository is dominated by one fact: the API suite's files share one
database, so they run one at a time and a local full run takes about forty minutes. Everything else followed
from that:

- the **scoped** gate (the affected suites plus the planner's mandatory ones) is the local default — 195 s
  against 2328 s;
- the **sharded** gate makes a local full run four parallel shards with their own containers — 865 s, and
  571 s for the slowest shard once the split follows the measured durations;
- the **boundary guard** turns the architecture rules into a check that fails on the next commit;
- the **ledger** and the **orchestration rules** keep two lines from stepping on each other, and every gate
  result is written down with the scope it covered.

## 5. Handover evidence — B-BOUND-A

**Diff:** 4 files, +333 / −64.

| File | Change |
|---|---|
| `apps/api/src/core/inventory/service.ts` | `InventoryService.applyDesiredStock(tx, variantId, desiredQuantity, details, options?)` — normalise → conditional `updateMany({ where: { id, stock: priorStock } })` with bounded retry → `inventory_adjustments` ledger row → `product.updated` event → product cache version bump. Idempotent: equal desired level ⇒ no write, no ledger row, no event. New structural tx shape `InventoryLedgerTx`; extracted `InventoryAdjustmentDetails`. |
| `apps/api/src/core/admin/product-management/service.ts` | Removed both direct `product_variants.stock` writes (variant create + variant update); now calls `applyDesiredStock(..., { publishProductChange: false })` so exactly one `product.updated` per product change remains. |
| `apps/api/src/core/cart/service.ts` | New `CartService.consumePurchasedItems(tx, userId, purchasedLines)` (WP-B call site); **zero** direct product-table reads remain in the cart module (a third read inside `getCartFromDatabase` was found and routed through the projection as well). |
| `apps/api/src/core/product/service.ts` | New product-domain read projection owning "which variants are sellable and at what price". |

**Gate** (`DATABASE_URL_TEST=…/jiffoo_core_test`, `pnpm verify:quick --test-files=…`, planner-expanded):

```
Run API tests:
   Start at  12:23:39
 Test Files  163 passed (163)
      Tests  2383 passed | 2 skipped (2385)
Run Admin tests:
   Start at  12:55:18
 Test Files  58 passed (58)
      Tests  572 passed (572)
Run Shop tests:
   Start at  12:55:34
 Test Files  1 failed | 32 passed (33)
      Tests  2 failed | 251 passed (253)

| Step | Result | Duration |
| --- | --- | --- |
| Prisma generate | PASS | 0.01s |
| Type-check selected scope and shared | PASS | 2.87s |
| Lint Shop | PASS | 6.38s |
| Reset test database | PASS | 2.40s |
| Check Prisma migration drift | PASS | 1.14s |
| Run API tests | PASS | 1898.78s |
| Run Admin tests | PASS | 16.57s |
| Run Shop tests | FAIL | 19.89s |
```

**The single failing step is owned by B-P3P4, not by B-BOUND-A.**
`apps/shop/tests/checkout-contract.test.ts` asserts that every `apps/shop/app/**/page.tsx` appears in
its hard-coded `pageClasses` map. B-P3P4's untracked route
`apps/shop/app/(storefront)/[locale]/apps/[slug]/[[...path]]/page.tsx` is not classified yet:

```
- Expected: "/[locale]/apps/[slug]/[[...path]]"
```

**B-P3P4 owns the fix** (add the route classification to `apps/shop/tests/checkout-contract.test.ts`).
B-BOUND-A does not touch `apps/shop/**`.

**Unfinished / known gap carried into B-BOUND-B.** The product read projection deliberately does
not expose `product_translations`, which `createCatalogSnapshot(product, variant)` needs at
`core/order/service.ts:338`. B-BOUND-B must either extend the projection with translations (the
product domain owns `product_translations`) or keep that single read. B-BOUND-B call sites to
adopt: `core/order/service.ts:403-413` (cart consumption), `:204` and `:338` (product reads),
`:456` (variant count).

**First gate run** additionally failed on a flaky `apps/admin/tests/settings-page.test.tsx` 5 s
timeout (unrelated React UI test); it passed in the two subsequent runs.

**Re-verification in the isolated lane — GREEN (this is the merge-ready evidence).**
The block above was produced in the shared integration worktree on `jiffoo_core_test` before
isolation existed. B-BOUND-A was re-verified after extraction, in
`worktrees/jiffoo-lane-orders` on lane `orders` (`jiffoo_core_test_orders`, Redis DB 12),
against the 8 owned suites plus `event-coverage.test.ts` and `module-state-audit.test.ts`:

```
=== Final test summary ===
Scope: default
Lane: orders
Database: jiffoo_core_test_orders
Planner added suites: none
Run API tests:
   Start at  13:18:43
 Test Files  10 passed (10)
      Tests  121 passed (121)

| Step | Result | Duration |
| --- | --- | --- |
| Prisma generate | PASS | 4.62s |
| Type-check API, Admin, Shop and shared | PASS | 19.85s |
| Lint Shop | PASS | 10.17s |
| Reset test database | PASS | 2.36s |
| Run API tests | PASS | 36.03s |
```

Exit code 0. `Planner added suites: none` — the lane tree contains only this batch's changes, so
no foreign change expanded the selection. The Shop step is absent because the lane selection is
API-only; the Shop contract failure in §5 is a B-P3P4 artifact and does not exist in this tree
(its untracked storefront route is not present here).

**B-BOUND-A is merge-ready.** The 4-file diff is committed on `codex/lane-orders`; it is *not* in
the integration worktree any more (extracted, see §9).

## 6. Handover evidence — B-ORCH

`.pi/settings.json` (pi-subagents tiering: `defaultThinking: medium`, `maxThinking: high`,
`scout: low`, `worker: medium`, `reviewer: medium`, `oracle: high`, model
`minimax/MiniMax-M3.1-Flash`), `.gitignore` (`.pi/*` + `!.pi/settings.json`),
`AGENTS.md` (`## Architecture Guardrails`, 4 rules), and this ledger.

## 7. Executor register

| Executor ID | Agent / model | Worktree | May change | May use DB | Commits? |
|---|---|---|---|---|---|
| `wp-a-cart-inventory` | worker / `minimax/MiniMax-M3.1-Flash:medium` | `worktrees/jiffoo-lane-orders` | B-BOUND-A file set | `jiffoo_core_test_orders` | no |
| `wp-f1-guard-blind-spot` | worker / `minimax/MiniMax-M3.1-Flash:medium` | `worktrees/jiffoo-lane-orders` | B-BOUND-F file set | `jiffoo_core_test_orders` | no |
| `p3-p4 coordinator` | p3-p4 orchestrator | `worktrees/jiffoo-core-extension-boundary` | B-P3P4 file set | `jiffoo_core_test` | its own policy |

New executors must be added here before launch. A coordinator may not start a child that is not
registered.

## 8. Open questions for the P-3/P-4 main line

1. **B-BOUND-B contract.** Confirm that WP-B may restructure `core/order/service.ts` freely as
   long as P-3's `bindPurchaseOrigin(tx, data.pluginPurchaseOriginId, userId, created.id)` call
   stays inside the order-creation transaction, and P-3's `response.pluginReturnTarget` lookup
   stays in `getOrderById`.
2. **B-BOUND-C scope.** `core/admin/system-settings` → `core/settings` and
   `core/admin/plugin-management` + `extension-installer` → `core/extensions` is a large mechanical
   move that touches B-P3P4's `core/admin/extension-installer/**` and `core/admin/plugin-management/**`.
   Either it runs after B-P3P4 lands, or the move is deferred.
3. **Shared-tree hygiene.** The integration worktree currently holds both sides' uncommitted
   drafts. B-BOUND-A is extracted to `codex/lane-orders`; confirm whether B-P3P4 also intends to
   extract its draft to `codex/lane-plugins` before either side commits.
4. **Shop gate fix.** The failing `checkout-contract.test.ts` classification is B-P3P4's; it blocks
   a green Shop step for **both** sides until fixed.
5. **The `users` / `auth_tokens` owner (Q1) — RESOLVED.** The guard registered four writers of the
   `users` table and one writer of `auth_tokens`. The AGENTS.md rule says each of those tables has
   exactly one owning module. **Decision taken: `core/auth` is the single public owner** of both
   tables, and it now exposes the row operations the other modules need
   (`core/auth/identity-service.ts`). The earlier suggestion of a separate `core/user` module was
   **not** taken: it would have relocated the most security-sensitive writes in the repository
   (login, registration, email verification, password reset, token issuance) for a naming benefit
   only, without changing the number of modules or the single-owner rule. If the owner prefers the
   separate module, that is a separate reviewed batch over the identity flows.
6. **Three stray plugin-domain writers (Q6) — RESOLVED.** `plugin_operation_leases` is owned by
   `core/storage` and `core_processes` by `core/infra`, but the extension installer wrote them in
   three places. Same shape as the work already done — a short batch, no decision needed.
   **Closed in B-BOUND-F (§5k):** the three writes now go through the storage lease API and the
   infra process registry, and the guard's raw-SQL pattern was widened at the same time, so an
   unqualified or schema-qualified raw write can no longer slip through.
7. **The `stock` column split (Q7).** `product_variants` is owned by the product domain, but the
   `stock` column is written only by the inventory domain. **Recommendation: keep the split and
   record it as a column-level exception in the guard's owner map.**

## 9. Extraction record — B-BOUND-A

| Item | Value |
|---|---|
| Extracted from | `worktrees/jiffoo-core-extension-boundary` (uncommitted draft) |
| Extracted to | `worktrees/jiffoo-lane-orders` / `codex/lane-orders` |
| Base SHA | `49dc5ff1a` (identical to the integration branch tip) |
| Transport | `git diff` over the 4 owned files → `git apply --3way` in the lane tree, applied cleanly to all 4 |
| Integration tree after extraction | the 4 files were reverted to `49dc5ff1a` content, so the integration tree carries **only** B-P3P4 drafts |
| Lane DB | `jiffoo_core_test_orders` (registered lane `orders`, Redis DB 12) |
| Commits | `6c838d865` — B-ORCH (`.gitignore`, `.pi/settings.json`, `AGENTS.md`, `docs/coordination-ledger.md`)<br>`4d83fa2c6` — B-BOUND-A (the 4 owned code files)<br>One commit per batch, no cross-batch mixing. Base `49dc5ff1a`. Nothing pushed. |

`AGENTS.md`, `.gitignore` and `.pi/settings.json` exist in **both** trees with **identical
content** (the guardrails are meant to be active for every worker on both sides). The lane branch
carries them as a commit; the integration worktree keeps them as an uncommitted working copy. If
the integration side commits them, the merge sees the same blob and is conflict-free; if it
prefers a clean tree, discard the working copy and take them from the lane branch.
