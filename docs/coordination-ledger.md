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
| **B-ARCH-1** — step 2 remediation: order policy, order placement pipeline, fulfilment policy, event and notification registries | Architecture review line | `codex/core-extension-boundary` / `worktrees/jiffoo-core-extension-boundary` | `69e8056cb` | new `apps/api/src/core/order/{policy,pipeline}.ts`; new `apps/api/src/core/shared/fulfillment-policy.ts`; `apps/api/src/core/order/**`; `apps/api/src/core/shared/**`; `apps/api/src/core/cart/service.ts`; `apps/api/src/core/checkout/service.ts`; `apps/api/src/core/payment/{session,service}.ts`; `apps/api/src/core/notifications/service.ts`; `apps/api/src/infra/events/{core-subscribers,emit,delivery}.ts`; `apps/api/src/core/admin/{order-management,dashboard,user-management}/**`; `apps/api/src/core/admin/extension-installer/{routes,repair-bootstrap}.ts`; `apps/api/src/core/admin/plugin-management/service.ts`; `apps/api/tests/core/{order-policy,order-pipeline,core-subscriber-registry,module-boundary-audit,module-state-audit,fulfillment-policy,fulfillment-policy-settings}.test.ts`; `apps/api/tests/routes/test-signing-policy.test.ts`; `apps/api/src/core/{shared/fulfillment-policy,settings/service,notifications/service}.ts`; `apps/api/src/infra/events/core-subscribers.ts`; `apps/api/src/{server,worker-runtime}.ts`; `apps/admin/tests/settings-page.test.tsx`; `apps/shop/tests/{error-semantics-http,payment-return-http,s4-checkout}.test.ts`; `apps/shop/components/{checkout-summary,checkout-view}.tsx`; `docs/coordination-ledger.md` | `jiffoo_core_test` (integration) | `wp-pre`, `wp-0`, `wp-1`, `wp-2`, `wp-r1`, `wp-r2`, `wp-r3`, `wp-r4` (eight pi worker runs, five pi reviewer runs, model `minimax/MiniMax-M3.1-Flash:medium`) | **committed** (checkpoint `fa355244f`, fix `3f94cda2e`, policy `ed11de9da`, pipeline `52fc77c8c`, registries `e1102ce1a`, findings `f146a7530`, admin `ce98e3da3`, vocabularies `77dccf70f`, extension point and registry hygiene as the next commit) | §5t, §5u |

| **WP-SA** — the plugin gateway moves to the neutral layer, the money error contract, the plugin installation projection (WP-SA) | Architecture review line | `codex/core-extension-boundary` / `worktrees/jiffoo-core-extension-boundary` | `091fcc83a` | `apps/api/src/core/extensions/runtime/{plugin-runtime,plugin-database-test-control,plugin-signing-policy,plugin-migration-gate,storage-admission-service}.ts` (moved); `apps/api/src/core/plugin-pages/page-declarations-service.ts` (moved); `apps/api/src/core/storage/theme-validator.ts` (moved); the consumers of the moved modules (`core/{checkout,order,payment,notifications,plugins,plugin-pages,plugin-storage,storage}/**`, `core/admin/{health-monitoring,order-management,plugin-management}/**`, `core/admin/extension-installer/**`, `infra/events/delivery.ts`, `server.ts`, `worker-runtime.ts`); `apps/api/src/core/extensions/registry/service.ts`; `apps/api/src/core/{checkout/service,order/pipeline}.ts`; `apps/api/tests/**` (import paths, the two registers, the money error test); `docs/coordination-ledger.md` | `jiffoo_core_test` (integration) | `wp-sa` (pi session `a8afed88-1630-4700-a2e4-de6770047d11`) | **uncommitted, in the tree** | §5v |
| **WP-F1B** — the core calls the fulfilment contract and records the fulfilment on the shipment | Architecture review line | `codex/core-extension-boundary` / `worktrees/jiffoo-core-extension-boundary` | `e7f73487cf` | `apps/api/src/core/order/service.ts`, `apps/api/src/core/admin/order-management/{service,schemas}.ts`, `apps/api/tests/core/order-fulfillment-contract.test.ts`, `apps/api/prisma/schema/commerce.prisma` (the two columns of the shipment, formatted), `apps/api/prisma/migrations/20261026135338_order_fulfillment/**`, `docs/coordination-ledger.md` | `jiffoo_core_test` (integration) | `wp-f1b` (pi worker run, model `minimax/MiniMax-M3.1-Flash:medium`) | **uncommitted, in the tree** | §5y |
| **S3-DATA** — the step 3 data-reliability remediation: the API tokens leave the settings blob, the cart writes are atomic, the payment verification is authenticated, the order state machine carries its own predicate, and the hot-path indexes land | Architecture review line | `codex/core-extension-boundary` / `worktrees/jiffoo-core-extension-boundary` | `448cb6c16` | `apps/api/prisma/schema/**`, `apps/api/prisma/migrations/2026102700*`, `apps/api/prisma/RAW_INDEXES.md`, `apps/api/src/core/{auth,cart,order,payment,inventory,product,plugins,plugin-pages,plugin-storage,cache,admin}/**`, `apps/api/src/infra/events/cleanup.ts`, `apps/api/tests/**` | `jiffoo_core_test` (integration) | `wp-s3-w1`, `wp-s3-w2a`..`wp-s3-w2g` (eight pi worker runs, two pi reviewer runs, five delta rounds; models `minimax/MiniMax-M3.1-Flash:medium` and `minimax/MiniMax-M3:medium`) | **committed `cccbae535`, gate green** | §5z |
| **S3-DATA-2** — the step 3 data-reliability remediation, part two: the currency of the order, the exact amounts of the placement, the customer scoped idempotency key, the conditional stock write, the transaction boundaries of the plugin paths, the package store as a cache of the database and the hot-path indexes | Architecture review line | `codex/core-extension-boundary` / `worktrees/jiffoo-core-extension-boundary` | `7174b2458` | `apps/api/prisma/schema/**`, `apps/api/prisma/migrations/20261028031500_data_reliability_indexes/**`, `apps/api/src/core/**`, `apps/api/src/infra/events/delivery.ts`, `apps/api/tests/**`, `.claude/agents/*.md` | `jiffoo_core_test` (integration) | coordinator session (five worker runs, one arch-reviewer pass, one reviewer follow-up; models `minimax/MiniMax-M3.1-Flash`) | **committed `38cce1eac`, gate green** | §5za |
| **S3-DATA-3** — the remaining items of the step 3 batch: the exact amounts of the cart, the negative cost price of a variant, the currency of the request as an assertion, the checked prerequisite of the trigram extension and the ports of the mock servers of the three suites | Architecture review line | `codex/core-extension-boundary` / `worktrees/jiffoo-core-extension-boundary` | `38cce1eac` | `apps/api/src/core/{cart,order,admin/product-management}/**`, `apps/api/tests/**`, `apps/shop/tests/**`, `apps/admin/tests/**` | `jiffoo_core_test` (integration) | coordinator session (three worker runs; model `minimax/MiniMax-M3.1-Flash`) | **committed `2a432138a`, gate green** | §5zb |

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

**Status after WP-SC (§5w):** items **2, 3, 4, 5 and 6 are closed**; item **1 is closed for the
commerce modules** by WP-SA (§5v) and stays open for the helpers of the installer that the neutral
runtime module still imports; item **7 stays open**. §5q carries the evidence of item 5, §5v the
evidence of item 1, and §5w the evidence of items 2, 3, 4 and 6.

These are the review findings that stay open on purpose. They are registered here so that they are
not mistaken for done work.

