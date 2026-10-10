# AGENTRA-002: Core V1 Execution Plan

Derived from docs/agentra-001-core-v1-product-charter.md §5.
This document records WHICH acceptance scenarios pass, WHAT blocks the rest,
the development order, and product decisions made after the charter. Status
changes record their assessment date, supporting commits and acceptance
specifications. Detailed code state, source line numbers and transient test
output are obtained by fresh inspection and are not stored here. Update it
when a scenario's status or remaining blocker changes.

## Scenario 1 — disconnected installation completes a baseline order

Charter text: A disconnected installation completes a baseline order with no extension.
Status: COMPLETE (reassessed 2026-10-11)
Commits: c06db02c7, 7a489044e, 6f9db44e0, 1d4582d60
Evidence: builtin-plugins.test.ts and shop-checkout-contract.test.ts cover
startup installation, all five builtin contracts and confirmed order totals;
payment-convergence.test.ts covers payment transitions, replay and Admin
resolution of REQUIRES_REVIEW without losing later capture facts.
Prerequisites:
manual payment
free shipping
zero tax
manual fulfillment
console email
Blocked by: none for the baseline order acceptance scenario.

## Scenario 2 — marketplace index is unreachable

Charter text: When the marketplace index is unreachable, browsing is unavailable and
local package upload still works.
Status: COMPLETE (reassessed 2026-10-11)
Commits: 52d5f7f14, bc268d7e1, 1ab053b23, 2c9d0798e, 2b8c98ed8
Evidence: marketplace-catalog.test.ts covers unavailable and unconfigured
catalogs and preserved local upload; plugin-upload-preview.test.ts and
31-plugin-upload.spec.ts cover the normal local upload path.
Prerequisites:
Extension Center
Blocked by: none

## Scenario 3 — signed extension completes the Core order transition

Charter text: A signed extension is downloaded from the marketplace, verified,
configured in Admin, enabled without restarting Core, selected in checkout,
receives its provider callback, and completes the Core order transition.
Status: COMPLETE (reassessed 2026-10-11)
Commits: ac2307e80, c9185bf43, bc268d7e1, 1ab053b23, c79c7e2e6
Evidence: 35-extension-center.spec.ts B-F demonstrate signed marketplace
installation, configuration, enablement without restart, checkout, a verified
provider callback, persistent Paid state, replay idempotency, rejected
signatures and tampering, disabled callbacks and provider-session isolation.
Acceptance uses a test-signed fixture protocol; it does not demonstrate a
real payment provider's raw-HTTP-byte signature verification.
Known limitations (reassessed 2026-10-11): the acceptance extension remains
a test provider rather than a shipped real-provider integration. Original
HTTP bytes and stable 401 authentication failures are implemented in
ec73b7ff2 and 7a489044e, with payment-webhook-http.test.ts covering both;
6f9db44e0 and 1d4582d60 add Admin review resolution and its typed UI contract.
Prerequisites:
Extension Center
extension registry
package manifest
installation lifecycle
compatibility policy
trust policy
payment
Commerce Kernel
Blocked by: none for the demonstrated acceptance scenario; a real provider
still needs its own implementation and acceptance verification.

## Scenario 4 — unsigned extension upload and identical install and enable flow

Charter text: An unsigned extension is uploaded, an explicit warning is shown, a second
merchant confirmation is required and audited, and the identical install and
enable flow succeeds.
Status: COMPLETE (assessed 2026-10-04)
Commits: ac2307e80, bc268d7e1, 2c9d0798e
Evidence: 31-plugin-upload.spec.ts M demonstrates the warning, typed second
confirmation and audit; plugin-upload-preview.test.ts verifies confirmation
before execution and removal of bundle installation; extensions.test.ts
demonstrates disabled local installation followed by the normal Admin enable
transition. Local upload and marketplace use the shared installer.
Prerequisites:
Extension Center
installation lifecycle
trust policy
audit
Blocked by: none

## Scenario 5 — tax contract participates in checkout

Charter text: A tax contract participates in checkout and is reflected in the order total
before order placement.
Status: COMPLETE (reassessed 2026-10-11)
Evidence: builtin-plugins.test.ts verifies zero-tax through callContract;
plugin-lifecycle-reconciliation.test.ts verifies tax totals and line identity;
checkout/service.ts calculates tax before the confirmed order is persisted.
Prerequisites:
tax
checkout
order
Blocked by: none.

## Scenario 6 — event subscription receives order.created

