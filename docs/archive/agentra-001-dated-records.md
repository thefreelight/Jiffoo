# The charter, its dated records

The records that carried a date, a commit or an assessment, taken out of
`docs/agentra-001-core-v1-product-charter.md` so that the charter states the product and its
rules without the history of their resolution. The current state of the line is in
`docs/coordination-ledger.md`, section 0; the handover evidence of every batch is in
`docs/archive/coordination-ledger-handover.md`.

Every date, commit and assessment below belongs to the day it was made.

## The commerce kernel limitations (known limitations, 2026-10-04)

Known limitations (2026-10-04):

- RESOLVED (ec73b7ff2): webhook verification receives the original HTTP bytes.
  Real payment-provider integration acceptance remains provider-specific.
- RESOLVED (ec73b7ff2, 7a489044e): rejected webhook authentication returns the
  stable 401 PAYMENT_WEBHOOK_AUTHENTICATION_FAILED contract.
- RESOLVED (f4ee3d223): payment-provider disable and removal decisions share
  a transaction-scoped PostgreSQL advisory lock, and recheck the last enabled
  provider inside the write transaction. Concurrent administrators cannot
  disable or remove the final enabled payment provider.

## The plugin list has no metadata-only integrity fast path (known limitation, 2026-10-04)

Known limitation (2026-10-04): each Admin plugin-list request reads and hashes
the stored package blob for every returned non-builtin plugin to report
package state. The list has no metadata-only integrity fast path.

## The handler-scoped plugin database path (resolved in 1e836aa08)

RESOLVED (1e836aa08): the SDK and PluginContext provide the handler-scoped
plugin database query and transaction path.

## Content-addressed plugin version directories are retained during the process lifetime (known limitation, 2026-10-04)

Known limitation (2026-10-04): old content-addressed plugin version
directories are retained during the process lifetime, including after update
or purge. A process restart releases module memory; no automatic removal of
these directories on restart is currently established.

## The accepted V1 containment limitations (known limitations, 2026-10-04)

Known limitations (2026-10-04):

- Accepted V1 limitation: plugin code runs in-process and cannot be forcibly
  interrupted. A timed-out invocation can keep running, a synchronous
  infinite loop blocks its process, including the worker, and there is no
  process isolation.
- Accepted V1 limitation: install-time candidate prewarm and module loading
  have no overall execution deadline. The 15-minute operation lease fences
  publication; it is not an execution timeout and does not stop plugin code.

## Runtime migrations use declared, packaged .sql files (resolved in 3650a285e, 0cd7d66c8)

RESOLVED (3650a285e, 0cd7d66c8): runtime migrations use declared, packaged
.sql files and the package-derived default schema.

## The dedicated plugin migration ledger and the manifest auditor (resolved in 3650a285e, 9c2bc9aa1)

RESOLVED (3650a285e, 9c2bc9aa1): the dedicated plugin migration ledger and
manifest auditor verify package identity, migration order and SHA-256 and
record migration results.

## The handler-scoped plugin database path, in the SDK section (resolved in 1e836aa08)

RESOLVED (1e836aa08): the SDK and PluginContext provide the handler-scoped
plugin database query and transaction path.

## The cross-timezone order-detail cause (resolved 2026-10-12)

RESOLVED for the demonstrated cross-timezone order-detail cause (2026-10-12):
OrderDetail previously formatted with the host/browser's implicit timezone.
Actual hydrateRoot reproduction shows differing date text; explicit store
zones now pass the hydration regression and E2E_RELOAD_STRESS=1 home,
checkout and cross-timezone order-detail reload checks. The earlier intermittent
home failure did not reproduce in the pre-change baseline.

## The status of the twenty-three acceptance scenarios, assessed 2026-10-31

