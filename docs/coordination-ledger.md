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

### Complete workspace source finalization (2026-11-05, locally verified)

The user authorized a local commit of all remaining source after `5f896274e`, including the
previously separate plugin, security, SDK and Admin integration work. The complete current tree
was copied with 1528 source inputs and independently installed dependencies. Main migration
history and checksums match all 48 local migrations; the isolated schema diff passes.

Shared, SDK, Bridge, Plugin UI, Admin webpack and Shop webpack builds passed. The audited shard
runner and real SDK/Bridge pack-install checks passed 69 tests. The final approved four-shard
gate passed API 232 files/2957 tests, Admin 68/740 and Shop 44/308, with full catalogue coverage
and cleanup PASS. An initial missing generated OpenAPI document caused 13 failures; after export
from the current source, the four affected files passed all 62 tests and the formal gate passed.
The failed run is retained, not counted as passing. Evidence is in `workspace-finalization/`
under the 2026-11-05 task artifact directory recorded below.

Generated Next build directories, local report output and private uploaded data are retained
locally and excluded through Git's local exclude file. The generated Next type reference was
normalized to the actual clean standard build output; no historical dirty line was guessed.
No primary acceptance reset, policy-bootstrap apply, external deployment, port 3001/3002
operation or push was performed. Browser performance evidence remains the bounded seven-list,
overview and related-flow evidence below; it does not certify every Admin page, button, role or
business state, nor does every fixture table contain 100000 rows.

### Admin declared-plugin sidebar batch (2026-11-04, locally verified)

Baseline: `a0fe077465d5439a6ea7e6444060680fbedf4fa3`. Preserve concurrent work.
Add `GET /api/v1/admin/plugin-pages`, using the existing administrator identity check and
declaration availability projection; return the existing declaration array, including an empty
array when no enabled administrator pages are available. Cover authentication and filtering with
API tests. The Admin sidebar consumes this projection and uses the first declared administrator
page as the plugin entry destination. Detail and declared-page routes select the plugin child,
not the Plugins collection link. No plugin identifiers or business rules are hardcoded.
Verification must use isolated Core test services, never the Imager database. Browser acceptance
on the existing Imager host is limited to navigation and presentation, with no business actions.
Scoped diagnostic verification selected `plugin-page-sessions.test.ts`, `admin-shell.test.tsx`,
`plugin-navigation.test.tsx` and `null-origin.test.ts`: API 24 and Admin 83 tests passed, with
selected type checks and migration parity passing. PostgreSQL 55440 and Redis 56390 were isolated
task-owned services and were removed after verification. This was not the certifying full gate.
Manual Chrome checks covered plugin detail and declared-page selection, default-page navigation,
refresh, back/forward, sidebar rail and light/dark presentation. Changes remain uncommitted.

### Core Admin presentation follow-up (2026-11-04, locally verified)

This result supersedes the unresolved presentation inference in the prior scale baseline below;
the original raw evidence remains intact. Background presentation and immediate DOM inspection
distorted the earlier Event Timing observation: a passive four-second observation window even
produced a 5112 ms candidate for a setup key. The 2440 ms record therefore cannot be used as a
causal Core latency measurement or as the denominator of a claimed code improvement.

Controlled production builds use the same webpack builder, API on 3111 and synthetic dataset.
Target-scoped continuous screencast frames keep background presentation observable without
bringing the window forward; event collection precedes DOM inspection. Five control keyboard
selection samples measured 56-160 ms (median 72 ms; no stable P95 claimed). Twenty final trusted
keyboard selections measured 16-40 ms (P50 32 ms, P95 40 ms). The first result DOM commit took
368.2 ms and its captured result frame took 423.335 ms; later result DOM commits took 41-109.8 ms.
These are local measured workflows, not field Core Web Vitals or all-interaction certification.

The final changes use a native page-size select, exclude the footer from scroll anchoring,
compose pagination and bulk actions inside one sticky footer, update client-only list URLs with
Next's supported native history integration, mount one product viewport layout, and defer heavy
product results while hiding stale actions and memoizing display projections. Unknown query
parameters, history, detail identity, selection, narrow layouts and true empty data were checked.
CI-only browser E2E consumers were adapted to the native control but were not run locally.