| # | Finding | Why it stays open |
|---|---|---|
| 1 | **W2 — the gateway still lives in the admin layer.** `callContract`, `ContractCallError`, `getPluginTimeoutMs` and `recordPluginFailure` are still imported from `core/admin/extension-installer/**` by `order`, `checkout`, `payment`, `notifications` and `storage`, although `core/extensions/**` exists as the neutral home. | **Closed for the commerce modules by WP-SA (§5v):** the plugin runtime, the migration gate, the signing policy, the database test control and the storage admission service moved into `core/extensions/runtime/**`, and the commerce modules import the gateway from there. What stays open is the other direction: the neutral runtime module imports the plugin lifecycle service of `admin/plugin-management` and the private helpers of the installer. |
| 2 | **W4 — cross-domain reads still bypass the owning module.** `core/notifications/service.ts` reads the `users` table for the recipient locale, `core/order/service.ts` reads `user.email` and `user.locale` through the order relation, and `plugin-pages/asset-routes.ts` reads `plugin_installations` directly. | **Closed.** The reads go through public projections: the notification service takes the recipient locale from the auth identity projection (`notifications -> auth`), the order module takes the account from the same projection (`order -> auth`), and the plugin-page asset routes take the installation from the read-only registry (`plugin-pages -> extensions/registry`). The retarget of the admin audit events and the admin dashboard closes the last two of this family (`admin/audit-events -> auth`, `admin/dashboard -> auth`, §5w). |
| 3 | **W5 — the guard only scans `src/core`.** `src/infra/**` and `src/jobs/**` are outside it, and `infra/core-process.ts`, `infra/shared-protection.ts` and `infra/events/delivery.ts` depend on `core/admin/extension-installer/**` — including the platform circuit-breaker configuration that reuses the plugin gateway's constants. | **Closed.** The scan roots of the guard are `src/core`, `src/infra` and `src/jobs` (`SCAN_ROOTS` in `apps/api/tests/core/module-boundary-audit.test.ts`; the infra and job layers are file-scoped modules, so a file is its own module). The platform circuit-breaker configuration moved into the neutral `core/shared` module, and WP-SA (§5v) closed the last infra-to-admin edge: `infra/events/delivery` hands the installation event to the neutral runtime module and its known violation was removed. |
| 4 | **The inventory ledger is invisible on the order path.** `InventoryService.decrementStock` and `incrementStock` write the stock column but no `inventory_adjustments` row, while `applyDesiredStock`, `adjustStock` and `setStockById` do write one. | **Closed.** `InventoryService.decrementStock` and `InventoryService.incrementStock` write the `inventory_adjustments` row in the caller's transaction (`core/inventory/service.ts`), and the order path uses exactly those two methods (`core/order/pipeline.ts`, `core/order/service.ts`). `apps/api/tests/core/inventory-ledger.test.ts` drives the real order flow and reads the ledger rows back. |
| 5 | **`core/shared/money.ts` throws the native `Error`.** `decimalToMinor` and `minorToDecimal` are called from the order and checkout main flows, so a bad amount escapes as a 500 instead of a 4xx. | **Closed:** the money module throws `MoneyError` with its reason and its detail (§5q), and WP-SA (§5v) answers a bad amount with the validation error of the repository in the order placement and in the checkout quote, with a test that asserts the status. |
| 6 | **`core/upload/service.ts` takes a Fastify `MultipartFile`.** A framework type reaches the business layer. | **Closed.** The upload service takes its own framework-neutral `UploadInput` (`filename`, `mimetype`, `content`); the multipart parsing and the stream reading stay in the route layer (`core/upload/service.ts`). |
| 7 | **The registered module cycles.** The guard now sees them and registers them, but they are not removed. The register holds **600** rings after the widened scan and the retarget of this wave (§5w); §5s recorded the count of 446 at its merge. | They are real and they are documented; removing them means restructuring the commerce and extension families, which is larger than a cleanup batch. |

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

## 5t. Handover evidence — B-ARCH-1 (step 2 remediation: the orchestration and the extension seams)

**Baseline:** `69e8056cb`. **Commits:** `fa355244f` (checkpoint of the inherited repair-bootstrap batch),
`3f94cda2e` (two inherited red tests repaired), `ed11de9da` (order policy), `52fc77c8c` (order placement
pipeline and fulfilment policy), `e1102ce1a` (event, payment status and notification registries).

**No contract change.** The batch changed no HTTP status code, no error code, no message, no response
shape and no route contract, so §4 needs no entry. The three independent reviews confirmed this.

### What the batch delivers

| Goal | Where |
|---|---|
| one published policy surface for the order vocabulary and the order status predicates | `apps/api/src/core/order/policy.ts`; the vocabulary is derived from the Prisma enums in `apps/api/src/core/order/types.ts` |
| the order placement as ordered named stages | `apps/api/src/core/order/pipeline.ts` (14 stages); `OrderService.createOrder` is a thin runner |
| a fulfilment policy strategy | `apps/api/src/core/shared/fulfillment-policy.ts`; the default policy reproduces the previous behaviour exactly |
| explicit registries instead of hardcoded branches | `apps/api/src/infra/events/core-subscribers.ts`, `apps/api/src/core/payment/session.ts`, `apps/api/src/core/notifications/service.ts` |

### The two inherited red tests, and why they were red

- `apps/api/tests/core/module-boundary-audit.test.ts` failed three assertions because the inherited
  batch had put the repair-bootstrap service into `admin/plugin-management`, which created the edges
  `admin/plugin-management -> auth` and `admin/plugin-management -> audit` and about fifty unregistered
  module rings. The two methods moved to `admin/extension-installer/repair-bootstrap.ts`, the module
  that owns the route and already holds those two approved edges, so the edge set and the ring set are
  unchanged and the registers stay untouched.
- `apps/api/tests/routes/plugin-repair-bootstrap.test.ts` expected five rejection audit rows and found
  four, because the row was written from the route `onResponse` hook, which Fastify runs after the reply
  has already been flushed, so the last rejection committed its row after the caller could observe the
  response. The audit now runs from the route `onSend` hook, before the payload leaves the process.

### Two more inherited defects, and the one the batch inherited without knowing

- `apps/api/tests/routes/test-signing-policy.test.ts` needed the builtin shipping and payment providers
  to be enabled, but `syncBuiltinPlugins` only installs a builtin plugin that is missing or changed and
  does not re-enable an already installed one. The test now enables what it needs and restores the rows
  it found. The same fragility was in the new order pipeline test.
- `apps/admin/tests/settings-page.test.tsx` timed out after 5 seconds in the full admin suite while it
  passed in isolation. The commit before this batch, `69e8056cb`, fails the admin suite with exactly the
  same test and the same timeout, so the defect predates the batch; it was never seen because the gate
  of that commit aborted on the API step before it reached the admin suite. The first mount of the whole
  settings page in jsdom is CPU bound and cost about 2.8 seconds under the load of the rest of the suite,
  and the three save cycles of the test pushed it past the default budget. The test now has a budget that
  covers the first mount and the save rounds; no assertion was changed, weakened or skipped.

### The open items of the first round, and how they were closed

Every open item of the §5t review round was closed in a second wave:

| Open item | How it was closed |
|---|---|
| the fulfilment policy registry had no production caller | the catalogue of the known policies, a selection that the store settings carry, a boot hook in the API process and in the worker, and the settings module that applies the selection |
| the checkout quote always listed the shipping providers | the quote consults the plan of the cart and offers no shipping option when the plan needs none |
| the address requirement was split over two flags | one rule in the neutral shared layer, used by the cart line and by the order plan |
| the order and payment status literals outside the policy | every remaining site now reads the published vocabulary |
| the shipment vocabulary was not published | the policy publishes the shipment and the item fulfilment vocabulary |
| the payment session decided the replay rules with literals | the payment attempt status decisions are table driven |
| the policy and the transition table imported each other | the table moved into the policy module, the transition module re-exports it |
| the core subscriber registry was rebuilt per lookup | it is a frozen module scope constant, registered in the module state allowlist |
| the neutral infra layer read the orders table | the notification module resolves the recipient through the order projection |
| the notification vocabulary was a hand written union | the union is derived from the copy table |

The second wave also repaired three test suite defects of the same kind, each reproduced at the
commit before the batch: two tests that timed out under the load of the full suite, and two shop
tests whose real HTTP round trips exceeded the default budget of their files.

### The verification economics, for the next batch

While `packages/shared/**` was dirty the verification planner expanded every scoped gate to the whole
api, admin and shop catalogue, so a worker's feedback loop was a thirty eight minute serial run. The
checkpoint commit `fa355244f` makes `git diff HEAD` isolate the batch, and a scoped gate over two files
then takes about 75 seconds. Two gates must never run against `jiffoo_core_test` at the same time: the
database reset of one run corrupts the other. The workers of a parallel wave therefore verify with the
type check and the lint only, and the coordinator runs one gate over the combined tree.

### The open items the batch deliberately leaves

- the fulfilment policy is authoritative for the order and the cart flow; the checkout quote path still
  lists the shipping providers of the installed shipping plugins, and the per product type quote
  requirement is enforced by the order placement;
- a new order state still needs a Prisma enum change and a migration;
- the shipment vocabulary is derived from Prisma but is not published by the policy module yet;
- the payment session still decides the idempotent replay and the previous attempt rules with literal
  payment statuses next to the new error table.

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

