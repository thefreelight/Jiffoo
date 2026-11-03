# Coordination Ledger — Jiffoo Core parallel development

**Status:** active
**Purpose:** single shared task ledger for the two parallel lines working on Jiffoo Core.
**Owner of integration merge & push:** the P-3/P-4 main line. The boundary-remediation line
produces **independent commits + verification evidence** and participates in review. Unified merge
is a Git-conflict-avoidance measure only; it is not a seniority relation.

> **Where this file lives.** The canonical copy of this ledger is the one on the branch of record,
> `codex/core-extension-boundary`, in the integration worktree. Section 5s records the decision and
> the reason: the lane branches are historical, and the registers of the boundary audit are
> calibrated for the tree of the branch of record. A change to this file is therefore committed on
> the branch of record, by the coordinator, and the lane branch is not evolved on its own.

> **How to read the numbers.** Every section below is a record of what was true on the day it
> names: the gate output of that batch, the file counts of that run, the register of that tree. The
> numbers inside a handover section are that day's numbers and are not to be read as today's.
> **Section 0 carries what is true today** — the branches, the registers of the boundary audit, what
> is implemented and what is still open. When a handover section and section 0 disagree, section 0
> is the current one and the handover section is the record of its day.

---

## 0. The state of the line

**Measured on:** 2026-10-31, against the tree of the branch of record. The open items were extended
on 2026-11-01 (§5zw, §5zy, §5zaa); the other rows are the measurement of 2026-10-31 and were not
re-measured.

### The branches

| Branch | What it is |
| --- | --- |
| `codex/core-extension-boundary` | the branch of record; CI runs it; the registers of the boundary audit are calibrated for it |
| `codex/lane-orders` | the historical development branch of the boundary line; merged into the branch of record (§5s), not to be evolved on its own |
| `codex/lane-core-uiux` | the user-interface closeout lane; merged into the branch of record (§5zj) |
| `codex/lane-plugins` | the plugins lane, on its own branch, with `jiffoo_core_test_plugins` and Redis DB 13 |
| `main` | the diverged release and publication line; the line is not merged into it |

The merge base with `main` is `7522a4f6d` and has not moved. The conflict surface was re-measured on
2026-10-31 and is unchanged: 629 files differ in the merged result and 293 are real conflicts, the
numbers §5zi recorded on 2026-10-30.

### The registers of the boundary audit

| Register | Count |
| --- | --- |
| approved module edges (`LEGAL_EDGES`) | 192 |
| registered dependency rings (`KNOWN_CYCLES`) | 600 |
| registered violations (`KNOWN_VIOLATIONS`) | 4 |

The four violations are the raw `admin_audit_events` write of the migration executor, the stock
column split on `product_variants`, the second writer of `admin_audit_events` in the admin audit
events module, and the `plugin_installations` write of the infra event delivery. §5g lists the two
that were open when it was written; §5w names all four.

### What is implemented

| Area | State |
| --- | --- |
| the boundary remediation of the lane line | merged into the branch of record in three merges, each with a green local gate and a green CI run (§5s) |
| the plugin pages, the private storage and the durable tasks | implemented (P-1 through P-4 and G1 of the plugin design) |
| the core-mediated plugin services and the paid-order reconciliation | the call path, the durable service call ledger, the paid-order read, the service dependency graph, the admin permission surface, the SDK's client generator and the deployment secret are implemented (§5zae, §5zaf, §5zag) |
| the in-place upgrade of a plugin package, the business rejection of a plugin service, the catalogue of the store currencies and the storefront marker of a degraded tax | implemented (§5zai) |
| the refresh of the token of a live plugin page | implemented: a refused refresh keeps the page, the bridge refreshes the token when it is about to expire (§5zaj) |
| the hard deadline of the shutdown | implemented: the timer that arms the deadline decides that it passed, so the forced close no longer depends on a measured elapsed (§5zak) |
| the published types of the SDK | implemented: the deliberate refusal of a plugin, its marker and the guard that reads the marker are declared in the type snapshot, so a plugin raises the refusal without declaring the marker itself (§5zal) |
| the diagnostic gate mode and the filtered browser E2E | implemented (§5zr) |
| the local gate selects the suites a shared change reaches | implemented (§5zac) |
| the rule file | reduced to the development norms, with no code fact in it (§5zs, §5zt, §5zu) |
| the documentation set | seven live documents and an archive of the dated records (§5zx, §5zz) |