The final independent input set `86fae488d57a08879b331723d5c324e71d21b859dd84e87559fa42c8fa56b69c`
passed the approved four-shard quick verification: 232 API files / 2956 tests, 67 Admin files /
720 tests and 44 Shop files / 308 tests; coverage and cleanup PASS. Source post-check found no
changes; normal generated outputs are separately recorded. The exact summary and follow-up
report are `final-presentation-summary.txt` and `presentation-fix-20261104/retest-report.html`
under this task's external artifact directory. No commit, push or external deployment occurred.
Only hidden local API 3111 and final Admin 3106 remain; task comparison/empty services and gate
containers were removed, preserving acceptance data. Port 3002 had no listener at final check;
this task did not stop or restart it and did not connect to the Imager acceptance database.

### Core Admin measured remediation (2026-11-05, locally verified)

Commit authorization update: the user approved the complete Core Admin performance batch and
its performance prerequisites. Unrelated plugin, security and SDK changes are excluded.

The measured follow-up is complete against baseline `a0fe077465d5439a6ea7e6444060680fbedf4fa3`.
Seven task-owned code/test inputs cover the customer and order pages, their list tests and the
customer query test, plus product-management `list-query.ts` and the product list/bulk/export
contract suite. Other sessions' edits remain outside this delivery. The seven-file workspace,
gate and runtime hashes agree: `4094ce51033ee47e35b7bbc288c2820fefb1b7f65f371072a970f9fcf3c4f610`.

Customers and Orders mount one viewport layout at their original 1100/769 breakpoints, memoize
display projections and hide deferred old results. The inactive product query uses the existing
variant aggregation with `BOOL_OR`, preserving inactive membership including absent variants;
there is no schema or HTTP contract change. Workers implemented the changes and an independent
reviewer checked the source, meaningful regression assertions and measurement interpretation.

The final lightweight Browser Use cohort contains 68 samples. The ready customer 20-to-100
comparison is five observations per arm: median 240 ms before and 24 ms after, with ranges
224-264 and 24-32 ms. Customer select-100 medians are 120/56 ms (three per arm); Orders 72/48 ms.
Identical inactive page-3 stock and price requests measured 1268/275.8 and 1257.2/277.6 ms
(one observation per arm, not a cache-miss or P95 claim). The 138 earlier samples whose observer
read innerText remain exploratory; the initial loading control and the 152 ms exploratory
outlier are preserved. No field CWV, all-Admin, zero-long-task or long-memory certification is made.

The final approved four-shard gate exited 0: API 232 files/2957 tests, Admin 67/726 and Shop
44/308, with coverage, cleanup, type check, lint, reset and schema drift checks passing. Earlier
missing fixture/build inputs and the owned preview's Windows Prisma DLL lock were recorded and
resolved before certification. Main acceptance data was not reset: final read-only batch counts
and all 48 migration checksums match; the main schema diff is empty. No source changed after
certification. CI, automatic browser E2E and a serial full run were not executed; no commit, push
or external deployment occurred.

The self-contained report, CSV, raw observations, exact task patch and process/data evidence are
under `C:/Users/11948/.codex/visualizations/2026/11/05/01a1aa52-55ee-79d3-9bea-72e1aa2f4992/`,
with entrypoint `remediation-final-report.html`. The original protected 3106/3111 services remain;
the reviewed local preview uses 127.0.0.2:3109, API3115 and its own Redis56392. The owned gate
PostgreSQL container was removed. Ports 3001/3002 were not operated; 3002 was observed listening
at the final check, without a health claim.

### Core Admin scale acceptance batch (2026-11-04, prior local baseline)

Baseline: `a0fe077465d5439a6ea7e6444060680fbedf4fa3`; preserve the concurrent consumer-plugin batch.
Acceptance uses local ports 3101/3102 and `jiffoo_core_test`, synthetic batch
`coreadmin-20261104-v1`. Never connect to `imager_jiffoo_core` or operate ports 3001/3002.
The task-owned gate PostgreSQL uses port 55439 and the same exact test database name;
Redis uses port 56389, logical database 15. Gate resets must never target acceptance data.

Registered contract addition: `GET /admin/products/categories` accepts optional `search`
(maximum 200 characters), trimmed and matched case-insensitively against name or slug;
the list and total use the same predicate. Existing pagination remains authoritative.
Workers replace unbounded category collection with server-side search/pagination and remove
actionable stale user/staff placeholder rows. Product active/inactive predicates use EXISTS
without per-product aggregates unless stock filters or aggregate sorting require them.