## 5v. Handover evidence — WP-SA (the plugin gateway moves to the neutral layer)

**Baseline:** `091fcc83a`. **Branch:** `codex/core-extension-boundary` / `worktrees/jiffoo-core-extension-boundary`.
**Test DB:** `jiffoo_core_test` (the integration worktree, no lane). **Executor:** `wp-sa`.

### The seven files that moved

| From `core/admin/extension-installer/` | To |
|---|---|
| `plugin-runtime.ts` | `core/extensions/runtime/plugin-runtime.ts` |
| `plugin-database-test-control.ts` | `core/extensions/runtime/plugin-database-test-control.ts` |
| `plugin-signing-policy.ts` | `core/extensions/runtime/plugin-signing-policy.ts` |
| `plugin-migration-gate.ts` | `core/extensions/runtime/plugin-migration-gate.ts` |
| `storage-admission-service.ts` | `core/extensions/runtime/storage-admission-service.ts` |
| `page-declarations-service.ts` | `core/plugin-pages/page-declarations-service.ts` |
| `theme-validator.ts` | `core/storage/theme-validator.ts` |

The move is a move: the exported names, the contents and the behaviour are unchanged, and **the old
paths are gone** — there is no re-export shim at `core/admin/extension-installer/**`, so the admin
layer no longer offers the gateway. The consumers of the moved modules are retargeted in the whole
tree, in the source and in the tests: `core/{checkout,order,payment,notifications,plugins,plugin-pages,plugin-storage,storage}/**`,
`core/admin/{health-monitoring,order-management,plugin-management}/**`, the remaining files of
`core/admin/extension-installer/**`, `infra/events/delivery.ts`, `server.ts` and `worker-runtime.ts`.

**What the move closes.** The commerce modules import the gateway from the neutral layer again:
`checkout -> extensions/runtime`, `order -> extensions/runtime`, `payment -> extensions/runtime`,
`notifications -> extensions/runtime`, `plugins -> extensions/runtime`, `plugin-pages -> extensions/runtime`
and `plugin-storage -> extensions/runtime` replace the seven edges that pointed into
`admin/extension-installer`. The neutral infrastructure layer follows: `infra/events/delivery` hands the
installation event to the neutral plugin runtime, so the registered known violation of
`infra/events/delivery -> admin/extension-installer` (§5o, item 3) is closed and removed.

**What the move does not close.** The neutral runtime module now imports the plugin lifecycle service
of `admin/plugin-management` and the private helpers of the installer (`plugin-module-loader`,
`plugin-compatibility`, `contract-v1-runtime`, `plugin-database`, `plugin-registry-freshness`,
`payment-webhook-wire`). Those are the remaining edges of the neutral layer into the admin layer
(`extensions/runtime -> admin/extension-installer` and `extensions/runtime -> admin/plugin-management`);
they are registered with their reasons, and closing them needs the plugin lifecycle and the loader to
move into the neutral layer as well, which is outside this batch.

### The register changes

- `LEGAL_EDGES`: the seven edges of the commerce modules into `admin/extension-installer` and the edge
  `storage -> admin/extension-installer` are gone; `extensions/runtime -> {admin/extension-installer,
  admin/plugin-management, extensions/registry, infra/core-process, infra/shared-protection,
  infra/worker-shutdown, plugin-pages, plugins, storage}` and `plugin-pages -> extensions/runtime`,
  `plugin-storage -> extensions/runtime`, `admin/{health-monitoring,order-management,plugin-management}
  -> extensions/runtime` are new. The reasons of the edges whose content changed were rewritten.
- `KNOWN_CYCLES`: the module rings follow the edges. The register holds the rings of the tree of this
  batch; the rings that used to close on the installer close on the neutral runtime module instead.
- `TABLE_OWNERS` / `DOMAIN_TABLES`: `plugin_migration_operations` and `plugin_migration_attempts` move
  from the module `admin/extension-installer` to the `extensions` domain, because the migration gate
  that writes them moved into the neutral runtime module, which is a member of that domain.
- `KNOWN_VIOLATIONS`: the entry for `infra/events/delivery -> admin/extension-installer` is removed;
  the violation itself no longer exists.
- `apps/api/tests/core/module-state-audit.test.ts`: the allowlist entries of the moved files carry
  their new paths, and the rebuild file of the two plugin runtime entries points at the new location.

**The guard register file is owned by the next package of this phase.** It adds the two approved edges
and the registered module rings of the admin audit events retarget of the parallel package
(`admin/audit-events -> auth` and `admin/dashboard -> auth`, the first of which closes 144 further
rings). Until that package registers them, the boundary audit of the combined tree reports exactly
those two unapproved edges and the rings that follow from them; every edge and every ring of this
batch matches the register exactly. WP-SC is that package: it registered the two edges and the 144
rings (§5w).

### The money error contract

A bad amount is a validation failure, not an internal error. The money module keeps its domain
diagnostic — `MoneyError` with its `reason` and its `detail`, without HTTP semantics in the neutral
layer — and the two main flows that convert amounts answer it with the validation error of the
repository:

- `core/checkout/service.ts`: every amount conversion of the quote is wrapped, so the quote answers a
  bad amount with `ApiError('VALIDATION_ERROR')`.
- `core/order/pipeline.ts`: the placement answers a bad amount with `ApiError('VALIDATION_ERROR')`.

The API error boundary keeps its mapping of `MoneyError` to `VALIDATION_ERROR` (§5q), so the HTTP
answer of the order placement and of the checkout quote is **400 `VALIDATION_ERROR`** where a bad
amount used to escape as a 500. **This is an HTTP contract change** and it is covered by
`apps/api/tests/routes/money-error-status.test.ts`, which asserts the status of a bad amount on the
order placement and on the checkout quote. Every other caller of the money helpers keeps its current
behaviour.

### The cross domain reads of the plugin installation table

`core/payment/provider-account.ts`, `core/payment/reconciliation.ts` and `core/payment/webhook-routes.ts`
read the `plugin_installations` table of the extensions domain directly. They now read it through the
public projection of the extensions registry: `getDefaultInstallationRow` and
`getDefaultInstallationRowWithPackage` in `core/extensions/registry/service.ts`. The queries and the
results are the ones the readers had before, so no produced SQL text changes. The `payment ->
extensions/registry` edge was already approved.

`core/plugins/task-worker.ts` was **not** retargeted: routing it through the registry needs a new edge
`plugins -> extensions/registry`, which this batch is not allowed to add, and the plugins module is a
member of the `extensions` domain that owns the table, so its reads are not a cross domain read.

### The gate evidence

- `pnpm --filter api type-check` — exit 0.
- `pnpm --filter api lint` — exit 0.
- The narrow gate of the approved runner over the two audits, the order policy, the order pipeline,
  the orders route, the checkout provider containment and the new money error test:
  `DATABASE_URL_TEST=postgresql://postgres:postgres@localhost:5432/jiffoo_core_test pnpm verify:quick --test-files=apps/api/tests/core/module-boundary-audit.test.ts,apps/api/tests/core/module-state-audit.test.ts,apps/api/tests/core/order-policy.test.ts,apps/api/tests/core/order-pipeline.test.ts,apps/api/tests/routes/orders.test.ts,apps/api/tests/routes/checkout-provider-containment.test.ts,apps/api/tests/routes/money-error-status.test.ts`.
  The planner expanded the selection to the whole API catalogue (175 files), because the parallel
  package of the wave changed the shared package; the step table of the run is `Prisma generate PASS`,
  `Type-check selected scope and shared PASS (12.30s)`, `Lint Shop PASS (7.65s)`,
  `Reset test database PASS (2.80s)`, `Run API tests FAIL (1851.68s)`, with
  `Test Files 44 failed | 131 passed (175)` and `Tests 354 failed | 2125 passed | 64 skipped (2543)`.
  The run is **not a verdict of this batch**: the gate of the parallel package was still running
  against the same `jiffoo_core_test` when this run started, which `AGENTS.md` forbids, and the two
  suites deleted each other's fixtures. The failures are the authentication and the fixture errors
  that follow from that (`Fixture uninstall failed: UNAUTHORIZED`), not the behaviour of the moved
  modules. What the run shows for this batch:
  - `tests/routes/money-error-status.test.ts` — **2 passed** (the checkout quote and the order
    placement answer a bad amount with 400 `VALIDATION_ERROR`);
  - `tests/core/module-state-audit.test.ts` — **2 passed** (the allowlist of the moved files matches);
  - `tests/core/module-boundary-audit.test.ts` — 3 of 10 failed, and the three failures name **only**
    the two edges of the parallel package (`admin/audit-events -> auth`,
    `admin/dashboard -> auth`) and the module rings that follow from the first of them. Every edge and
    every ring of this batch matches the register.
  The coordinator runs the gate over the combined tree, alone.