### The open items

| Item | Section | State |
| --- | --- | --- |
| the registered dependency rings | §5o item 7 | open; 600 rings, unchanged |
| the currency catalogue of the settings page against the shared catalogue | §5ze, §5zai | closed on 2026-11-02; the shared package owns the list of the store currencies, the money module, the settings page and the presentation catalogue read it, and a test keeps the list and the catalogue equal |
| the storefront does not read the marker of a degraded tax quote | §5zg, §5zai | closed on 2026-11-02; the storefront reads the marker and says that the tax is being calculated instead of showing an empty total |
| a dead plugin file cleanup row holds the storage quota of its plugin | §5zg | open; the quota is released only on the successful cleanup path, so a row that exhausts its attempt budget keeps its reservation |
| a successful service call does not record a success sample at the breaker | §5zai | open as of 2026-11-02; the service path records only failures, so the failure history of a provider never slides out of the window and a probe that succeeds never closes the circuit; the contract path and the gateway path record the success, the service path does not |
| a store that moves to a zero-decimal currency with fractional prices | §5ze | open; the merchant has to re-price |
| an audit row may be lost when the database refuses the write | §5zg, §5zh | open by decision; the money state is the truth that must not be undone |
| the conflict surface against `main` | §5zi | measured and unchanged; it is not resolved here |
| the bridge version a downstream plugin links | §5zw, §5zaj | open as of 2026-11-03; the tree builds the bridge `1.0.0-alpha.2`, which refreshes the token of the frame when it is about to expire, and the imager package links a bridge tarball labelled `1.0.0-alpha.4` whose four dist files are the build of the tree before that change, so it has to be re-vendored from the tree |
| the SDK tarball a downstream plugin links | §5zag, §5zai, §5zal | open on the imager side as of 2026-11-03; the tree publishes the SDK `1.0.0-alpha.3`, re-delivered with the published types of the business rejection, and the SDK tarball the imager package links carries the service types and the client generator but not the published class of the refusal, so it has to be re-vendored from the tree |
| the bridge does not ride the Core release as an asset | §5zab | open as of 2026-11-01; the artifact builds, packs and verifies outside the monorepo and the design names it as a release asset, but the release step that attaches it is not wired, because the repository has no release-asset mechanism; npm publishing is deferred by the design until the owner supplies an npm organisation |
| the plugin service contract (G4) and the paid-order reconciliation (G4-R) | §5zae, §5zaf, §5zag | delivered on the Core side on 2026-11-02; the call path, the grant check, the durable service call ledger, the paid-order read, the service dependency graph, the admin surface, the SDK's client generator and the deployment secret are reviewed and green; the provider plugin and the consumer's own work are outside Core |
| the adversarial acceptance cases of G4 and G4-R that the design names | §5zag, §5zah, §5zai | partly closed on 2026-11-02; the tampered and the expired cursor, the disabled context, the page budget, the browser-token access, the provider error passthrough, the undeclared method, the wildcard provider, the refund state and the catalogue snapshot of the line have a test now; what is still owed is the grant in a task handler and in a failure hook, and the timeout outcome of the call ledger |
| a shared message label still selects the API suites that boot the app | §5zag, §5zah | closed on 2026-11-02; the labels of the exported records have a module of their own, the API reads that module and the shared barrel no longer carries the catalogue, so a change of a merchant label selects 53 suites instead of 217 |
| the imagic page code in a real browser | §5zw | open as of 2026-11-01; the Core mechanism is proven by the browser E2E, the plugin's own page is not |
| the update acceptance of the deployment update | §5zy | fixed in the tree on 2026-11-01; the deployment environment now carries the test-signing configuration, and the update jobs of CI are its check |