Gate selection: `apps/api/tests/routes/admin-products.test.ts` and
`apps/api/tests/routes/product-list-bulk-export.test.ts`, plus affected Admin suites, widened
by the approved planner. These cover category search contracts, availability, sorting,
neighbors and filter-based bulk selection. No gate or browser completion is certified here.
Raw before/after performance evidence and browser coverage belong in the task's external
visualization directory; no commit, push, deployment or plugin modification is authorized.

Acceptance evidence: uncached active-product search used 20 independent case-sensitive cache
keys with the same case-insensitive SQL meaning. The original API took 995-1389 ms; the final
source runtime, without the task's gate load, took 260-413 ms (P50 292 ms, P95 351 ms).
Different dist/tsx runtimes and uncontrolled server caches limit the comparison. Query plans
separately establish the per-product aggregate cost and the grouped-aggregate improvement.
Browser verification confirmed stale actionable customer rows, unbounded category collection,
notification detail identity loss on refresh, an oversized sticky product heading, and a loading
pagination layout shift. The first four fixes and the query optimization passed independent
review and the complete local shard gate (232 API files / 2956 tests, 67 Admin files / 715 tests,
44 Shop files / 308 tests). Seven subsequent loading-height CSS changes passed Admin diagnostic
verification and a production build; a new certifying run covers that final input separately.
Order hard-load CLS changed from 0.4368 to approximately 0.00081 in the measured local browser.

At the prior decision point, overall performance acceptance was not certified: the session
contained a 2440 ms Event Timing candidate dominated by presentation delay. A scoped trace did not
reproduce it (92.199 ms maximum in that controlled trace); attribution remains unresolved.
The USER-role Admin denial, delayed old-response isolation and real NOT_FOUND bulk dry-run
were exercised. A mixed-result browser write, notification resend and long-duration memory
soak were not certified. No immutable event identity was changed to manufacture a failure.

The final CSS input `df1527dfe5abe96ab25951395550cb955902edbcc2c2d829559ee4545a4a6443`
subsequently passed `pnpm verify:quick --shards=4`: all 232 API files / 2956 tests,
67 Admin files / 715 tests and 44 Shop files / 308 tests passed, with coverage and cleanup PASS.
The exact summary is `final-css-certifying-summary.txt` in the external task artifact directory.
An independently installed, otherwise empty test instance verified the default empty product,
order, customer, category and notification pages; its required owner and installation audit
records were not represented as empty. That instance and all task gate containers were removed.
Only the hidden local final API on 3111 and production-build Admin on 3106 remain; the main
synthetic acceptance data is retained. Browser E2E, CI, commits, pushes and deployment were not run.

### Credits and consumer-plugin integration batch (2026-11-04, locally verified)

Baseline: `a0fe077465d5439a6ea7e6444060680fbedf4fa3`. The six consumer requirements are acceptance
requirements, not assertions about delivered SDK support. No acceptance environment upgrade,
provider recovery, credit mutation, generation or wallet cutover is authorized by this batch.

The planned public contract additions are a permissioned bounded published variant projection
(`commerce:products.read`), host-owned product navigation and existing purchase-origin return
binding, a minimal administrator customer directory (`customers:read`), and generic storage
publication, revocation, reference protection and durable deletion outcomes. Installation grants
and an ADMIN principal are not per-action administrator RBAC; that gap remains explicit until a
unified action-authorization mechanism is implemented and tested. Prices belong to Core;
variant-credit mappings, usage ledgers, restrictions and content semantics belong to plugins.

Workers own product/catalog, customer/identity and public SDK/Bridge wiring in disjoint files.
Storage schema work follows the approved baseline gate and is serial. Independent review and
the widened `pnpm verify:quick --shards=4` gate are required before certification; no check has
yet been certified. Final distribution requires built and packed SDK/Bridge artifacts and an
isolated consumer check, not just updated source types. Browser E2E remains CI-only.

Wallet-to-Credits migration is a coordinated maintenance/export/import plan only: reconcile
counts and hashes of balances, immutable ledger/effect keys, mappings, manual exceptions and
sweep checkpoints; settle old tasks and original service-call identities before switching;
never replay historic orders over imported balances, dual-write, or leave the old provider
enabled for new business. Rollback covers the coordinated consumer/provider deployment.
Plugin-owned root `001_generations` remains immutable; `002_operations` is append-only;
Credits owns its isolated `001_credits` checksum and schema. Use only installer/update paths.
Any unexpected database drift stops work without automatic repair.