- The sharded gate is not run by this batch: the coordinator runs it over the combined tree.

## 5x. Handover evidence — the settlement wave (the harness races and the last defects)

Four defects of the test harness and of the boot path were found by the gate of this phase and repaired.
None of them is an application defect, and each of them was reproduced before it was repaired.

| Defect | Cause | Repair |
|---|---|---|
| the plugin SDK build deleted its own published output while a consumer was using it | `packages/plugin-sdk/scripts/build.mjs` removed the whole `dist` before it compiled the new one, so a consumer that spawns the SDK command during the build finds no `cli.js` | the build stages the new output and swaps it in; 130 consumer spawns during the build now fail 0 times, against 57 of 182 with the old build, and the published artefact is byte identical |
| two publishes of the same plugin raced and one of them lost its staging directory | the publisher staged under a shared temporary root and removed it in its cleanup, whatever it held | the publish stages per publish, never removes a staging directory that another publish owns, and treats a package that is already published as a no-op; the builtin sync republishes a builtin whose package is missing or incomplete |
| the four shards of the local gate shared one runtime package cache | `scripts/verify-lane-shards.mjs` isolated the database and the Redis of every shard but not the package cache, so the cleanup of one shard removed the builtin packages another shard was reading | every shard gets its own cache directory, named in the evidence of the run and removed with the rest of the artefacts of the run |
| the admin settings page could not render in the admin tests | the new fulfilment policy section renders a Radix component that measures its size, and jsdom has no `ResizeObserver` | the admin test environment provides one, for every admin test file, and cleans it up between the tests |

Two more defects of the same family were repaired earlier in this phase: the admin settings page test that
ran out of its 5 second budget under the load of the full suite, and the two shop tests whose real HTTP
round trips exceeded the budget of their files.

### The gate of the settlement wave

  pnpm verify:quick --shards=4
  -> 176/176 API catalogue files in 4 shards, every shard green, API PASS / cleanup PASS;
     admin 59 files 592 tests PASS; shop 38 files 266 tests PASS; type check PASS; lint PASS.

## 5w. Handover evidence — WP-SC (the boundary guard closes its registers over the widened scan)

**Baseline:** `091fcc83a`. **Branch:** `codex/core-extension-boundary` / `worktrees/jiffoo-core-extension-boundary`.
**Test DB:** `jiffoo_core_test` (the integration worktree, no lane). **Executor:** `wp-sc`.
**Files:** `apps/api/tests/core/module-boundary-audit.test.ts`, `docs/coordination-ledger.md`.

### What the guard covers now

The scan roots of the guard are the three layers of the API source: `src/core/**`, `src/infra/**` and
`src/jobs/**` (`SCAN_ROOTS` in `apps/api/tests/core/module-boundary-audit.test.ts`). The Core tree
keeps its directory-per-module naming (`core/order/service.ts` is the module `order`); the infra and
the job layers are **file-scoped**, so every file below `src/infra` and `src/jobs` is its own module
(`infra/core-process`, `infra/events/emit`, `jobs/payment-reconciliation`). The widening itself landed
with `be29e4d79` (§5s); what was missing was a register that is consistent with the widened graph,
and that is what this batch closes.

The guard keeps its shape: an unregistered edge fails, an unregistered ring fails, a registered edge or
ring that no longer exists fails, an import that does not bind to a public export fails, and a
cross-domain table write fails. The registers are a **graph fingerprint**, not a filter: the ring
count is debt that grows whenever the scan widens.

### The two new edges

The parallel package of this wave retargeted the cross domain reads of the `users` table through the
public identity projection of the auth module, so the tree has two edges that the register did not
list:

| Edge | Reason |
|---|---|
| `admin/audit-events -> auth` | the admin audit events module reads the actor accounts through the public identity projection of the auth module. |
| `admin/dashboard -> auth` | the admin dashboard module counts the accounts through the public identity projection of the auth module. |

Both are registered in `LEGAL_EDGES` in the sorted place of the map. No entry of the register was
removed: the edges that WP-SA retired were already gone, and the edges of the moved modules keep their
entries.

### The 144 new rings

`admin/audit-events -> auth` closes the ring through the plugin pages and the plugin management, and
because the audit events module also reaches the outbox, the notifications, the orders and the payment,
the single new edge opens **144** rings. The shortest one is the ring that the coordinator named:

```
admin/audit-events -> auth -> plugin-pages -> extensions/runtime -> admin/plugin-management -> plugin-storage
```

with the reason that the audit events module reads the actor accounts through the auth identity
projection, which closes the ring through the plugin pages and the plugin management. Every one of the
144 rings is registered in `KNOWN_CYCLES` with a reason that names the approved edges of the ring, in
the style of the neighbouring rings. The register holds **600** rings in total (456 before this batch);
the growth is the documented debt of the widened scan (§5o, item 7).

### The known violations

The section is unchanged: the four entries are still open and still anchored to a real violation (the
migration executor's raw `admin_audit_events` write, the second writer of `product_variants.stock`, the
second writer of `admin_audit_events`, and the `plugin_installations` write of the infra event
delivery). The widened scan finds no violation that is not already registered, so no entry was added and
no source file was touched.

### The gate evidence

- `pnpm --filter api type-check` — **exit 0**.
- The audit is a static, database-free check. It was executed over the combined tree with the
  TypeScript compiler API outside vitest (the same analysis the test performs, with the assertions
  unchanged): **10 of 10 assertions pass** — the table owners, the reasons, the exact edge set, the
  exact ring set, the unapproved imports, the public exports, the cross-domain writes, the domain model,
  the anchored known violations and the scanned file set.
- The sharded gate over the combined tree is **the coordinator's**: this batch does not run
  `pnpm verify:quick` and does not run vitest, because two gates must never share the database.

## 5y. Handover evidence — WP-F1B (the core calls the fulfilment contract and records the fulfilment on the shipment)

**Baseline:** `e7f73487cf`. **Branch:** `codex/core-extension-boundary` / `worktrees/jiffoo-core-extension-boundary`.
**Test DB:** `jiffoo_core_test` (the integration worktree, no lane). **Executor:** `wp-f1b`.
**Files:** `apps/api/src/core/order/service.ts`, `apps/api/src/core/admin/order-management/{service,schemas}.ts`,
`apps/api/tests/core/order-fulfillment-contract.test.ts`, `apps/api/prisma/schema/commerce.prisma`,
`apps/api/prisma/migrations/20261026135338_order_fulfillment/migration.sql`, `docs/coordination-ledger.md`.

### The schema change and the migration

The `shipments` table carries two new **nullable** columns and one new index:

| Column | Type | Meaning |
|---|---|---|
| `fulfillmentId` | `TEXT` (nullable) | the identifier of the fulfilment the provider created for the order |
| `fulfillmentStatus` | `TEXT` (nullable) | the status the provider reported for that fulfilment |

plus `CREATE INDEX "shipments_fulfillmentId_idx" ON "shipments"("fulfillmentId")`.

The migration is `apps/api/prisma/migrations/20261026135338_order_fulfillment/migration.sql`: two
`ALTER TABLE "shipments" ADD COLUMN` statements and the index. Both columns are nullable, so the
migration is additive and a store that never installs a fulfilment provider keeps its rows unchanged.
The gate applies it when it resets the test database.

### The public method of the order module

`OrderService.requestFulfilment(orderId)` in `apps/api/src/core/order/service.ts`:

- it resolves the provider with `resolveSingleProvider('fulfillment')` from the read-only registry and
  answers `null` when the store has no fulfilment provider;
- it calls the contract with `callContract(provider.pluginSlug, 'fulfillment',
  PLUGIN_CONTRACT_VERSIONS.fulfillment, 'createFulfillment', { orderId, items, address, idempotencyKey })`,
  where the items carry the `orderItemId`, the `variantId` and the `quantity` of the order items, the
  address is the shipping address of the order and the idempotency key is `fulfillment:<orderId>`;
- it answers the fulfilment identifier and status of the provider, plus its carrier, tracking number and
  tracking url when the provider answers them;