The items §5o lists as closed are closed: `callContract` moved into the neutral runtime module
with the rest of the gateway, the cross-domain reads go through the public projections, the guard
scans the infra and the job layers, the inventory ledger is written on the order path, the money
module has a neutral error, the upload service has a framework-neutral input, and the shard gate
was balanced by measured duration.

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

## 2. Occupancy of the merge (2026-10-22)

This is the occupancy as it stood when the merge was prepared, and it is kept as the record of
that day. Section 0 carries the branches as they are now.

| Resource | Holder | Worktree / branch | Test DB | Redis DB | Since |
|---|---|---|---|---|---|
| Write: integration tree | P-3/P-4 main line | `worktrees/jiffoo-core-extension-boundary` / `codex/core-extension-boundary` | `jiffoo_core_test` | 15 | 2026-10-22 |
| Verify: integration tree | P-3/P-4 main line | `worktrees/jiffoo-core-extension-boundary` | `jiffoo_core_test` | 15 | 2026-10-22 |
| Write: orders lane | Boundary-remediation line | `worktrees/jiffoo-lane-orders` / `codex/lane-orders` | `jiffoo_core_test_orders` | 12 | 2026-10-22 |
| Verify: orders lane | Boundary-remediation line | `worktrees/jiffoo-lane-orders` | `jiffoo_core_test_orders` | 12 | 2026-10-22 |
| Plugins lane (third party) | plugins lane | `worktrees/jiffoo-lane-plugins` / `codex/lane-plugins` | `jiffoo_core_test_plugins` | 13 | pre-existing |

Lane registry (`scripts/lane-config.cjs`): `plugins`→13, `orders`→12, `storefront`→11.
`jiffoo_core_test_orders` was provisioned on 2026-10-22 with `scripts/lane-provision.mjs --apply`.

## 3. Batch registry of the merge (2026-10-22)