The first widened gate covered all 227 API files (no missing, extra or duplicate files), but
failed five assertions: the changed context-key contract, three boundary assertions for new
edges/cycles, and an existing immutable-package lease test timeout. Type checks, Shop lint and
the dedicated test database reset passed; Admin and Shop test suites did not execute after the
API failure. This is not a certified batch. The dependency fix uses typed host adapters wired
at API/worker/test composition roots; the owning Product/Auth/Audit services retain their reads
and writes. Static enumeration of the revised graph retains 600 cycles rather than registering
the 315 cycles of the rejected direct-import design. This still requires executable validation.
An explicit Prisma diff against the task-owned PostgreSQL 18.2 baseline returned
`No difference detected` before the new storage/action-policy schemas were started.

Registered contract changes for this batch: `POST /plugin-pages/:slug/sessions/:id/product-target`,
token-only `GET/HEAD /plugin-public-files/:id`, and administrator policy grant GET/PUT/DELETE
under `/admin/plugin-action-policy`. Shared storage now declares publish/unpublish/publicUrl,
retain/release, idempotent delete and deletion-outcome reads; live-principal action checks use
`authorization.require` and bounded manifest `adminActions`. Installation `actions:<action>`
and explicit administrator grants are both required. Referenced-file and idempotency-key input
conflicts are distinct 409 outcomes, covered by storage tests. Publication is independent of a
publisher's later login availability; another explicitly authorized installation administrator
may revoke an admin-owned publication. Customer ownership never becomes public by a read.

The new migration is `20261104042933_plugin_host_capabilities`, generated with the runbook diff
against the validated task-owned baseline, not hand-written or applied to acceptance data.
SDK alpha.7 and Bridge alpha.4 are candidate local distribution versions until build, pack,
isolated consumer verification and the final gate finish. Object deletion certifies only the
active storage object; historical S3 versions, backups and secure media erasure remain outside
that result. The operator bootstrap tool requires an explicitly named connection environment
variable, expected database and administrator; dry-run is the default. It checks migration
history/checksums and schema before any explicit apply. No bootstrap was executed in this task.

The administrator host also exposes `customers.open({customerId})` and a session-bound
customer-target endpoint: it uses the same permissioned customer projection and audit, checks
the session again, and returns only the fixed Core customer path. This closes the iframe's
otherwise unusable account-link path without allowing arbitrary redirects.

Independent reviews covered product availability/pricing, customer identity and rate bounds,
action-policy session locking, publication/revocation/deletion, public-file proxies and signed
URL redaction, customer navigation, and the verification runner. Findings were returned to their
owning worker and fixed. The final static graph has 207 approved edges and the original 600
registered cycles. The runner generates its shared Prisma client before any shard starts and
resets each isolated shard with `--skip-generate`; its 67 database-free script tests passed.
The targeted diagnostic passed API, Admin and Shop selections after the advisory-lock call was
corrected to avoid PostgreSQL void deserialization. This is diagnostic evidence, not the final
certifying gate. Full lifecycle purge now refuses registered active file references; its existing
Core-wide administrator authority remains distinct from the SDK's fine-grained action grants.

Final verification: `pnpm verify:quick --shards=4` exited 0 against the frozen input snapshot
`7d8bc6d7cb9da6990c492c46fe96644f5ba713b379d81c69a8970b7ffbc42f94` (baseline above).
The complete API catalogue covered 232/232 files and passed 2,955 tests; Admin passed 66 files /
709 tests and Shop passed 44 files / 308 tests. Coverage and cleanup verdicts were both PASS.
The type check, Shop lint, test reset and schema drift check passed. Core build, OpenAPI export,
67 database-free runner tests and both isolated package-consumer checks also passed. Browser
E2E remains CI-only and was not run; no serial full-suite run or CI run is claimed.