Charter text: An event subscription receives order.created, with retry and idempotency
demonstrated by a plugin that subscribes to order.created, receives Core
retry delivery, and produces one effect only by deduplicating on the stable
event ID.
Status: COMPLETE (2026-09-30)
Commits: b12366b2, 92d86246, 6fd06769f, cf011b81c
Implementation decisions:
- Subscriptions are declared in the manifest (type, version) and registered through ctx.events.subscribe; a mismatch fails plugin load.
- The business transaction writes the event and one delivery row per enabled subscribed installation.
- Only the worker delivers: claim with FOR UPDATE SKIP LOCKED, 60-second lease, 30-second handler timeout, one in-flight delivery per installation per worker.
- Up to 8 attempts with delays of 1m, 5m, 15m, 1h, 3h, 6h and 12h; final failure is recorded on the installation.
- Finished deliveries and their events are deleted after 30 days.
- The outbox poller, BullMQ, external webhook delivery and the webhook tables were removed.
- API and worker are the only supported runtime processes; the worker reports a heartbeat and exposes a health endpoint.
Known limitations (reassessed 2026-10-11): a timed-out handler can continue
running and a synchronous infinite loop can block its worker. Invocation
markers remain until actual settlement; plugins still run in-process.
multi-instance-state.test.ts proves attributed unhandled asynchronous
failures preserve Core serving and another plugin's capability (2b8c98ed8).
Prerequisites:
Event Layer
order.created
retry
idempotency
Blocked by: none

## Scenario 7 — declarative default Shop theme and an Admin theme

Charter text: The declarative default Shop theme and an Admin theme are each validated,
activated, configured, rendered at runtime without rebuild, and reverted by
reactivating the previous theme. Validation rejects a package containing
executable code or browser JavaScript.
Status: COMPLETE (2026-09-28)
Product decisions: Admin dark mode is removed and can return only as a dark Admin
theme. The default Admin font is system-sans; Outfit remains available to
themes. Admin density is not a theme token. The installation page retains Core
visuals and does not read the active theme. Activating, restoring, configuring
or uninstalling an Admin theme applies changes immediately.
Prerequisites:
Themes
Blocked by: none

## Scenario 8 — disabled extension has no Admin navigation

Charter text: A disabled extension has no Admin navigation, Shop presentation, callable
capability, new event delivery, or new background processing.
Status: COMPLETE (2026-09-30)
Commits: 6fd06769f, 189dd94c5, 053c66843
Implementation decisions:
- Health and manifest routes of a disabled installation answer from Core data without loading plugin code.
- Pending event deliveries to a disabled installation are skipped and never replayed.
- A disabled payment provider's inbound callbacks return 503 PLUGIN_DISABLED; reconciliation skips it; manual mark-paid returns 409 PAYMENT_PROVIDER_DISABLED.
- Admin shows the number of orders awaiting payment before a payment plugin is disabled.
- Checkout reports a payment or shipping method disabled while the page was open and refreshes the options.
Prerequisites:
Extension Lifecycle
visibility policy
Blocked by: none

## Scenario 9 — update with no migration

Charter text: An update with no migration validates release and extension compatibility,
changes the application version, passes health checks, and the prior
application version remains restorable.
Status: NOT STARTED (reassessed 2026-10-11)
Prerequisites:
Core Updates
compatibility policy
operational health semantics
Blocked by: Docker Compose delivery; Core update flow

## Scenario 10 — update with a migration

Charter text: An update with a migration requires merchant confirmation and backup,
audits both Core and plugin ledgers before writing, blocks on mismatch,
reports migration and health results, and does not offer application
rollback after any migration is applied.
Status: PARTIAL (reassessed 2026-10-11)
Commits: 3650a285e, 1e836aa08, 0cd7d66c8, 9c2bc9aa1
Evidence: plugin-migrations.test.ts checks declared SQL, confirmation,
transactional migration prefixes and fenced publication; plugin-database.test.ts
checks scoped handler database access; plugin-database-audit.test.ts checks
installed-package manifest hashes, migration ledgers and read-only audit results.
Prerequisites:
Core Updates
Plugin Database and Migrations
Plugin migration history
Blocked by: the official host Core update command, stop/drain maintenance,
backup and documented restore, Core migration audit, pre-write integration
of the plugin auditor, and update health/recovery acceptance verification.
Known limitations (reassessed 2026-10-11): the plugin auditor is read-only
and explicitly does not prove process quiescence. Its caller must establish
maintenance and enforce blocking findings before any update migration write.

