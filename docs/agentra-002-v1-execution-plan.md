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
Status: COMPLETE (assessed 2026-09-23)
Prerequisites:
manual payment
free shipping
zero tax
manual fulfillment
console email
Blocked by: builtin plugin installation; builtin manual payment, free shipping, zero tax, manual fulfillment and console email; shipping and tax contracts called in checkout; unpaid-order timeout; notification contract

## Scenario 2 — marketplace index is unreachable

Charter text: When the marketplace index is unreachable, browsing is unavailable and
local package upload still works.
Status: COMPLETE (assessed 2026-10-04)
Commits: 52d5f7f14, bc268d7e1, 1ab053b23, 2c9d0798e
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
Status: COMPLETE (assessed 2026-10-04)
Commits: ac2307e80, c9185bf43, bc268d7e1, 1ab053b23, c79c7e2e6
Evidence: 35-extension-center.spec.ts B-F demonstrate signed marketplace
installation, configuration, enablement without restart, checkout, a verified
provider callback, persistent Paid state, replay idempotency, rejected
signatures and tampering, disabled callbacks and provider-session isolation.
Acceptance uses a test-signed fixture protocol; it does not demonstrate a
real payment provider's raw-HTTP-byte signature verification.
Known limitations: real payment provider launch is blocked by reconstructed
webhook rawBody and verification failures returning 500 rather than a stable
authentication error.
Prerequisites:
Extension Center
extension registry
package manifest
installation lifecycle
compatibility policy
trust policy
payment
Commerce Kernel
Blocked by: none for the demonstrated acceptance scenario; the real payment
provider launch blockers remain open.

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
Status: COMPLETE (assessed 2026-09-23)
Prerequisites:
tax
checkout
order
Blocked by: tax contract; checkout call site

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
Known limitations: a timed-out handler keeps running; a synchronous infinite loop blocks the worker; there is no process isolation.
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
Status: NOT STARTED (assessed 2026-09-22)
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
Status: NOT STARTED (assessed 2026-09-22)
Prerequisites:
Core Updates
Plugin Database and Migrations
Plugin migration history
Blocked by: Core update flow; package-manifest verification of plugin
migration identity, order and SHA-256; plugin migration audit; the SDK plugin
database access path, delivered together with the Scenario 10 migration work.
Known limitations (assessed 2026-10-04 at c79c7e2e6): the runtime migration
ledger compares exported SQL checksums only with prior ledger entries.
contract-v1-runtime.test.ts does not establish the charter's installed-package
manifest audit. The migration audit and SDK database access path are
pre-launch requirements for Scenario 10.

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
Status: PARTIAL (assessed 2026-10-04)
Commits: ea541f96c, 49274c49b, d4ff25415, 808a96cd7
Evidence: storage-boundary-guard.test.ts checks package and uploaded-file path
resolution through storage stores; immutable-plugin-packages.test.ts and
startup-plugin-prewarm.test.ts cover package publication and materialization.
The pattern guard is supporting evidence, not a complete static audit.
Prerequisites:
State and Storage Boundaries
PluginPackageStore interface
Merchant-uploaded files
Session state
Blocked by: request-derived in-process rate-limit state and completion of the
static audit. Auth rate limiting retains an in-memory fallback, and the
shared rate limiter still provides an in-memory store.

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
Known limitations: the SDK and PluginContext do not yet provide the plugin
database access path. This is a pre-launch requirement delivered together
with the Scenario 10 plugin migration work.
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
Status: PARTIAL (assessed 2026-09-23)
Prerequisites:
State and Storage Boundaries
Extension Lifecycle
Blocked by: lifecycle rebuild of every plugin-derived container

## Scenario 16 — unhandled asynchronous error

Charter text: An enabled extension raises an unhandled asynchronous error. The Core
process continues serving, the failure is recorded with its originating
extension, and no other extension's capability is affected.
Status: PARTIAL (assessed 2026-09-23)
Prerequisites:
Failure Containment
Blocked by: process-level exception handlers with extension attribution

## Scenario 17 — multi-instance correctness

Charter text: At least two API and two worker instances run under Docker Compose sharing
PostgreSQL, Redis, and S3-compatible object storage. Shared rate limiting,
task claims and fencing, extension lifecycle and runtime reload, and plugin,
theme, and uploaded-file availability remain correct across instances.
Status: NOT STARTED (assessed 2026-10-04)
Prerequisites:
State and Storage Boundaries
shared rate limiting and circuit breaker state
distributed task claims and fencing
cross-instance extension lifecycle and runtime reload
plugin and theme package persistence and materialization
S3-compatible merchant-uploaded file storage
Docker Compose delivery
Blocked by: shared limiter and breaker state; task claims and fencing including
payment reconciliation; coordinated registry and runtime reload across instances;
theme package persistence and materialization on every instance; S3-compatible
upload backend and self-hosted Compose service; two-API and two-worker Compose
verification.

## Development order

1. Extension foundation: five capability contracts; lifecycle rebuild of plugin-derived state (15); process-level failure containment (16); validation of stored manifests and persisted trust tier; storage boundary (12).
2. Baseline order: builtin plugins and checkout contracts (1, 5); notification delivery; unpaid-order timeout.
3. Shop and declarative themes (7), then tracking and custom code (14).
4. Event layer (6) and disabled-extension isolation (8). COMPLETE (2026-09-30).
5. Extension Center: marketplace index (2), signature verification and Extension SDK (3, 4, 13). COMPLETE (2026-10-04), closed by c79c7e2e6 with 35-extension-center.spec.ts A-F and the marketplace, upload, signing and SDK specifications recorded above. Phase completion does not close the real payment provider launch blockers, Scenario 10 migration audit gap or Scenario 12 static audit.
6. Delivery: Docker Compose with a self-hosted S3-compatible service, shared upload storage, multi-instance correctness verified with at least two API and two worker instances (17), one official operator host update command and a documented backup-restore command, Core updates and plugin migrations (9, 10), and exact-release verification (11). Kubernetes deployment profiles, autoscaling, zero-downtime rolling Core updates, an Admin update UI, and an updater container with Docker socket access are not V1 Delivery work.

Pre-launch required (assessed 2026-10-04):

1. Rate limiting runs before the authenticated user is identified, so the global per-user key does not apply and users sharing an egress IP can be limited together; a rate-limited Shop catalog render becomes a 500. The global in-memory fallback store has no capacity bound, and the plugin gateway limiter is a per-process Map rather than shared state; these rate-limiting boundaries require correction before launch.
2. Unknown errors that currently fall through to 400 or 404 must become explicit business codes or 500. A payment callback for a never-installed provider currently returns 500 and must return 404.
3. Theme package bytes are stored only on one server's local disk and are unavailable to another instance without shared storage. They must follow the plugin package persistence and materialization approach before launch.
4. Payment webhook rawBody is reconstructed from the parsed body rather than preserved as the original HTTP bytes. Original-byte delivery is required before launching real payment providers.
5. Webhook verification failures return 500 instead of a stable, non-retryable authentication failure. Provider-independent authentication semantics are required before launching real payment providers.
6. Plugin migrations are not verified against the installed package manifest for identity, order and SHA-256, or audited as required. This is a pre-launch requirement delivered with Scenario 10.
7. The SDK and PluginContext provide no plugin database access path. This is a pre-launch requirement delivered together with the Scenario 10 plugin migration work.

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
- Verification runs locally with pnpm verify; GitHub CI runs only when triggered manually.

## Open decisions

(none recorded yet)