The final SDK alpha.7 and Bridge alpha.4 tarballs match the bytes installed by the isolated
consumer checks. Their SHA256 values, the raw final summary, exported OpenAPI and independent
review record are in the task's local artifact directory:
`C:/Users/11948/.codex/visualizations/2026/11/04/01a1a4b2-90f5-7f92-a7ba-523aaf6f313b/artifacts/manifest.json`.
The source remains uncommitted and unpushed; no registry publication, acceptance update,
production migration, bootstrap, recovery, top-up, generation or wallet cutover was performed.
This final ledger-only result record was appended after verification; implementation and test
inputs were frozen and matched the recorded snapshot before writing it.

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
| the idle window of a page session | implemented: a live shell renews it on every shell-authorized call, so an idle page is not destroyed at minute 29, and the end of the window is its own code and not a revocation (§5zam) |
| the published types of the SDK | implemented: the deliberate refusal of a plugin, its marker and the guard that reads the marker are declared in the type snapshot, so a plugin raises the refusal without declaring the marker itself (§5zal) |
| the diagnostic gate mode and the filtered browser E2E | implemented (§5zr) |
| the local gate selects the suites a shared change reaches | implemented (§5zac) |
| the rule file | reduced to the development norms, with no code fact in it (§5zs, §5zt, §5zu) |
| the documentation set | seven live documents and an archive of the dated records (§5zx, §5zz) |
| the example plugins of the plugin line | implemented on the Core side: the provider and the consumer are installed through the real path, the provider keeps its effect in a table of its own plugin schema, and the consumer calls it from its task and from its final-failure hook (§5zau) |
| the acceptance of the plugin line (P-5) | covered: the navigation entry of a plugin page follows the locale of the store in all three locales, the cart carries no plugin frame while the plugin is enabled, the error state of the page shell is localized, the two API instances and the two worker instances share the database, Redis, the package blobs and the object storage, and the module containers of the charter scenarios 12 and 15 are enumerated (§5zav) |

### The open items

| Item | Section | State |
| --- | --- | --- |
| the registered dependency rings | §5o item 7 | open; 600 rings, unchanged |
| the currency catalogue of the settings page against the shared catalogue | §5ze, §5zai | closed on 2026-11-02; the shared package owns the list of the store currencies, the money module, the settings page and the presentation catalogue read it, and a test keeps the list and the catalogue equal |
| the storefront does not read the marker of a degraded tax quote | §5zg, §5zai | closed on 2026-11-02; the storefront reads the marker and says that the tax is being calculated instead of showing an empty total |
| a dead plugin file cleanup row holds the storage quota of its plugin | §5zg, §5zar | closed on 2026-11-03; an operator can retry the delete or release the row, and the release refuses while the object is still in the store |
| a successful service call does not record a success sample at the breaker | §5zai, §5zao | closed on 2026-11-03; the service path records the outcome of the provider at the breaker, so an answer is a success, a wrong answer is a failure and a refusal the provider made on purpose keeps the success of the call |
| a store that moves to a zero-decimal currency with fractional prices | §5ze | open; the merchant has to re-price |
| an audit row may be lost when the database refuses the write | §5zg, §5zh | open by decision; the money state is the truth that must not be undone |
| the conflict surface against `main` | §5zi | measured and unchanged; it is not resolved here |
| the bridge version a downstream plugin links | §5zw, §5zaj, §5zap | closed on the imager side on 2026-11-03; the tree builds the bridge `1.0.0-alpha.3`, which adds the theme variables of the host page to the frame document, and the imager package links that build with its SHA256 recorded beside the file |
| the SDK tarball a downstream plugin links | §5zag, §5zai, §5zal, §5zap, §5zat | closed on the imager side on 2026-11-03; the tree publishes the SDK `1.0.0-alpha.6`, whose published types carry the error catalogue of Core with the code of the dead cleanup row, and the imager package links that build with its SHA256 recorded beside the file; the label moved because the earlier `1.0.0-alpha.3` was consumable and its content changed, `1.0.0-alpha.4` already named a different tarball and `1.0.0-alpha.5` named one before the catalogue grew a code |
| the plugin UI package a downstream plugin links | §5zap, §5zas | closed on the imager side on 2026-11-03; the tree builds `@jiffoo/plugin-ui` `1.0.0-alpha.2`, whose token layer maps the theme variables of the shell onto the tokens of a plugin page and whose type scale follows the storefront, and the imager package links that build with its SHA256 recorded beside the file |
| the bridge does not ride the Core release as an asset | §5zab | open as of 2026-11-01; the artifact builds, packs and verifies outside the monorepo and the design names it as a release asset, but the release step that attaches it is not wired, because the repository has no release-asset mechanism; npm publishing is deferred by the design until the owner supplies an npm organisation |
| the plugin service contract (G4) and the paid-order reconciliation (G4-R) | §5zae, §5zaf, §5zag | delivered on the Core side on 2026-11-02; the call path, the grant check, the durable service call ledger, the paid-order read, the service dependency graph, the admin surface, the SDK's client generator and the deployment secret are reviewed and green; the provider plugin and the consumer's own work are outside Core |
| the adversarial acceptance cases of G4 and G4-R that the design names | §5zag, §5zah, §5zai, §5zaq | closed on 2026-11-03; the tampered and the expired cursor, the disabled context, the page budget, the browser-token access, the provider error passthrough, the undeclared method, the wildcard provider, the refund state, the catalogue snapshot of the line, the grant in a task handler, the grant in a failure hook and the timeout outcome of the call ledger have a test now |
| a shared message label still selects the API suites that boot the app | §5zag, §5zah | closed on 2026-11-02; the labels of the exported records have a module of their own, the API reads that module and the shared barrel no longer carries the catalogue, so a change of a merchant label selects 53 suites instead of 217 |
| the imagic page code in a real browser | §5zw | open as of 2026-11-01; the Core mechanism is proven by the browser E2E, the plugin's own page is not |
| the idle page of a real browser | §5zam | open on the imager side as of 2026-11-03; Core renews the idle window of a live session, and the browser validation of a page that idles longer than thirty-five minutes, in the background and in the foreground, belongs to the imager line |
| the complete acceptance of the plugin line (P-5b) | §5zau, §5zav, §5zaw | closed on 2026-11-03; the three locales of the navigation, the absence of a plugin frame on the cart, the localized error state of the shell, the page of the SDK's scaffold rendered in a real browser, the two API instances and the two worker instances over one deployment and the module containers of the scenarios 12 and 15 are covered; the two example plugins are not run in the compose deployment, because the mechanism is held there with the compose probe plugin |
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
| **B-PAGE-SESSION** — the idle window of a page session is renewed by a live shell, so an idle page is not destroyed at minute 29; the session is bounded by an absolute lifetime of twelve hours | Core line (coordinator session) | `codex/core-extension-boundary` / `worktrees/jiffoo-core-extension-boundary` | `f148dc902` | `apps/api/src/core/plugin-pages/{sessions,service}.ts`, `apps/api/src/utils/api-errors.ts`, `apps/api/tests/routes/plugin-page-sessions.test.ts`, `packages/shared/src/{error-codes.ts,plugin-pages/shell.tsx}`, `apps/shop/tests/plugin-page-refresh.test.ts`, `docs/agentra-004-plugin-pages-and-services.md`, `docs/coordination-ledger.md`, `docs/archive/coordination-ledger-handover.md` | `jiffoo_core_test` (integration) | coordinator session | **committed, gate green** | §5zam |
| **B-LEASE-FLAKE** — the assertion of the lease renewal is not a millisecond-boundary assertion | Core line (coordinator session) | `codex/core-extension-boundary` / `worktrees/jiffoo-core-extension-boundary` | `f148dc902` | `apps/api/tests/routes/plugin-migrations.test.ts`, `docs/coordination-ledger.md`, `docs/archive/coordination-ledger-handover.md` | `jiffoo_core_test` (integration) | coordinator session | **committed, gate green** | §5zan |