| Scenario | Status | Commits | Evidence | Blocked by |
| --- | --- | --- | --- | --- |
| 1 — disconnected installation completes a baseline order | COMPLETE (reassessed 2026-10-11) | c06db02c7, 7a489044e, 6f9db44e0 | builtin-plugins.test.ts and shop-checkout-contract.test.ts cover startup installation, all five builtin contracts and confirmed order totals; payment-convergence.test.ts covers payment transitions,… | none for the baseline order acceptanc… |
| 2 — marketplace index is unreachable | COMPLETE (reassessed 2026-10-11) | 52d5f7f14, bc268d7e1, 1ab053b23 | marketplace-catalog.test.ts covers unavailable and unconfigured catalogs and preserved local upload; plugin-upload-preview.test.ts and 31-plugin-upload.spec.ts cover the normal local upload path. P… | none |
| 3 — signed extension completes the Core order transition | COMPLETE (reassessed 2026-10-11) | ac2307e80, c9185bf43, bc268d7e1 | 35-extension-center.spec.ts B-F demonstrate signed marketplace installation, configuration, enablement without restart, checkout, a verified provider callback, persistent Paid state, replay idempot… | none for the demonstrated acceptance … |
| 4 — unsigned extension upload and identical install and enable flow | COMPLETE (assessed 2026-10-04) | ac2307e80, bc268d7e1, 2c9d0798e | 31-plugin-upload.spec.ts M demonstrates the warning, typed second confirmation and audit; plugin-upload-preview.test.ts verifies confirmation before execution and removal of bundle installation; ex… | none |
| 5 — tax contract participates in checkout | COMPLETE (reassessed 2026-10-11) | — | builtin-plugins.test.ts verifies zero-tax through callContract; plugin-lifecycle-reconciliation.test.ts verifies tax totals and line identity; checkout/service.ts calculates tax before the confirme… | none. |
| 6 — event subscription receives order.created | COMPLETE (2026-09-30) | b12366b2, 92d86246, 6fd06769f | — | none |
| 7 — declarative default Shop theme and an Admin theme | COMPLETE (2026-09-28) | — | — | none |
| 8 — disabled extension has no Admin navigation | COMPLETE (2026-09-30) | 6fd06769f, 189dd94c5, 053c66843 | — | none |
| 9 — update with no migration | COMPLETE (reassessed 2026-10-12) | a839b6c3a, 80a578d32, 8a38cd3ba | scripts/verify-update.mjs validates release identity, compatibility, backup, health and restoration of the prior application after a no-migration failure. scripts/verify-trial.mjs verifies actual v… | none for the demonstrated update flow. |
| 10 — update with a migration | COMPLETE (reassessed 2026-10-12) | 3650a285e, 1e836aa08, 0cd7d66c8 | plugin-migrations.test.ts checks declared SQL, confirmation, transactional migration prefixes and fenced publication; plugin-database.test.ts checks scoped handler database access; plugin-database-… | none for the implemented and demonstr… |
| 11 — exact release commit verification | DEFERRED by Simo (2026-10-12) | — | — | Simo's decision to complete local rea… |
| 12 — storage abstraction and request-scoped state static audit | COMPLETE (reassessed 2026-10-11) | ea541f96c, 49274c49b, d4ff25415 | storage-boundary-guard.test.ts checks package and uploaded-file path resolution through storage stores; immutable-plugin-packages.test.ts and startup-plugin-prewarm.test.ts cover package publicatio… | none for the Core storage and state s… |
| 13 — Extension SDK scaffolds a new extension | COMPLETE (assessed 2026-10-04) | 0d18f123f, 4c080c770, 0272ff9fe | 35-extension-center.spec.ts A demonstrates an SDK-created shipping plugin running dev, building, signing, uploading, configuring, enabling and participating in checkout. plugin-sdk-create.test.ts a… | none for the scaffold acceptance scen… |
| 14 — tracking integration and custom code snippet | COMPLETE (2026-09-29; limitations reassessed 2026-10-04) | — | bac127d1 through beee5dd0 delivered the tracking and custom-code flows; ef6f3df29 adds 34-shop-reload.spec.ts A-C for plain theme style and server-derived document language. RESOLVED for the demons… | none |
| 15 — module-level container static audit | COMPLETE (reassessed 2026-10-11) | 808a96cd7, c454dea94, 2b8c98ed8 | module-state-audit.test.ts accounts for every enumerated Core container, names each plugin-state rebuild path, and rejects new unlisted state. Registry-version reconciliation resets runtimes, event… | none for the Core container static au… |
| 16 — unhandled asynchronous error | COMPLETE (reassessed 2026-10-11) | 808a96cd7, 2b8c98ed8 | multi-instance-state.test.ts raises real unhandledRejection and uncaughtException from enabled plugin code in API child processes, checks origin attribution and persisted failure records, and verif… | none for unhandled asynchronous-error… |
| 17 — multi-instance correctness | COMPLETE (reassessed 2026-10-12) | c454dea94, 31655e75f, 17cf2fdf2 | shared-protection-process.test.ts checks shared Redis limits and breakers; multi-instance-state.test.ts proves plugin disable/re-enable and active-theme changes across two real API processes. theme… | none for the demonstrated multi-insta… |
| 18 — a verified plugin package provides storefront and Admin pages in Core shells | COMPLETE | 8b36c38ee | the plugin page sessions, the bridge and the Shop and Admin shells; the browser E2E of `39-plugin-page-assets` and `40-plugin-page-shells` | none |
| 19 — opaque-origin requests use plugin-scoped Bearer tokens | COMPLETE | 8b36c38ee | the plugin-page token, the null-origin policy and the frame headers | none |
| 20 — a customer uploads a file from a plugin frame | COMPLETE | 13695cbe1 | the private plugin storage, its quotas, the signed grants and the cleanup worker | none |
| 21 — a plugin's durable task runs longer than 30 seconds | COMPLETE | 0a3f5a964 | the durable task engine, its leases, fences, occupancy and fairness; the SDK drain helper | none |
| 22 — two plugins call a declared versioned service through Core | COMPLETE on the Core side (reassessed 2026-11-02); the scenario itself still needs a consumer | f5e1152fa, 1748175e5, 30f40e06e, e22ad537e, e6aa17886, 32784ebf6, f497ffaad | the call path, the method grants, the durable call ledger, the service graph and the admin surface: plugin-service.test.ts, plugin-service-ledger.test.ts, plugin-service-graph.test.ts, plugin-service-permissions.test.ts; the generated wallet-v1 client compiles in scripts/plugin-sdk-standalone.test.mjs | the debit, the enqueue and the compensation of the scenario need a plugin that exports the wallet service; the tree holds none |
| 23 — a wallet provider is disabled while another provider completes a paid order | COMPLETE on the Core side (reassessed 2026-11-02); the scenario itself still needs a consumer | 30f40e06e, f497ffaad, e44eaadef | the permissioned paid-order read with its bounded windows and its keyed cursors: plugin-commerce-query.test.ts; the deployment secret PLUGIN_COMMERCE_CURSOR_SECRET | the wallet provider, the reconciliation credit and the deduplication by order id need a plugin that consumes the contract |
