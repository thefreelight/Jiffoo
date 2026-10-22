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
| **B-BOUND-B** — order domain single owner (WP-B) | Boundary-remediation line | `codex/lane-orders` | `49dc5ff1a` + B-BOUND-A | `apps/api/src/core/order/**`, `apps/api/src/core/payment/{reconciliation,session,order-paid-event}.ts`, `apps/api/src/core/admin/order-management/**`, `apps/api/src/core/notifications/service.ts` | `jiffoo_core_test_orders` | not assigned | **registered, blocked** — overlaps B-P3P4 on `core/order/service.ts` (§4) | needs contract agreement with B-P3P4 first |
| **B-BOUND-C** — neutral layer + directory re-layering (WP-C) | Boundary-remediation line | `codex/lane-orders` | TBD | new `apps/api/src/core/shared/**`; move `core/admin/system-settings`→`core/settings`, `core/admin/plugin-management`+`extension-installer`→`core/extensions`; retarget imports in `core/storage/**`, `core/plugin-pages/asset-routes.ts` | `jiffoo_core_test_orders` | not assigned | **registered, not started** | depends on B-BOUND-B for `core/order/**` import churn |
| **B-BOUND-D** — audit outlet, dead code, boundary guard, plugin risk register (WP-D) | Boundary-remediation line | `codex/lane-orders` | TBD | new `apps/api/src/core/audit/service.ts` + 9 audit call sites; delete `apps/api/src/core/user/`, `apps/api/src/core/order/hooks.ts`; new `apps/api/tests/core/module-boundary-audit.test.ts`; `docs/agentra-001-core-v1-product-charter.md`; `packages/shared/src/extensions/plugin-contract.ts`; `BUILTIN_PLUGIN_SLUGS` → `@jiffoo/shared` | `jiffoo_core_test_orders` | not assigned | **registered, not started** | last in sequence: touches `packages/shared` → widest mandatory gate |
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