| **B-BREAKER-SVC** — the service path of a plugin service records the outcome of the provider at the breaker: a provider that answered records a success, a provider that did not answer correctly records a failure, and a refusal the provider made on purpose keeps its success | Core line (coordinator session) | `codex/core-extension-boundary` / `worktrees/jiffoo-core-extension-boundary` | `d42a7d7ce` | `apps/api/src/core/extensions/runtime/plugin-runtime.ts`, `apps/api/tests/core/plugin-service-breaker.test.ts`, `docs/agentra-004-plugin-pages-and-services.md` | `jiffoo_core_test` (integration) | coordinator session | **committed, gate green** | §5zao |

| **B-THEME-BRIDGE** — the theme of the store reaches the page of a plugin: the shell sends every theme variable of the surface, the bridge lays them down on the frame document, and a plugin styles itself with the shared plugin UI instead of a palette of its own | Core line (coordinator session) | `codex/core-extension-boundary` / `worktrees/jiffoo-core-extension-boundary` | `d42a7d7ce` | `packages/shared/src/plugin-pages/{theme-vars.ts,shell.tsx}`, `packages/plugin-bridge/{src/index.ts,package.json,README.md}`, `packages/plugin-ui/**`, `packages/plugin-sdk/{package.json,README.md,src/cli.ts,src/create.ts,src/page-template.ts}`, `scripts/{plugin-ui-standalone.mjs,plugin-ui-standalone.test.mjs,pack-plugin-packages.mjs,verify-selection.mjs,verify-steps.mjs,module-reachability.mjs,plugin-sdk-standalone.mjs}`, `apps/shop/tests/plugin-theme-bridge.test.ts`, `docs/agentra-004-plugin-pages-and-services.md`, `docs/coordination-ledger.md` | `jiffoo_core_test` (integration) | coordinator session | **committed, gate green** | §5zap |
| **B-SDK-LABEL** — the label of the SDK moves with its published types: the snapshot of the SDK carries the error catalogue of Core, so a new code in that catalogue changes the bytes of the tarball, and a label may name one package only | Core line (coordinator session) | `codex/core-extension-boundary` / `worktrees/jiffoo-core-extension-boundary` | `24b3a07f1` | `packages/plugin-sdk/{package.json,README.md}`, `scripts/plugin-sdk-standalone.mjs`, `docs/agentra-004-plugin-pages-and-services.md`, `docs/coordination-ledger.md` | `jiffoo_core_test` (integration) | coordinator session | **committed, gate green** | §5zat |