- it runs **outside** every database transaction.

The admin order module calls it **before** it opens its own transaction and passes the result into
`OrderService.shipOrder`, which writes `fulfillmentId` and `fulfillmentStatus` on the shipment row. The
carrier and the tracking number of the shipment stay the ones the administrator supplied; the extra
values of the provider that the shipment does not carry go into the existing `metadata` column of the
shipment (`fulfillmentCarrier`, `fulfillmentTrackingNumber`, `fulfillmentTrackingUrl`).

### The two new optional fields of the admin order detail

The admin order detail response gains two optional, nullable fields on every shipment:

| Field | Type | Meaning |
|---|---|---|
| `fulfillmentId` | `string \| null` | the identifier of the fulfilment the provider created |
| `fulfillmentStatus` | `string \| null` | the status the provider reported for the fulfilment |

They are additive: no HTTP status, no error code and no message of an existing path changes, and the
fields are not in the `required` list of the shipment schema. `apps/api/openapi.json` was regenerated
with `pnpm --filter api export:openapi` and carries exactly these two fields.

### The degradation rule

A fulfilment provider is an extension, and an extension never blocks the core flow:

- a store without a fulfilment provider ships exactly as before, and the two columns stay `NULL`;
- a provider that is disabled, that times out, that answers an invalid response or that fails is
  recorded with `recordPluginFailure` and the method answers `null`; the shipment is still created with
  the carrier and the tracking number of the administrator, and the order still moves to `SHIPPED`;
- the provider call runs outside the transaction of the shipment, so a slow provider never holds a
  database transaction open.

The builtin manual fulfilment answers a pending fulfilment and nothing else, so a store that has it
installed sees the same order flow, the same shipment, the same carrier, the same tracking number and
the same statuses; the two new columns are the new information that is recorded.

### The verification of this batch

- `pnpm --filter api type-check` — **exit 0**.
- `pnpm --filter api lint` — **exit 0** (487 warnings, 0 errors; the warnings are pre-existing).
- `pnpm --filter api export:openapi` — **exit 0**, `apps/api/openapi.json` regenerated.
- `pnpx prisma format --schema apps/api/prisma/schema` — run; the formatting of the schema directory is
  **not** clean at the baseline either, so only the `Shipment` model was realigned and the other models
  and the other schema files were left byte-identical to the baseline.
- The gate is **the coordinator's**: this batch does not run `pnpm verify:quick` and does not run
  vitest, because two gates must never share the database. The new test file
  `apps/api/tests/core/order-fulfillment-contract.test.ts` is part of the gate.

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

## 5z. Handover evidence — S3-DATA (the step 3 data-reliability remediation)

**Commit:** `cccbae535`.

### What the batch changed

| Area | Before | After |
|---|---|---|
| API token storage | the token records were a JSON array inside `system_settings.settings`, and every operation on them was a read-modify-write of that whole blob | the records live in the new `api_tokens` table, owned by `core/auth`; a create, a revoke and the usage stamp are single-row conditional writes |
| API token revocation | a concurrent usage write could carry the pre-revocation `revokedAt` back and resurrect the token | the usage stamp carries the `revokedAt: null` predicate, so it can never undo a revocation |
| API token entropy | `sha256(Date.now() + Math.random())` | `crypto.randomBytes(32)` |
| `users.username` | no unique constraint, so the registration check was a check-then-act | the registration serialises on a transaction-scoped advisory lock and re-checks inside the lock |
| cart quantity | `existing + n` read-modify-write, outside a transaction | an atomic `{ increment: n }` on the line the compound unique key identifies |
| cart line identity | nothing stopped two rows for one `(cartId, variantId)` | `@@unique([cartId, variantId])`, and the write goes through it |
| cart write boundary | three independent statements | one transaction for the cart, its line and the quota rows |
| `removeFromCart` | the `userId` argument was ignored, so any customer could delete any cart line | the delete is scoped to the cart of the caller and answers `NOT_FOUND` |
| payment verification | reachable without credentials; it called the provider and wrote the payments table | it requires a JWT, is scoped to the owner of the order, and is rate-limited per customer and per payment |
| reconciliation attempt budget | the verification endpoint ran the reconciler's budget branch | that branch is gated on the reconciliation claim, so only the background reconciler spends it |
| order state machine | read-then-write; the safety came only from the caller's row lock | every transition carries the state it read as its own predicate and re-reads on a lost race |
| admin cancellation | relied on its caller to hold the order lock | it takes the order lock itself |
| order list cache | the customer-facing order writes never invalidated the cached admin list | the version is bumped after the transaction, and it is captured once so a bump during a query cannot poison the new key |
| catalogue stock read | the stock was read through the global client, even inside a transaction | the catalogue reads it through the caller's transaction |
| transaction boundaries | the outbox sweep, the plugin task claim and recovery, the plugin storage admission and the builtin sync held a transaction open across unbounded work | each is bounded, the filesystem and packaging work is outside the transaction, and no Redis call is left inside a transaction |
| N+1 paths | the plugin list, the extension installer list, the plugin page declarations, the admin order detail and the generated SKU resolution queried per row | they are batched |

### The contract changes this batch registers

1. `GET /api/v1/payments/verify/:paymentId` — the success body is unchanged, and the route now also answers `401` without credentials, `404` for a payment that is not the caller's, `429` when a request budget is exhausted and `503` when shared protection is unavailable. The storefront reaches it through the shop BFF, which forwards the access token.
2. `DELETE /api/v1/cart/items/:itemId` — a line that belongs to another customer now answers `404` instead of deleting it silently.
3. `DELETE /api/v1/admin/api-tokens/:tokenId` — the shape is unchanged; the revocation now also records the administrator that made it, in `revokedBy`.
4. The plugin task transition has a loud bound: an installation with more than 1000 active tasks answers `409 PLUGIN_TASK_LIMIT_CONFLICT` instead of running an unbounded transaction.

### The table ownership this batch registers

- `api_tokens` — owner `core/auth`. The api-token module no longer reaches the `system_settings` row of `core/settings` for the token list, so the `auth -> settings` edge of the boundary register is gone with it.

### The gate evidence

`pnpm verify:quick` on the integration lane (`jiffoo_core_test`), the planner-driven selection, against the tree of `cccbae535`:

```
=== Final test summary ===
Scope: default
Lane: integration
Database: jiffoo_core_test
Run changed API tests:
   Start at:  20:05:06
 Test Files  129 passed (129)
      Tests  1947 passed (1947)
Run Shop tests:
   Start at:  20:26:12
 Test Files  38 passed (38)
      Tests  266 passed (266)
Run API tests:
   Start at:  20:26:32
 Test Files  18 passed (18)
      Tests  414 passed | 2 skipped (416)
Run Admin tests:
   Start at:  20:28:14
 Test Files  4 passed (4)
      Tests  37 passed (37)
Run Shop tests:
   Start at:  20:28:17
 Test Files  2 passed (2)
      Tests  3 passed (3)

| Step | Result | Duration |
| --- | --- | --- |
| Prisma generate | PASS | 0.01s |
| Type-check API, Admin, Shop and shared | PASS | 2.66s |
| Lint Shop | PASS | 5.95s |
| Reset test database | PASS | 2.29s |
| Check Prisma migration drift | PASS | 1.20s |
| Run changed API tests | PASS | 1270.10s |
| Run Shop tests | PASS | 20.06s |
| Run API tests | PASS | 102.26s |
| Run Admin tests | PASS | 2.37s |
| Run Shop tests | PASS | 1.71s |
```

The three new migrations apply cleanly on a fresh database, and the Prisma migration drift gate passes, so the datamodel and the database agree on every index the batch added.

### The two review passes and what they changed

- The P0/P1 review found one P1 and five P2. The P1 was a cache-version TOCTOU in the admin order list: the reader read the version before the query and again at write time, so a bump during the query stored the pre-write snapshot under the post-write key. The version is now captured once and threaded into the write.
- The performance and transaction-boundary review found one P1 and five P2. The P1 was the builtin sync: the install branch still ran inside the outer transaction while the installer wrote through the global client, so a failure rolled the blob and the audit row back and left the install row and the published directory behind. The sync now holds a session-scoped advisory lock on its own connection and writes the install outside the transaction.
- The coordinator arbitrated one conflict between two packages of this batch: making `consumePurchasedItems` join the per-cart advisory lock broke a pre-existing product test that requires a concurrent cart edit to be applied while the order still commits completely. The consumption keeps the line row lock - it runs inside the order transaction, which already holds the stock row lock, and the order must never wait for the cart.