Every batch in this table was registered when the merge was prepared, and every one of them has
since been merged into the branch of record (§5s lists the three merges and their gates). The
status column is the status of that day, not of today.

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
| **B-BRIDGE-A** — the plugin bridge becomes an installable artifact with a checked provenance: a build script, a clean-install verification and the distribution rule in the plugin design | Core line (coordinator session) | `codex/core-extension-boundary` / `worktrees/jiffoo-core-extension-boundary` | `668fbcb7b` | `packages/plugin-bridge/{package.json,README.md,scripts/build.mjs}`, `scripts/plugin-bridge-standalone.mjs`, `scripts/plugin-bridge-standalone.test.mjs`, `scripts/verify-selection.mjs`, `docs/agentra-004-plugin-pages-and-services.md`, `docs/coordination-ledger.md`, `docs/archive/coordination-ledger-handover.md` | `jiffoo_core_test` (integration) | coordinator session | **committed, gate green** | §5zab |
| **B-G4-A** — the core-mediated plugin service contract, part one: the declaration, the call and the result, without the lifecycle graph | Core line | `codex/core-extension-boundary` / `worktrees/jiffoo-core-extension-boundary` | `668fbcb7b` | `packages/shared/src/extensions/plugin-contract.ts`, `packages/plugin-sdk/{src,scripts}/**`, `apps/api/src/core/extensions/runtime/{contract-v1-runtime,plugin-runtime}.ts`, new `apps/api/src/core/extensions/runtime/service-runtime.ts`, `apps/api/tests/core/**`, `docs/agentra-004-plugin-pages-and-services.md` | `jiffoo_core_test` (integration) | to be assigned | **committed; the shared surface, the provider registration and the call path are delivered, the durable service call ledger is not** | §5zad |
| **B-G4-B** — the service contract, part two: the permission grant, the lifecycle graph, the availability gates and the retryable error surface | Core line | `codex/core-extension-boundary` / `worktrees/jiffoo-core-extension-boundary` | `668fbcb7b` | `apps/api/src/core/extensions/**`, `apps/api/src/core/admin/extension-installer/**`, `apps/api/prisma/**`, `apps/api/tests/core/**`, `docs/agentra-004-plugin-pages-and-services.md` | `jiffoo_core_test` (integration) | to be assigned | **delivered, reviewed and green: the durable service call ledger, the service dependency graph, the availability gates, the admin surface, the SDK's client generator and the deployment secret** | §5zae, §5zaf, §5zag |
| **B-G4-R** — the read-only paid-order reconciliation: the permissioned commerce query with its keyed cursors | Core line | `codex/core-extension-boundary` / `worktrees/jiffoo-core-extension-boundary` | `668fbcb7b` | `packages/plugin-sdk/{src,scripts}/**`, `apps/api/src/core/extensions/**`, `apps/api/tests/core/**`, `docs/agentra-004-plugin-pages-and-services.md` | `jiffoo_core_test` (integration) | to be assigned | **committed; the query, the cursor secret and the deployment wiring are delivered** | §5zad, §5zag |
| **B-GATE-S** — the local gate runs a wide selection in parallel shards | Core line (coordinator session) | `codex/core-extension-boundary` / `worktrees/jiffoo-core-extension-boundary` | `32784ebf6` | `scripts/{verify,verify-steps,verify-lane-shards}.mjs`, `scripts/{verify-selection,verify-lane-shards}.test.mjs`, `docs/coordination-ledger.md`, `docs/archive/coordination-ledger-handover.md` | `jiffoo_core_test` (integration) | coordinator session | **committed, gate green** | §5zag |
| **B-GATE-N** — the message catalogue is read through the labels of its own module, so a merchant label no longer selects the API suites | Core line (coordinator session) | `codex/core-extension-boundary` / `worktrees/jiffoo-core-extension-boundary` | `e44eaadef` | `packages/shared/src/i18n/messages/**`, `packages/shared/src/index.ts`, `apps/api/src/core/admin/{order-management,product-management,user-management}/**`, `scripts/module-reachability.test.mjs`, `docs/coordination-ledger.md`, `docs/archive/coordination-ledger-handover.md` | `jiffoo_core_test` (integration) | coordinator session | **committed, gate green** | §5zah |
| **B-GATE-R** — the shared package rule follows the reachability of the workspace import graph, so a suite that cannot reach the changed module is not run | Core line (coordinator session) | `codex/core-extension-boundary` / `worktrees/jiffoo-core-extension-boundary` | `668fbcb7b` | `scripts/{verify,verify-selection,module-reachability}.mjs`, `scripts/{verify-selection,module-reachability}.test.mjs`, `scripts/verify-selection.mjs`, `AGENTS.md`, `docs/coordination-ledger.md`, `docs/archive/coordination-ledger-handover.md` | `jiffoo_core_test` (integration) | coordinator session | **committed, gate green** | §5zac |
| **B-PKG-UPD** — the plugin detail page offers the in-place upgrade the install path already performs | Core line (coordinator session) | `codex/core-extension-boundary` / `worktrees/jiffoo-core-extension-boundary` | `7a95927aa` | `apps/admin/components/{extensions/PluginUpload,plugins/PluginWorkspace}.tsx`, `apps/admin/lib/plugin-upload.ts`, `packages/shared/src/i18n/messages/admin-plugins.ts`, `apps/admin/tests/plugin-upload.test.tsx`, `docs/coordination-ledger.md`, `docs/archive/coordination-ledger-handover.md` | `jiffoo_core_test` (integration) | coordinator session | **committed, gate green** | §5zai |
| **B-TXN-BIZ** — a plugin raises a business rejection from inside its transaction, and the rejection reaches the service layer with the transaction rolled back | Core line (coordinator session) | `codex/core-extension-boundary` / `worktrees/jiffoo-core-extension-boundary` | `7a95927aa` | `packages/shared/src/extensions/plugin-contract.ts`, `packages/plugin-sdk/{src,scripts,package.json,README.md}/**`, `apps/api/src/core/admin/extension-installer/plugin-database.ts`, `apps/api/src/core/extensions/runtime/{plugin-runtime,service-runtime}.ts`, `apps/api/tests/core/{plugin-database,plugin-service-rejection}.test.ts`, `docs/agentra-004-plugin-pages-and-services.md`, `docs/coordination-ledger.md`, `docs/archive/coordination-ledger-handover.md` | `jiffoo_core_test` (integration) | coordinator session | **committed, gate green** | §5zai |
| **B-CAT** — the two registered defects of the owner: one catalogue of the store currencies, and the storefront marker of a degraded tax quote | Core line (coordinator session) | `codex/core-extension-boundary` / `worktrees/jiffoo-core-extension-boundary` | `7a95927aa` | `packages/shared/src/{utils/constants,index}.ts`, `packages/shared/src/i18n/messages/{en,zh-Hans,zh-Hant}/storefront.ts`, `apps/api/src/core/shared/money.ts`, `apps/api/tests/core/store-currency-catalogue.test.ts`, `apps/admin/app/[locale]/(themed)/settings/page.tsx`, `apps/shop/{components/checkout-summary,components/checkout-view,lib/checkout-types}.tsx`, `apps/shop/tests/checkout-tax-marker.test.ts`, `docs/coordination-ledger.md`, `docs/archive/coordination-ledger-handover.md` | `jiffoo_core_test` (integration) | coordinator session | **committed, gate green** | §5zai |
| **B-PAGE-TOKEN** — the refresh of the token of a live plugin page: a refused refresh does not end the page, and the bridge refreshes the token when it is about to expire | Core line (coordinator session) | `codex/core-extension-boundary` / `worktrees/jiffoo-core-extension-boundary` | `3d371758f` | `packages/shared/src/plugin-pages/shell.tsx`, `packages/plugin-bridge/{src,README.md,package.json}/**`, `apps/shop/tests/{plugin-pages,plugin-page-refresh}.test.ts`, `docs/agentra-004-plugin-pages-and-services.md`, `docs/coordination-ledger.md`, `docs/archive/coordination-ledger-handover.md` | `jiffoo_core_test` (integration) | coordinator session | **committed, gate green** | §5zaj |
| **B-SHUTDOWN-DEADLINE** — the timer that arms the hard deadline of the shutdown decides that the deadline passed, so the forced path no longer depends on a measured elapsed | Core line (coordinator session) | `codex/core-extension-boundary` / `worktrees/jiffoo-core-extension-boundary` | `f1d461d50` | `apps/api/src/server.ts`, `apps/api/tests/core/api-shutdown-hard-deadline.test.ts`, `docs/coordination-ledger.md`, `docs/archive/coordination-ledger-handover.md` | `jiffoo_core_test` (integration) | coordinator session | **committed, gate green** | §5zak |
| **B-SDK-TYPES** — the published types of the SDK declare the deliberate refusal of a plugin, so a plugin raises it without declaring the marker itself | Core line (coordinator session) | `codex/core-extension-boundary` / `worktrees/jiffoo-core-extension-boundary` | `d29b18d1f` | `packages/plugin-sdk/{package.json,README.md,scripts/generate-types.mjs,src/index.ts}`, `scripts/plugin-sdk-standalone.mjs`, `docs/agentra-004-plugin-pages-and-services.md`, `docs/coordination-ledger.md`, `docs/archive/coordination-ledger-handover.md` | `jiffoo_core_test` (integration) | coordinator session | **committed, gate green** | §5zal |