| **B-TYPE-SCALE** — the base font size of the storefront comes from the theme token instead of a literal, and the plugin UI keeps the type scale of the storefront, so the inherited text of a plugin page and the hierarchy of both surfaces agree | Core line (coordinator session) | `codex/core-extension-boundary` / `worktrees/jiffoo-core-extension-boundary` | `fde50e39a` | `packages/shared/src/extensions/theme-defaults.json`, `apps/api/builtin-themes/default-shop/theme.json`, `apps/shop/app/{default-tokens.css,globals.css}`, `apps/shop/tests/theme-render.test.ts`, `e2e/fixtures/themes/test-shop-theme/theme.json`, `packages/plugin-ui/{package.json,README.md,src/tokens.css,src/styles.css}`, `docs/agentra-003-theme-format.md`, `docs/coordination-ledger.md` | `jiffoo_core_test` (integration) | coordinator session | **committed, gate green** | §5zas |
| **B-G4-ACCEPT** — the adversarial acceptance of a plugin service: the grant is enforced in a task handler and in a final-failure hook, and a timed-out call settles the ledger unknown and reconciles without a second effect | Core line (this session) | `codex/core-extension-boundary` / `worktrees/jiffoo-core-extension-boundary` | `d42a7d7ce` | `apps/api/tests/core/plugin-service-grant-paths.test.ts` | `jiffoo_core_test` (integration) | coordinator session (one worker run) | **committed**, gate green | §5zaq |
| **B-DEAD-CLEANUP** — a dead plugin file cleanup row is resolved by the operator: a retry puts it back to the sweep, and a release frees the quota only once the object store confirms the object is gone | Core line (this session) | `codex/core-extension-boundary` / `worktrees/jiffoo-core-extension-boundary` | `c4fcd02cc` | `packages/shared/src/error-codes.ts`, `apps/api/src/utils/api-errors.ts`, `apps/api/src/core/plugin-storage/service.ts`, `apps/api/src/core/admin/extension-installer/routes.ts`, `apps/api/tests/core/plugin-file-cleanup-dead-letter.test.ts`, `apps/api/tests/routes/plugin-recovery-http.test.ts` | `jiffoo_core_test` (integration) | coordinator session (one worker run) | **committed**, gate green (183 suites, 4 shards) | §5zar |
| **B-P5-EXAMPLES** — the two example plugins of the design exist on the Core side and work against each other: the provider owns its ledger table through its own migration, the consumer calls it from a task and from a failure hook | Core line (this session) | `codex/core-extension-boundary` / `worktrees/jiffoo-core-extension-boundary` | `26979916d` | `apps/api/tests/fixtures/acceptance-plugins.ts`, `apps/api/tests/routes/plugin-acceptance-examples.test.ts` | `jiffoo_core_test` (integration) | coordinator session (one worker run) | **committed**, gate green | §5zau |
| **B-P5-ACCEPT** — the acceptance of the plugin line: the navigation entry of a plugin page follows the locale of the store in all three locales, the cart carries no plugin frame while the plugin is enabled, and the error state of the page shell says so in the language of the store | Core line (this session) | `codex/core-extension-boundary` / `worktrees/jiffoo-core-extension-boundary` | `db21adb1b` | `e2e/40-plugin-page-shells.spec.ts`, `apps/shop/tests/plugin-page-labels.test.ts`, `docs/agentra-004-plugin-pages-and-services.md`, `docs/archive/agentra-004-delivery-record.md` | `jiffoo_core_test` (integration) | coordinator session (two worker runs) | **committed**, gate green | §5zav |
| **B-P5-SCAFFOLD** — the page of the SDK's own scaffold renders in a real browser: the two ordinary plugins of the design are installed through the real path, and the page every plugin author starts from is rendered by the shell of Core in the three storefront locales | Core line (this session) | `codex/core-extension-boundary` / `worktrees/jiffoo-core-extension-boundary` | `5d07362a0` | `e2e/40-plugin-page-shells.spec.ts`, `apps/api/tests/fixtures/acceptance-plugins.ts` | `jiffoo_core_test` (integration) | coordinator session (two worker runs) | **committed**, gate green | §5zaw |

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
| 5zam | The idle window of a page session is renewed by a live shell | `6338e3536` |
| 5zan | The assertion of the lease renewal is not a millisecond-boundary assertion | `b72804d18` |
| 5zao | The service path of a plugin service records the outcome of the provider at the breaker | `df280dc59` |
| 5zap | The theme of the store reaches the page of a plugin: the full token payload, the plugin UI stylesheet and the page scaffold | `d9e7b628b` |
| 5zaq | The adversarial acceptance of a plugin service: the grant in a task handler and in a failure hook, and the timeout of the call ledger | — |
| 5zar | The dead cleanup row of the plugin storage is resolved by the operator | — |
| 5zas | The base font size of the storefront comes from the theme token, and the plugin UI keeps the type scale of the storefront | `24b3a07f1` |
| 5zat | The label of the SDK moves with its published types | — |
| 5zau | The example plugins of the plugin line, on the Core side | — |
| 5zav | The acceptance of the plugin line: the navigation in three locales, the cart without a frame and the localized error state | — |
| 5zaw | The page of the SDK's scaffold renders in a real browser | — |

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