### What is still open

- The plugin task transition bound of 1000 active tasks per installation is a behaviour change that the batch accepts deliberately: the alternative is the unbounded transaction the review forbids.
- `apps/api/tests/core/plugin-tasks.test.ts` failed once in a serial full run with a load-sensitive timing assertion ("the task eventually succeeds") and passed in isolation and in the next full run. It is a flake of the existing test, not a defect of this batch, but it is worth a look.
- The `api_tokens` table carries a `revokedBy` column that records the administrator that revoked the token; an installation that predates the migration has no value in it, which is the expected state for a null column.

## 5za. Handover evidence — S3-DATA-2 (the step 3 data-reliability remediation, part two)

**Baseline SHA:** `7174b2458`. **Commit:** `38cce1eac`.

### What the batch changed

| Area | Before | After |
|---|---|---|
| The currency of an order | the order create never wrote a currency, so every order and every order line fell back to the schema default `USD` while the payment charged `order.currency` | the order and every line store the currency of the store, and the order response reports the currency stored on the order |
| The amount of an order | the subtotal, the tax lines and the total were IEEE-754 doubles, so a basket whose prices do not sum exactly (`79.99 + 19.99 = 99.97999999999999`) was refused with `400 VALIDATION_ERROR` | every amount of the placement is computed in the minor units of the currency and derived from them, so the basket is placed and the total agrees with the quote exactly |
| A price that is not a price | a negative price reached the write of the order and was answered with `409 QUOTE_CHANGED`, or with an unhandled validation error of the event payload | the price is refused in the price stage with `400 VALIDATION_ERROR`, and the admin product API refuses a negative price as well |
| The idempotency key of an order | a global unique key: two customers could not use the same key | the key is unique per customer (`@@unique([userId, idempotencyKey])`) |
| A plugin amount of a shipping or tax quote | a negative amount was written into the order | a negative or non-finite amount is a `VALIDATION_ERROR` |
| The stock of a variant | an absolute write that overwrote a concurrent sale | the ledgered conditional write with an optional `expectedStock` |
| A negative stock adjustment | the level could go below zero | the write is refused with `409 INSUFFICIENT_STOCK` |
| The cart line | read-modify-write without the lock of the line | every writer of a line holds the row lock of the line, in the order of the database |
| The catalogue read of a cart add | the catalogue was read twice per add, and the two reads could disagree about the answer | the catalogue is read once and the stock of the variant is read through a narrow projection of the product module |
| The payment webhook | one transaction per fact | the facts of one request are prepared outside the transaction and applied in one transaction, sorted by the request key |
| The refund of a capture | a second refund of the same capture with another key was silently ignored | it is a `PAYMENT_IDEMPOTENCY_CONFLICT` |
| The provider account of a payment | the binding opened a second connection inside the caller's transaction | the binding joins the caller's transaction |
| The builtin sync | the install ran inside the outer transaction while the installer wrote through the global client | the sync prepares, commits the install and the audit in one short transaction, and warms the runtime outside every transaction |
| The builtin theme sync | a 120 second transaction around the filesystem work | only the pointer switch and the audit are inside a transaction |
| The registry reads | every request read the plugin tables | the reads are served from the shared cache under a key that names the plugin cache version and the freshness of the two plugin tables |
| A plugin package in a cold package store | a builtin package could only be resolved by the process that had published it, so a process with a private or empty package store answered `503 PLUGIN_PACKAGE_UNAVAILABLE` for a builtin the database names | the package store is a cache of the bytes the database holds: every package, the builtins included, is materialized from the database blob when the store holds no published copy |
| The hot paths of the admin | a count query per table and a cache key without the version | one aggregate, and the version in the key |

### The contract changes this batch registers

1. `POST /api/v1/orders` — the idempotency key is scoped to the customer: two customers may use the same key, and each of them gets their own order. Before, the second customer answered `409 ORDER_IDEMPOTENCY_CONFLICT`.
2. `POST /api/v1/orders` — a basket whose prices do not sum exactly as binary floats is now placed (`201`). Before, it was answered with `400 VALIDATION_ERROR`, because the amount of the placement was a binary float.
3. `POST /api/v1/orders` — a line whose price is negative is answered with `400 VALIDATION_ERROR`. Before, it was answered with `409 QUOTE_CHANGED`, or with an unhandled validation error of the event payload.
4. `PATCH /api/v1/cart/items/:itemId` — a line that a concurrent order already consumed answers `404 NOT_FOUND` instead of a `500` from a Prisma `P2025`.
5. `POST /api/v1/admin/inventory/adjust` — an adjustment that would drive the stock below zero answers `409 INSUFFICIENT_STOCK` instead of storing a negative level.
6. `POST /api/v1/admin/inventory/:variantId/stock` — the optional `expectedStock` makes the write a compare-and-set: a mismatch answers `409 CONFLICT`. The answer carries the stored level, not the level that was asked for.
7. `PUT /api/v1/admin/products/:id` and `POST /api/v1/admin/products` — a variant with a negative price (`salePrice` or the legacy `basePrice`) answers `400 VALIDATION_ERROR` instead of being stored.
8. `POST /api/v1/admin/orders/:orderId/refund` — a second refund of a capture that already carries a completed refund answers `409 PAYMENT_IDEMPOTENCY_CONFLICT` unless it carries the key of that refund.
9. The admin manual payment of a payment that is already resolved answers `409 PAYMENT_REVIEW_ALREADY_RESOLVED`.
10. A plugin package that the database names is now materialized from the database blob when the local package store holds no published copy, the builtins included. The answer is the same package; a missing blob still answers `503 PLUGIN_PACKAGE_UNAVAILABLE`.
11. The order response reports the currency stored on the order instead of the live currency of the store.

### The migration

`apps/api/prisma/migrations/20261028031500_data_reliability_indexes/` adds the scoped unique key of the idempotency key, 23 btree indexes on the hot filter, join and sort columns, seven trigram indexes for the `ILIKE '%term%'` searches, one partial index for the refunds that still owe a refund, and three check constraints (`product_variants_stock_nonnegative`, `orders_amounts_nonnegative`, `auth_tokens_attempts_nonnegative`). It also drops the four single column indexes that a composite index replaces. The scoped unique key is created before the global one is dropped, so the table never loses its uniqueness.

**Deployment note:** the migration takes an `ACCESS EXCLUSIVE` lock on the hot tables while it runs. `CONCURRENTLY` is forbidden by `validateCoreMigrationSql`, so the lock window is the run time of the migration. The migration also creates the `pg_trgm` extension, so the role that applies the migration needs the `CREATE` right on the database; `pg_trgm` is a trusted extension, so the owner of the database is enough.

### The gate evidence

`pnpm verify:quick --shards=4` on the integration lane (`jiffoo_core_test`), the whole API catalogue in four parallel shards with their own PostgreSQL and Redis containers, plus the admin and the shop suite:

```
=== Final test summary ===
Scope: default
Lane: integration
Database: jiffoo_core_test
Planner added suites: not applicable (the shard mode runs the full API catalogue and the full Admin and Shop suites, covering 9 planner-mandated suite(s))
Mode: shard mode (--shards=4)
Run API tests in 4 shards:
Shards: 1, 2, 3, 4 of 4 (4-shard run)
Run scope: full catalogue (4 shard(s))
Scope coverage: 185/185 files covered
Totals: Test Files 185 files, 185 passed | Tests 2603 tests, 2601 passed, 2 pending | Suites 496 suites, 496 passed
Test conclusion: PASS
Cleanup conclusion: PASS
Delivery status: API PASS / cleanup PASS
Run Admin tests:
   Start at:  19:56:03
 Test Files  59 passed (59)
      Tests  592 passed (592)
Run Shop tests:
   Start at:  19:56:34
 Test Files  38 passed (38)
      Tests  266 passed (266)

| Step | Result | Duration |
| --- | --- | --- |
| Prisma generate | PASS | 0.01s |
| Type-check API, Admin, Shop and shared | PASS | 12.92s |
| Lint Shop | PASS | 8.47s |
| Reset test database | PASS | 2.51s |
| Check Prisma migration drift | PASS | 1.24s |
| Run API tests in 4 shards | PASS | 618.16s |
| Run Admin tests | PASS | 31.27s |
| Run Shop tests | PASS | 33.25s |
```