## Scenario 11 — exact release commit verification

Charter text: API, Admin, Shop, shared, and extension-contract verification pass for the
exact release commit.
Status: NOT STARTED (assessed 2026-09-22)
Prerequisites:
Core public API
five capability contracts
Extension SDK
Blocked by: completion of all release acceptance scenarios and verification
of the exact selected release commit. Shop, Extension SDK and the five
capability contracts are no longer missing implementation prerequisites.

## Scenario 12 — storage abstraction and request-scoped state static audit

Charter text: No code outside the storage abstraction resolves a plugin package or
uploaded file path, and no request-scoped state is held in process memory.
This is a static audit, not a runtime test.
Status: COMPLETE (reassessed 2026-10-11)
Commits: ea541f96c, 49274c49b, d4ff25415, 808a96cd7, c454dea94, 2b8c98ed8
Evidence: storage-boundary-guard.test.ts checks package and uploaded-file path
resolution through storage stores; immutable-plugin-packages.test.ts and
startup-plugin-prewarm.test.ts cover package publication and materialization.
module-state-audit.test.ts enumerates module containers and persistent class
fields with an explicit three-category allowlist. request-state-storage.test.ts
proves persisted log queries and fresh Vault resolution without retained
request payloads; marketplace-catalog.test.ts proves fresh catalog reads.
Known limitations: the static inventory covers apps/api/src; it does not
claim to audit plugin-owned code or third-party library internals.
Prerequisites:
State and Storage Boundaries
PluginPackageStore interface
Merchant-uploaded files
Session state
Blocked by: none for the Core storage and state static audit.

## Scenario 13 — Extension SDK scaffolds a new extension

Charter text: The Extension SDK scaffolds a new extension, runs it in local development
mode, packages and signs it, and the resulting package installs into Core
through the normal upload path.
Status: COMPLETE (assessed 2026-10-04)
Commits: 0d18f123f, 4c080c770, 0272ff9fe, c79c7e2e6
Evidence: 35-extension-center.spec.ts A demonstrates an SDK-created shipping
plugin running dev, building, signing, uploading, configuring, enabling and
participating in checkout. plugin-sdk-create.test.ts and
plugin-sdk-transfer.test.ts cover scaffold validation, CommonJS bundling,
upload confirmation and test-signed watch behavior.
Known limitations (reassessed 2026-10-11): PluginContext.database and the SDK
type snapshot provide the handler-scoped query/transaction path (1e836aa08).
plugin-database.test.ts covers admission and settlement boundaries. Plugins
remain trusted in-process code; schema scoping is not a malicious-code sandbox.
Prerequisites:
Extension SDK
Extension Center
Blocked by: none for the scaffold acceptance scenario.

## Scenario 14 — tracking integration and custom code snippet

Charter text: A merchant configures a tracking integration and a custom code snippet in
Admin. Both render on the storefront and on the order confirmation page
without rebuilding the Shop application, neither appears on the payment
form page, and both changes are recorded as auditable merchant actions.
Status: COMPLETE (2026-09-29; limitations reassessed 2026-10-04)
Evidence: bac127d1 through beee5dd0 delivered the tracking and custom-code
flows; ef6f3df29 adds 34-shop-reload.spec.ts A-C for plain theme style and
server-derived document language.
Known open issue (2026-10-04): intermittent React #418 hydration failure,
not yet resolved; reproducible through the opt-in E2E_RELOAD_STRESS=1 reload
path. Plain theme style rendering and server-derived document language do
not establish that it is fixed.
Product decisions: GA4/Meta/Baidu storefront tracking emits one purchase event
per order. Merchant free code uses head, body-start and body-end slots. Payment
pages exclude both mechanisms with strict script CSP. Admin provides configuration,
revisions, restore, a master switch and an audit log viewer.
Delivered in bac127d1 through beee5dd0.
Deferred (charter §6): executable signed storefront extensions, UI slots,
CSP and data access; consent management/cookie banner; storefront script sandboxing
with structured-event subscriptions.
Manifest boundary reassessed 2026-10-04 at c79c7e2e6:
plugin-manifest-contract.test.ts rejects unknown top-level and nested contract,
API-range and lifecycle fields; extensions.test.ts rejects an unknown manifest
field before package or installation writes. Browser-script and injection-point
declarations are not accepted extension manifest fields.
Prerequisites:
Storefront Tracking and Custom Code
audit
Blocked by: none

## Scenario 15 — module-level container static audit