## 4. Serial overlap set — never edited by both sides at once

This set was the agreement between the two lines while they ran in parallel, and every path in it
still exists. The parallel lines are merged (§5s); the set is kept as the record of which paths
were contended, and because the rule still holds in a weaker form: a change to the shared package,
the schema, the route registration or the gate itself is a change every consumer depends on.

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

## 5. The handover index

The evidence of every batch of the line is in `docs/archive/coordination-ledger-handover.md`,
with the section numbers it had here. The table is the index; the section it names is the record
of that day.

| Section | What it was | Commit |
| --- | --- | --- |
| 5b | Handover evidence — B-BOUND-B (order domain single owner) | `6a99ec298` |
| 5c | Handover evidence — B-BOUND-C (neutral layer + dependency direction) | `add8de45b` |
| 5d | Handover evidence — B-BOUND-D1 (audit outlet + dead user module + last core→admin edge) | `a65695b70` |
| 5e | Handover evidence — B-BOUND-D2 (the boundary guard) | `2c2a40e24` |
| 5f | Handover evidence — B-BOUND-D3 (last mechanical audit-outlet gap) | `b55714018` |
| 5g | The boundary audit result — what is still open | — |
| 5h | Handover evidence — B-BOUND-E1 (one public owner for `users` and `auth_tokens`) | `41d30671c` |
| 5i | Handover evidence — B-BOUND-E2 (the last three table owners) | `ede8a7f3b` |
| 5j | Handover evidence — B-BOUND-E3 (the guard becomes domain-aware) | — |
| 5k | Handover evidence — B-BOUND-F (the guard's blind spot and the stale references) | — |
| 5m | Handover evidence — B-BOUND-H (the Tier 2 cleanup: wrappers, dead inputs, one contract catalogue) | `7a95368e1` |
| 5n | Handover evidence — B-BOUND-I (the step 1 review follow-up: projections, dead shims, cycles) | `76b4aa807` |
| 5o | The open debt of the step 1 review — what this branch does NOT fix | — |
| 5p | The local gate decision — scope locally, full suite in CI | — |
| 5q | Handover evidence — B-BOUND-J (the step 1 review follow-up: neutral layer, cross-domain reads, inventory ledger, local sharded gate) | `f58c6b49b` |
| 5r | The merge attempt into the main line — what happened, what is preserved, what is next | — |
| 5s | Convergence — the state of the boundary work and of the two branches | — |
| 5t | Handover evidence — B-ARCH-1 (step 2 remediation: the orchestration and the extension seams) | `69e8056cb` |
| 5v | Handover evidence — WP-SA (the plugin gateway moves to the neutral layer) | — |
| 5x | Handover evidence — the settlement wave (the harness races and the last defects) | — |
| 5w | Handover evidence — WP-SC (the boundary guard closes its registers over the widened scan) | — |
| 5y | Handover evidence — WP-F1B (the core calls the fulfilment contract and records the fulfilment on the shipment) | — |
| 5z | Handover evidence — S3-DATA (the step 3 data-reliability remediation) | `cccbae535` |
| 5za | Handover evidence — S3-DATA-2 (the step 3 data-reliability remediation, part two) | `7174b2458` |
| 5zb | Handover evidence — S3-DATA-3 (the remaining items of the step 3 batch) | `38cce1eac` |
| 5zc | Handover evidence — S3-DATA-4 (the step 3 review remediation) | `6efe2ae67` |
| 5zd | Handover evidence — S3-DATA-5 (the registered items of the step 3 batch) | `99eac5dc` |
| 5ze | Handover evidence — the money model of the step 3 batch (the registered items) | `efe0087d7` |
| 5zf | Handover evidence — the CI repair of the money model batch (the admin shell E2E) | `89ae18741` |
| 5zg | Handover evidence — the step 4 batch (disconnect tolerance, timeouts, circuit breaking, dead letter fallback) | `398dc79a8` |
| 5zh | Handover evidence — the step 4 acceptance review remediation (the disaster-tolerance line) | `ac9fea59e` |
| 5zi | The conflict surface of this line against `main` (measured, not merged) | — |
| 5zj | Handover evidence — the merge of the lane `codex/lane-core-uiux` into the line | `cf87809a3` |
| 5zl | The frozen notification detail of the Admin (a real defect the browser E2E found) | `8fe872a0d` |
| 5zk | The intermittent failure of the browser E2E of the theme media upload | `12aee01d7` |
| 5zm | The OpenAPI annotation debt of the business JSON operations | `bbf7fdfb6` |
| 5zn | The per-user saved views and custom columns of the list pages | `bbf7fdfb6` |
| 5zo | The bulk print of the selected orders | `bbf7fdfb6` |
| 5zp | The bulk price edit of the selected products | `bbf7fdfb6` |
| 5zq | The gate evidence of this batch | `bbf7fdfb6` |
| 5zr | The diagnosis loop of the verification: a diagnostic run and a filtered browser E2E | `2b51c5740` |
| 5zs | The rule file, cut down to the working agreement | `e7cd2f66b` |
| 5zt | The rule file states rules, not facts | `e42b3dfee` |
| 5zu | The documents reconciled with the code | `ab241efcc` |
| 5zv | The ledger reconciled with the code | `ed6ec9c5a` |
| 5zw | The imager line's first P-3 integration batch, reviewed | `6d3dee635` |
| 5zx | The documentation set, consolidated | `6da9ab1a4` |
| 5zy | The update acceptance of the deployment update | `a7104938e` |
| 5zz | The charter and the plugin design, cut down | `e7b05fa6b` |
| 5zaa | The bridge distribution and the credits dependency, named precisely | `668fbcb7b` |
| 5zab | The plugin bridge becomes an installable artifact with a checked provenance | `668fbcb7b` |
| 5zac | The shared package rule follows the reachability of the import graph | `668fbcb7b` |
| 5zad | The G4 service contract: the shared surface and the call path | `668fbcb7b` |
| 5zae | The durable service call ledger, the reviewed call path and the completed paid-order read | `668fbcb7b` |
| 5zaf | The service dependency graph, the lifecycle decisions and the published availability | `72f42301c` |
| 5zag | The admin surface, the SDK's client generator, the deployment secret and the parallel local gate | `f497ffaad`, `38fd9451e` |
| 5zah | The message catalogue is read through the labels of its own module | `dc996bcee` |
| 5zab | The hard deadline of the shutdown is measured with a monotonic clock | `668fbcb7b` |
| 5zai | The in-place upgrade entry of a plugin package, the business rejection of a plugin service, the catalogue of the store currencies and the storefront marker of a degraded tax | `695cda0a6`, `faedad700`, `1fa3ad9b7` |
| 5zaj | The refresh of the token of a live plugin page: a refused refresh keeps the page, and the bridge refreshes the token when it is about to expire | `33c7487b4`, `be3469f16` |
| 5zak | The hard deadline of the shutdown is decided by the timer that arms it, not by a measured elapsed | `b361ab0eb` |
| 5zal | The published types of the SDK carry the deliberate refusal of a plugin | `1c219ea4c`, `8ead5fe70` |

## 6. The archive

| File | What it holds |
| --- | --- |
| `docs/archive/coordination-ledger-handover.md` | the handover evidence of every batch, with its section numbers |
| `docs/archive/agentra-002-v1-execution-plan.md` | the execution plan of the acceptance scenarios, before it became the status table of the charter |
| `docs/archive/visual-verification-diagnosis.md` | the dated diagnosis of the mobile header and the capture-noise log |
| `docs/archive/agentra-001-dated-records.md` | the dated records of the charter and the assessment of its twenty-three scenarios |
| `docs/archive/agentra-004-delivery-record.md` | the baseline, the delivered tables and codes, the batch plan, the delivered acceptance and the revision history of the plugin design |

Nothing in the archive is deleted. It is what the live documents were before they were cut down,
and it is read when a question needs the day a measurement was taken on. The text of the four
documents that were merged into `docs/verification.md` and `docs/operator-guide.md` is in those two
files.
