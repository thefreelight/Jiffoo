# AGENTRA-002: Core V1 Execution Plan

Derived from docs/agentra-001-core-v1-product-charter.md §5.
This document records WHICH acceptance scenarios pass, WHAT blocks the rest, the development order, and product decisions made after the charter. It does not record code state, file paths, line numbers, or test
results — those are obtained by fresh inspection when needed and are never
stored here. Update it only when a scenario's status actually changes.

## Scenario 1 — disconnected installation completes a baseline order

Charter text: A disconnected installation completes a baseline order with no extension.
Status: PARTIAL (assessed 2026-09-22)
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
Status: PARTIAL (assessed 2026-09-22)
Prerequisites:
Extension Center
Blocked by: marketplace index browsing and download

## Scenario 3 — signed extension completes the Core order transition

Charter text: A signed extension is downloaded from the marketplace, verified,
configured in Admin, enabled without restarting Core, selected in checkout,
receives its provider callback, and completes the Core order transition.
Status: PARTIAL (assessed 2026-09-22)
Prerequisites:
Extension Center
extension registry
package manifest
installation lifecycle
compatibility policy
trust policy
payment
Commerce Kernel
Blocked by: marketplace download; signature verification; persisted trust tier; validation of stored manifests; one shared payment state transition

## Scenario 4 — unsigned extension upload and identical install and enable flow

Charter text: An unsigned extension is uploaded, an explicit warning is shown, a second
merchant confirmation is required and audited, and the identical install and
enable flow succeeds.
Status: PARTIAL (assessed 2026-09-22)
Prerequisites:
Extension Center
installation lifecycle
trust policy
audit
Blocked by: persisted trust tier; marketplace download sharing the identical install path

## Scenario 5 — tax contract participates in checkout

Charter text: A tax contract participates in checkout and is reflected in the order total
before order placement.
Status: NOT STARTED (assessed 2026-09-22)
Prerequisites:
tax
checkout
order
Blocked by: tax contract; checkout call site

## Scenario 6 — event subscription receives order.created

Charter text: An event subscription receives order.created, with retry and idempotency
demonstrated by a plugin that subscribes to order.created, receives Core
retry delivery, and produces one effect only.
Status: PARTIAL (assessed 2026-09-22)
Prerequisites:
Event Layer
order.created
retry
idempotency
Blocked by: durable event delivery with retry; idempotency

## Scenario 7 — declarative default Shop theme and an Admin theme

Charter text: The declarative default Shop theme and an Admin theme are each validated,
activated, configured, rendered at runtime without rebuild, and reverted by
reactivating the previous theme. Validation rejects a package containing
executable code or browser JavaScript.
Status: NOT STARTED (assessed 2026-09-22)
Prerequisites:
Themes
Blocked by: Shop application; declarative theme system; Admin theme

## Scenario 8 — disabled extension has no Admin navigation

Charter text: A disabled extension has no Admin navigation, Shop presentation, callable
capability, new webhook delivery, or new background processing.
Status: PARTIAL (assessed 2026-09-22)
Prerequisites:
Extension Lifecycle
visibility policy
Blocked by: lifecycle rebuild on disable; webhook and background-job isolation; Shop presentation

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
Blocked by: Core update flow; plugin migration ledger; migration audit

## Scenario 11 — exact release commit verification

Charter text: API, Admin, Shop, shared, and extension-contract verification pass for the
exact release commit.
Status: NOT STARTED (assessed 2026-09-22)
Prerequisites:
Core public API
five capability contracts
Extension SDK
Blocked by: Shop; Extension SDK; capability contracts

## Scenario 12 — storage abstraction and request-scoped state static audit

Charter text: No code outside the storage abstraction resolves a plugin package or
uploaded file path, and no request-scoped state is held in process memory.
This is a static audit, not a runtime test.
Status: PARTIAL (assessed 2026-09-22)
Prerequisites:
State and Storage Boundaries
PluginPackageStore interface
Merchant-uploaded files
Session state
Blocked by: plugin package paths resolved outside PluginPackageStore; in-process rate-limit state

## Scenario 13 — Extension SDK scaffolds a new extension

Charter text: The Extension SDK scaffolds a new extension, runs it in local development
mode, packages and signs it, and the resulting package installs into Core
through the normal upload path.
Status: NOT STARTED (assessed 2026-09-22)
Prerequisites:
Extension SDK
Extension Center
Blocked by: Extension SDK; package signing

## Scenario 14 — tracking integration and custom code snippet

Charter text: A merchant configures a tracking integration and a custom code snippet in
Admin. Both render on the storefront and on the order confirmation page
without rebuilding the Shop application, neither appears on the payment
form page, and both changes are recorded as auditable merchant actions.
Status: NOT STARTED (assessed 2026-09-22)
Prerequisites:
Storefront Tracking and Custom Code
audit
Blocked by: tracking and custom code; Shop

## Scenario 15 — module-level container static audit

Charter text: An enumeration of every module-level container in Core that holds
plugin-derived state is checked against the rebuild path of each extension
lifecycle action, with every container accounted for under every action.
This is a static audit, not a runtime test.
Status: PARTIAL (assessed 2026-09-22)
Prerequisites:
State and Storage Boundaries
Extension Lifecycle
Blocked by: lifecycle rebuild of every plugin-derived container

## Scenario 16 — unhandled asynchronous error

Charter text: An enabled extension raises an unhandled asynchronous error. The Core
process continues serving, the failure is recorded with its originating
extension, and no other extension's capability is affected.
Status: PARTIAL (assessed 2026-09-22)
Prerequisites:
Failure Containment
Blocked by: process-level exception handlers with extension attribution

## Development order

1. Extension foundation: five capability contracts; lifecycle rebuild of plugin-derived state (15); process-level failure containment (16); validation of stored manifests and persisted trust tier; storage boundary (12).
2. Baseline order: builtin plugins and checkout contracts (1, 5); notification delivery; unpaid-order timeout.
3. Shop and declarative themes (7), then tracking and custom code (14).
4. Event layer (6) and disabled-extension isolation (8).
5. Extension Center: marketplace index (2), signature verification and Extension SDK (3, 4, 13).
6. Delivery: Docker Compose, Core updates and plugin migrations (9, 10), release verification (11).

## Recorded product decisions

- The API is served only under /api/v1.
- Customers must log in to add to cart and to check out; there are no guest accounts. Browsing does not require login.
- Email is a notification, never a gate: delivery failure never blocks registration, login or ordering, and unverified accounts can log in and order.
- Core decides when and what to notify; delivery goes through the notification contract; notifications are persisted and delivered asynchronously with retry. The default provider is the builtin console email; the first real email extension is generic SMTP.
- Admin has a notification log with resend, can generate a password-reset link for a customer, and shows staff invitation links. Storefront copy never claims an email was sent.
- Manual payment, free shipping, zero tax, manual fulfillment and console email are real builtin packages installed on first start and handled through the normal install, enable and gateway path. Core asks a payment method for its capabilities (manual confirmation, unpaid timeout), never its identity. Unpaid-order timeout is per payment method; payment instructions live in the plugin settings and appear on the thank-you page and in email.
- Builtin trust is decided only by source (shipped with Core), never by the package manifest.
- Store locales: en, zh-Hans, zh-Hant.
- The Admin system health page is a status summary; there is no metrics dashboard.
- Verification runs locally with pnpm verify; GitHub CI runs only when triggered manually.

## Open decisions

(none recorded yet)