Charter text: An enumeration of every module-level container in Core that holds
plugin-derived state is checked against the rebuild path of each extension
lifecycle action, with every container accounted for under every action.
This is a static audit, not a runtime test.
Status: COMPLETE (reassessed 2026-10-11)
Commits: 808a96cd7, c454dea94, 2b8c98ed8
Evidence: module-state-audit.test.ts accounts for every enumerated Core
container, names each plugin-state rebuild path, and rejects new unlisted
state. Registry-version reconciliation resets runtimes, event handlers,
failure throttles, module loading and package corruption state;
plugin-lifecycle-reconciliation.test.ts covers lifecycle version propagation.
Prerequisites:
State and Storage Boundaries
Extension Lifecycle
Blocked by: none for the Core container static audit.

## Scenario 16 — unhandled asynchronous error

Charter text: An enabled extension raises an unhandled asynchronous error. The Core
process continues serving, the failure is recorded with its originating
extension, and no other extension's capability is affected.
Status: COMPLETE (reassessed 2026-10-11)
Commits: 808a96cd7, 2b8c98ed8
Evidence: multi-instance-state.test.ts raises real unhandledRejection and
uncaughtException from enabled plugin code in API child processes, checks
origin attribution and persisted failure records, and verifies the same
process still serves HTTP and another plugin's shipping contract.
Known limitations: asynchronous containment does not isolate synchronous
infinite loops or malicious trusted plugin code.
Prerequisites:
Failure Containment
Blocked by: none for unhandled asynchronous-error containment.

## Scenario 17 — multi-instance correctness

Charter text: At least two API and two worker instances run under Docker Compose sharing
PostgreSQL, Redis, and S3-compatible object storage. Shared rate limiting,
task claims and fencing, extension lifecycle and runtime reload, and plugin,
theme, and uploaded-file availability remain correct across instances.
Status: PARTIAL (reassessed 2026-10-11)
Commits: c454dea94, 31655e75f, 17cf2fdf2, 0cd7d66c8, 82be2b29d,
c06db02c7, 7a489044e, 2b8c98ed8
Evidence: shared-protection-process.test.ts checks shared Redis limits and
breakers; multi-instance-state.test.ts proves plugin disable/re-enable and
active-theme changes across two real API processes. theme-package-process.test.ts
checks cold-process materialization; uploaded-storage-process.test.ts covers
shared S3 media. event-delivery.test.ts and notification-lease-fencing.test.ts
cover multiple worker claims and fencing; payment-convergence.test.ts covers
payment locks, request recovery and stale claims.
Known limitations: these are focused child-process proofs, not the required
combined two-API/two-worker Docker Compose acceptance run.
Prerequisites:
State and Storage Boundaries
shared rate limiting and circuit breaker state
distributed task claims and fencing
cross-instance extension lifecycle and runtime reload
plugin and theme package persistence and materialization
S3-compatible merchant-uploaded file storage
Docker Compose delivery
Blocked by: Docker Compose delivery with its self-hosted S3-compatible
service and the combined two-API/two-worker acceptance verification.

## Development order

1. Extension foundation: five capability contracts; lifecycle rebuild of plugin-derived state (15); process-level failure containment (16); validation of stored manifests and persisted trust tier; storage boundary (12).
2. Baseline order: builtin plugins and checkout contracts (1, 5); notification delivery; unpaid-order timeout.
3. Shop and declarative themes (7), then tracking and custom code (14).
4. Event layer (6) and disabled-extension isolation (8). COMPLETE (2026-09-30).
5. Extension Center: marketplace index (2), signature verification and Extension SDK (3, 4, 13). COMPLETE (2026-10-04), closed by c79c7e2e6 with 35-extension-center.spec.ts A-F and the marketplace, upload, signing and SDK specifications recorded above. Phase completion does not close the real payment provider launch blockers, Scenario 10 migration audit gap or Scenario 12 static audit.
6. Delivery: Docker Compose with a self-hosted S3-compatible service, shared upload storage, multi-instance correctness verified with at least two API and two worker instances (17), one official operator host update command and a documented backup-restore command, Core updates and plugin migrations (9, 10), and exact-release verification (11). Kubernetes deployment profiles, autoscaling, zero-downtime rolling Core updates, an Admin update UI, and an updater container with Docker socket access are not V1 Delivery work.

Pre-launch required (reassessed 2026-10-11):