The shard mode is not the complete gate on its own: the browser E2E and the serial full-suite run are not part of it, and CI runs the same API catalogue as four parallel shards of its own.

### The review passes and what they changed

- The independent architecture review of the whole batch found one real defect and three warnings. The defect: a variant with a negative `salePrice` was not refused by the placement, so the order was answered with a misleading `409 QUOTE_CHANGED` or with an unhandled validation error of the event payload, while the new check constraint of the schema would have answered it with a database error. The price is now refused in the price stage with `400 VALIDATION_ERROR`, and the admin product API refuses a negative price as well.
- The warning about the order lines was that they still carried the float price while everything else carried the exact minor amount; the lines are now written from the minor amount.
- The warning about the cart was that the catalogue was read twice per add and that the two reads could disagree about the answer; the catalogue is read once now and the stock of the variant is read through a narrow projection of the product module.
- The warning about the new tests was that the case "three lines of 79.99 in USD" was no longer pinned anywhere after the money error test moved to a currency that cannot express the price; it is pinned again by `order-amount-precision.test.ts`.
- The second review, which covered the new test files and the two static audits, confirmed that every new test fails without the change it covers, and that no test file leaks a row that would break the next file of the shard.

### The two defects the remediation found beyond the audit

- **The currency of the order was never written.** The audit of the step 3 did not find it: the order create wrote no currency, so every order and every line fell back to the schema default `USD`, while the payment session charges `order.currency`. A store that is not in USD therefore charged its customers in EUR and labelled the amount USD, and the payment webhook rejected the capture with `currency_mismatch`.
- **The amount of the order was a binary float.** The checkout quote computes its amounts in the minor units of the currency, but the placement summed the prices as doubles, so the two paths disagreed and a valid basket of `79.99 + 19.99` could never be ordered.

### What is still open

- The cart response still carries a float `subtotal` (`apps/api/src/core/cart/service.ts`), because the cart does not know the currency of the store. The storefront formats it, and the money decisions of the quote and of the placement read the exact amounts, so this is a display imprecision and not a money defect.
- The admin product API accepted a negative price before this batch and still accepts a negative `costPrice`; only the price a customer is charged is bounded now.
- `apps/shop/tests/storefront-code.test.ts` failed once in the sharded gate ("expected TypeError: fetch failed to match object { status: 500 }", the mock server of the test got a port that the fetch of Node refused) and passed in isolation and in every other run. It is a flake of the existing test, not a defect of this batch.
- The `pg_trgm` extension of the migration needs the `CREATE` right on the database for the role that applies it; the deployment note above records it.


## 5zb. Handover evidence — S3-DATA-3 (the remaining items of the step 3 batch)

**Baseline SHA:** `38cce1eac`. **Commit:** `2a432138a`.

### What the batch changed

| Area | Before | After |
|---|---|---|
| The amounts of the cart | the subtotal of a line was a float product and the total of the cart the float sum of those subtotals, so a basket of 79.99 and 19.99 reported `99.97999999999999` | the amounts of the cart are exact decimal arithmetic, so the same basket reports `99.98` |
| The cost price of a variant | the admin product API accepted a negative cost price | a negative cost price is refused with `400 VALIDATION_ERROR` |
| The currency of the request | a dead field: a client could name a currency and the order was placed in the currency of the store, silently | the field is an assertion: a request that names another currency than the store is refused with `400 VALIDATION_ERROR` |
| The trigram extension of the migration | a deployment prerequisite that nothing checked | the verification asserts that the extension is installed, so a deployment without it fails loudly and early |
| The ports of the mock servers of the suite | the operating system hands out the ports of its dynamic range, and that range reaches the blocked port `10080`, which the request of Node refuses | every mock that a request reaches binds a port the request can carry |

### The contract changes this batch registers

1. `POST /api/v1/orders` — a request that names a currency different from the currency of the store is refused with `400 VALIDATION_ERROR`. Before, the field was ignored and the order was placed in the currency of the store without a word.
2. `POST /api/v1/admin/products` and `PUT /api/v1/admin/products/:id` — a variant with a negative `costPrice` is refused with `400 VALIDATION_ERROR`.

### The flake this batch closes

`apps/shop/tests/storefront-code.test.ts` failed once in a sharded gate run with `TypeError: fetch failed` and the cause `Error { message: 'bad port' }`, and passed in isolation and in every other run.

The cause is the environment, not the test: the request of Node refuses the ports that the specification blocks for a browser request, and that list ends with `10080`. The TCP dynamic port range of this host is `10000-65535` (`netsh int ipv4 show dynamicport tcp`), so the operating system hands out `10080` once in a while — roughly one bind in fifty-five thousand — and the request of the mock then fails before it reaches the mock.

Every test of the three suites that binds an ephemeral port and then sends a request to it carried the same exposure, and one of them (the child process of `apps/api/tests/helpers/protection-child.ts`) owned its own listener. The batch gives the suites a helper (`apps/api/tests/helpers/mock-server-port.ts`, `apps/shop/tests/helpers/mock-server-port.ts`, `apps/admin/tests/mock-server-port.ts`) that listens again when the operating system handed out a blocked port, and that reserves a port of its own for a server that cannot listen twice.

### What is still open

- Nothing of the five items the previous section listed is open any more. The deployment note of the `pg_trgm` extension stays: the role that applies the migration needs the `CREATE` right on the database, and the verification now says so by asserting that the extension is installed.

### The gate evidence

`pnpm verify:quick --shards=4` on the integration lane (`jiffoo_core_test`), the whole API catalogue in four parallel shards with their own PostgreSQL and Redis containers, plus the admin and the shop suite:

```
=== Final test summary ===
Scope: default
Lane: integration
Database: jiffoo_core_test
Planner added suites: not applicable (the shard mode runs the full API catalogue and the full Admin and Shop suites, covering 3 planner-mandated suite(s))
Mode: shard mode (--shards=4)
Run API tests in 4 shards:
Shards: 1, 2, 3, 4 of 4 (4-shard run)
Run scope: full catalogue (4 shard(s))
Scope coverage: 185/185 files covered
Totals: Test Files 185 files, 185 passed | Tests 2607 tests, 2605 passed, 2 pending | Suites 496 suites, 496 passed
Test conclusion: PASS
Cleanup conclusion: PASS
Delivery status: API PASS / cleanup PASS
Run Admin tests:
   Start at:  21:29:17
 Test Files  59 passed (59)
      Tests  592 passed (592)
Run Shop tests:
   Start at:  21:29:35
 Test Files  38 passed (38)
      Tests  266 passed (266)

| Step | Result | Duration |
| --- | --- | --- |
| Prisma generate | PASS | 0.01s |
| Type-check API, Admin, Shop and shared | PASS | 3.44s |
| Lint Shop | PASS | 9.68s |
| Reset test database | PASS | 3.06s |
| Run API tests in 4 shards | PASS | 702.95s |
| Run Admin tests | PASS | 18.33s |
| Run Shop tests | PASS | 21.42s |
```

The shards: 46/46, 45/45, 47/47, 47/47 files, no failed file in any of them; 185/185 files covered, none missing, none extra, no cross-shard duplicate, no empty shard; the cleanup verdict is PASS. The step table has no drift step because this batch changed no file under `apps/api/prisma` — the datamodel and the database still agree, and the drift step of the previous batch proved it.

The browser E2E and the serial full-suite run are not part of the shard mode; CI runs the same API catalogue as four parallel shards of its own.

## 5zc. Handover evidence — S3-DATA-4 (the step 3 review remediation)

**Baseline SHA:** `6efe2ae67`. **Commit:** `99eac5dc`.

### What the review was

The batch of `2a432138a` was reviewed by three independent read-only reviewers, one for each axis of the step 3: the validity of the anti-duplicate and anti-oversell protections, the purity of the transaction boundaries and the order of the commit, and the safety of the schema migration with the zero-regression gate. The first pass raised thirteen warnings and no failure. Every finding went back to the worker that owned the module; the second pass over the repaired diff raised eight more findings, one of them a defect the repair itself had introduced; a third pass confirmed all eight closed.

### The thirteen findings of the first pass