## 2026-11-06 Local Admin inventory concurrency acceptance

- Decision: the product editor sends each persisted variant's original stock as `expectedStock`, activating the existing update API's `409 CONFLICT` and transactional rollback for stale inventory. Drafts remain available on conflict; creating or duplicating variants does not inherit an inventory baseline.
- Evidence: local Chrome double-window saves from stock 7 to 8 and 9 both succeeded before the fix. Evidence root: `C:/Users/11948/.codex/visualizations/2026/11/06/01a1b035-be66-7750-aab2-e7b640da1d1b/local-additional-acceptance`.
- Baseline: `06a1ffd99`. Selected coverage: full Admin suite and `apps/api/tests/routes/admin-products.test.ts`, covering payload baselines, conflict draft retention, and rejected stale stock with transaction rollback. Independent review and recorded browser retest passed; final commit gate results are recorded below.
- Verification uses frozen inputs and separate temporary PostgreSQL/Redis services. The large acceptance database on port 55444 is preserved. No commit, push, or production deployment is authorized by this record.

## 2026-11-07 Native Admin and Shop acceptance commit batch

- Baseline: 06a1ffd998b716334b1f9d5e7ec075855df7871f. Scope: 11 Admin files, five API acceptance suites, 12 Shop files, four verification scripts and this ledger; exact inputs are recorded in C:/Users/11948/.codex/visualizations/2026/11/06/01a1b035-be66-7750-aab2-e7b640da1d1b/commit-closeout/inputs.json. Other sessions' checkout, shared-package and plugin changes are preserved outside this batch.
- Decisions: preserve stock baselines in the product editor; use bounded category menus and safe store titles; render completed refunds as terminal results without payment polling; prepare the database and production build for eligible Shop HTTP suites while retaining the browser-only suite in CI. The existing product-update 409 activation is registered above. No Prisma schema or migration changes are included.
- Verification selection: audited scripts/verify-selection.test.mjs and scripts/verify-lane-shards.test.mjs, followed by pnpm verify:quick --shards=4. The latter certifies the full local eligible API catalogue, Admin and Shop; browser E2E remains CI-only. Temporary verification services are isolated from the retained 55444 acceptance clone.
- Review: independent Admin/API, Shop and verification-runner reviews are clean. Commit is conditional on both verification runs exiting zero against the frozen inputs; exact summaries and cleanup verdicts are saved in the evidence directory.
- Browser evidence: the recorded large-data native Admin/Shop checklists and final user-confirmed incognito login/logout checks are closed. Production and real payment channels are outside acceptance. No push or release is part of this commit batch.