1. DONE — authenticated per-user limiting, fail-closed shared Redis limiting and breakers, and retryable Shop availability handling: c454dea94, e0f15d501; state audit and cross-instance proofs: 2b8c98ed8.
2. DONE — typed business errors, sanitized unknown 500 responses and never-installed payment callback 404: 95a04b5e1, 76c1b85fc, ec73b7ff2.
3. DONE — PostgreSQL theme package bytes and cold-instance materialization: 31655e75f; hot cross-instance activation proof: 2b8c98ed8.
4. DONE — original HTTP webhook bytes: ec73b7ff2; payment v2 evidence and capture identity: 7a489044e.
5. DONE — rejected webhook authentication is stable 401 PAYMENT_WEBHOOK_AUTHENTICATION_FAILED: ec73b7ff2, 7a489044e.
6. DONE for plugin manifest/ledger verification and the read-only auditor: 3650a285e, 9c2bc9aa1. OPEN — enforce the audit before migration writes in the official Core update flow (Scenario 10).
7. DONE — handler-scoped PluginContext.database and canonical SDK query/transaction types: 1e836aa08. OPEN — Core update maintenance, backup/restore and migration audit integration (Scenario 10).
8. OPEN — official host update and backup/restore delivery (Scenarios 9 and 10), combined two-API/two-worker Compose verification (17), and exact release-commit verification (11).
9. OPEN — the recorded intermittent React #418 reload issue remains unclosed; B13/B14 do not establish its resolution.

## Recorded product decisions

- Delivery scope (2026-10-04): Core updates use one official operator command on the host. It performs release identity verification, installed-plugin compatibility checks, maintenance with all API and worker instances stopped or drained, backup before any migration, Core and plugin migrations, start, and health checks, in that order. A failed update with no migration automatically restores the prior application version; after any migration is applied, there is no application rollback, and recovery restores the pre-update backup using a documented command. Admin shows current version and health only, with no V1 update UI or updater container with Docker socket access. Daily operations, extensions, and themes remain fully in Admin without SSH or restart.
- Multi-instance correctness (2026-10-04): V1 runs correctly with multiple API and worker instances sharing PostgreSQL, Redis, and object storage, verified with at least two API and two worker instances under Docker Compose. Kubernetes deployment profiles, autoscaling, and zero-downtime rolling Core updates are deferred.
- Merchant-uploaded files (2026-10-04): the storage abstraction provides a local-disk backend for development and single-host use, and an S3-compatible backend for production. Default Compose ships a self-hosted S3-compatible service. Theme package bytes are persisted in PostgreSQL like plugin package bytes.
- Plugin migration format (2026-10-04): there is no production data. Packaged .sql migrations replace exported {id, sql} migrations as a clean break; the old form is rejected, with no legacy ledger reconciliation.
- Update migration audit (2026-10-04): "before every database write" means before any migration write in the update flow, not every business write.
- The API is served only under /api/v1.
- Customers must log in to add to cart and to check out; there are no guest accounts. Browsing does not require login.
- Email is a notification, never a gate: delivery failure never blocks registration, login or ordering, and unverified accounts can log in and order.
- Core decides when and what to notify; delivery goes through the notification contract; notifications are persisted and delivered asynchronously with retry. The default provider is the builtin console email; the first real email extension is generic SMTP.
- V1 has two account roles, customer and admin; every active admin has full Admin access. Fine-grained Admin permissions are a future value-add outside Core V1.
- Admin has a notification log with resend, can generate a password-reset link for a customer, and shows administrator invitation links. Storefront copy never claims an email was sent.
- Manual payment, free shipping, zero tax, manual fulfillment and console email are real builtin packages installed on first start and handled through the normal install, enable and gateway path. Core asks a payment method for its capabilities (manual confirmation, unpaid timeout), never its identity. Unpaid-order timeout is per payment method; payment instructions live in the plugin settings and appear on the thank-you page and in email.
- Installing a plugin never enables it; enabling goes through the single Admin enable transition. Builtins are enabled on first install only.
- Builtin trust is decided only by source (shipped with Core), never by the package manifest.
- Store locales: en, zh-Hans, zh-Hant.
- Each account has a preferred language (en, zh-Hans, zh-Hant) used for all its notifications.
- Admin cannot set a customer's password; it can only generate a reset link.
- ADMIN_URL is a second required production env var, used for administrator invitation links.
- The Admin system health page is a status summary; there is no metrics dashboard.
- Verification runs locally with pnpm verify:quick on directly relevant test files; GitHub Actions runs the full verification gate on every push to codex/core-extension-boundary.

## Open decisions

(none recorded yet)