| # | Finding | Before | After |
|---|---|---|---|
| 1 | the batch add of the cart had no stock ceiling | the batch wrote a line that no stock covered | the ceiling of every line is checked before any line is written, and the quantities of the lines that share a variant are summed first |
| 2 | the unguarded stock write absorbed a concurrent sale | the write set the absolute level again after its retry, so the sold units vanished from the stock | the change is a conditional increment on the level the change is based on; a level that moved under the write is a conflict |
| 3 | the admin variant write was last-writer-wins | two concurrent admin edits of one variant overwrote each other | the variants of a product are locked before they are read |
| 4 | the order path and the admin path locked the variants in different orders | two writers of the same rows could deadlock | both take the rows in the ascending order of the variant id |
| 5 | a unique violation of any constraint was reported as "already applied" | the webhook answered 200 for a payment that was never recorded | only the payment ledger and the outbox of the event mean "already applied"; every other violation is rethrown |
| 6 | a unique violation was swallowed inside the transaction of the caller | the caller's transaction stayed aborted and its next statement failed with 25P02 | the caller-owned path rethrows and the transaction rolls back cleanly |
| 7 | the registry read opened a second connection inside the transaction of the caller | the read was outside the snapshot of the caller | the read joins the transaction of the caller, and the cache is not used on that path |
| 8 | the write transactions ran on the Prisma defaults | a write of a payment or of a stock level could be cut off after five seconds | the payment, inventory, theme, plugin and notification transactions carry explicit bounds |
| 9 | the guard against a provider replacement inside the transaction of the caller lived only in a private wrapper | an external caller could still trip the hole | the plan refuses unless the caller declares that it owns no transaction |
| 10 | the migration was never executed | the migration was only read as text | the verification executes it through the real migration executor |
| 11 | the check constraints were asserted by one column | a rule that covered fewer columns passed | all four rules are compared exactly |
| 12 | the raw indexes of the migration were not registered | the register did not know them | eight rows, and the prose of the register is true |
| 13 | the cart batch did not declare its conflict response | the OpenAPI surface did not match the route | the route declares the 409 |

### The two false alarms

- The allocation of the order number is atomic: the statement is `INSERT ... ON CONFLICT (day) DO UPDATE SET last_value = last_value + 1 RETURNING last_value`, so two concurrent placements cannot take the same number.
- The unique index `refunds_one_completed_per_capture` exists: `apps/api/prisma/migrations/20261010120922_payment_contract_v2/migration.sql` creates it.

### The contract changes this batch registers

1. `POST /api/v1/cart/items/batch` — a batch that exceeds the stock ceiling of a variant is refused with `409 INSUFFICIENT_STOCK`. Before, the batch wrote the line and the order placement refused the sale.
2. `POST /api/v1/cart/items/batch` — a product that is not sellable is refused with `400 BAD_REQUEST`. Before, it was `500 INTERNAL_SERVER_ERROR`.
3. `PUT /api/v1/admin/products/:id` — an admin product edit whose stock moved under the write is refused with `409 CONFLICT`. Before, the edit silently absorbed the concurrent sale and answered 200. The route already declared the 409.

### The deployment note

The migration `20261028031500_data_reliability_indexes` of the batch before runs in ONE transaction, with `lock_timeout='5s'` and `statement_timeout='600s'` (`deploy/release/core-migrations.mjs`). It creates its indexes without `CONCURRENTLY` and adds the check constraints, so it holds a share lock on the hot tables and an access exclusive lock on the altered ones for the whole migration. It must run in a maintenance window. The lock timeout makes it fail fast instead of queueing behind a long transaction, and because it is one transaction a failure rolls the whole migration back, so it can be retried. Splitting it is not an option: the validator forbids `CONCURRENTLY`, and an existing migration must never be edited.

### The selection basis of the local gate

The baseline is `6efe2ae67` and the changed input is the tree of `99eac5dc`: sixteen source files and six test files. The scoped gate selected the fifty files of the touched modules — the order, cart, inventory, product, payment, theme, plugin, notification and event suites, the two module audits, the migration executor suite and the three contract suites. The planner added nothing, because the selection already held the contract suites that the change of the cart schema makes mandatory. The full shard gate then ran the whole catalogue.

### What is still open

- The admin order search still matches the id of the order with `contains`, and no trigram index serves it, so the disjunction over the id forces a sequential scan of the orders table even though the order number, the email and the user name are indexed. Closing it needs a second migration, so it is not part of this batch.
- When the engine reports no target for a unique violation, a violation of the partial index `payment_ledger_one_accepted_capture_per_order` cannot be told apart from a violation of the capture keys. It is reported as "already applied", which is the right answer for the capture keys and for the partial index as well (the order already carries an accepted capture), but a semantic re-check would make the distinction explicit.
- The browser E2E is not part of the local gate; CI runs it.

### The gate evidence

The scoped gate over the fifty selected files (`pnpm verify:quick --test-files=…`, the integration lane `jiffoo_core_test`):

```
=== Final test summary ===
Scope: default
Lane: integration
Database: jiffoo_core_test
Planner added suites: none
Run API tests:
   Start at:  12:15:05
 Test Files  50 passed (50)
      Tests  809 passed | 2 skipped (811)

| Step | Result | Duration |
| --- | --- | --- |
| Prisma generate | PASS | 0.01s |
| Type-check API, Admin, Shop and shared | PASS | 13.41s |
| Lint Shop | PASS | 7.89s |
| Reset test database | PASS | 3.22s |
| Run API tests | PASS | 548.47s |
```

The full shard gate over the whole catalogue (`pnpm verify:quick --shards=4`, the integration lane `jiffoo_core_test`):

```
=== Final test summary ===
Scope: default
Lane: integration
Database: jiffoo_core_test
Planner added suites: not applicable (the shard mode runs the full API catalogue and the full Admin and Shop suites, covering 3 planner-mandated suite(s))
Mode: shard mode (--shards=4)
Gate note: the API suite ran in parallel shards. The Prisma generate, the type check, the Lint Shop step, the test database reset, the Admin suite and the Shop suite ran as well.
Gate note: this mode is not the complete gate: the browser E2E and the serial full-suite run are not part of it.
Run API tests in 4 shards:
Shards: 1, 2, 3, 4 of 4 (4-shard run)
Run scope: full catalogue (4 shard(s))
Scope coverage: 187/187 files covered
Totals: Test Files 187 files, 187 passed | Tests 2627 tests, 2625 passed, 2 pending | Suites 499 suites, 499 passed
Test conclusion: PASS
Cleanup conclusion: PASS
Delivery status: API PASS / cleanup PASS
--- File coverage ---
Catalogue files (vitest list --filesOnly, same exclusions, same environment as the shards): 187
Expected set (the full catalogue, not the assigned subset): 187
Assigned to this run: 187
Executed (union over all shards): 187
Shard 1: 47 files
Shard 2: 46 files
Shard 3: 47 files
Shard 4: 47 files
Missing files: none
Extra files: none
Cross-shard duplicates: none
Empty shards: none
Coverage verdict: PASS
--- Shard results ---
| Shard | Exit | Duration | Start at | Test Files | Tests | Failed files |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 0 | 685.8s | 12:26:14 | 47 files, 47 passed | 724 tests, 724 passed | none |
| 2 | 0 | 525.8s | 12:26:15 | 46 files, 46 passed | 452 tests, 452 passed | none |
| 3 | 0 | 561.5s | 12:26:16 | 47 files, 47 passed | 742 tests, 740 passed, 2 pending | none |
| 4 | 0 | 589.9s | 12:26:17 | 47 files, 47 passed | 709 tests, 709 passed | none |
Run Admin tests:
   Start at:  12:37:35
 Test Files  59 passed (59)
      Tests  592 passed (592)
Run Shop tests:
   Start at:  12:37:56
 Test Files  38 passed (38)
      Tests  266 passed (266)

| Step | Result | Duration |
| --- | --- | --- |
| Prisma generate | PASS | 0.01s |
| Type-check API, Admin, Shop and shared | PASS | 3.34s |
| Lint Shop | PASS | 9.08s |
| Reset test database | PASS | 3.54s |
| Check Prisma migration drift | PASS | 1.43s |
| Run API tests in 4 shards | PASS | 700.76s |
| Run Admin tests | PASS | 21.39s |
| Run Shop tests | PASS | 23.70s |
```

The shards: 47/47, 46/46, 47/47, 47/47 files, no failed file in any of them; 187/187 files covered, none missing, none extra, no cross-shard duplicate, no empty shard; the cleanup verdict is PASS. The drift step ran this time, because the batch changed a file under `apps/api/prisma` (the register of the raw indexes), and the datamodel and the database still agree.

The browser E2E and the serial full-suite run are not part of the shard mode; CI runs the same API catalogue as four parallel shards of its own.
