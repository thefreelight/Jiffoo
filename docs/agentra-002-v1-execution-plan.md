# AGENTRA-002: Core V1 Execution Plan

Derived from docs/agentra-001-core-v1-product-charter.md §5.
This document records WHICH acceptance scenarios pass and WHAT blocks the
rest. It does not record code state, file paths, line numbers, or test
results — those are obtained by fresh inspection when needed and are never
stored here. Update it only when a scenario's status actually changes.

## Scenario 1 — disconnected installation completes a baseline order

Charter text: A disconnected installation completes a baseline order with no extension.
Status: UNKNOWN — not yet assessed
Prerequisites:
manual payment
free shipping
zero tax
manual fulfillment
console email
Blocked by: —

## Scenario 2 — marketplace index is unreachable

Charter text: When the marketplace index is unreachable, browsing is unavailable and
local package upload still works.
Status: UNKNOWN — not yet assessed
Prerequisites:
Extension Center
Blocked by: —

## Scenario 3 — signed extension completes the Core order transition

Charter text: A signed extension is downloaded from the marketplace, verified,
configured in Admin, enabled without restarting Core, selected in checkout,
receives its provider callback, and completes the Core order transition.
Status: UNKNOWN — not yet assessed
Prerequisites:
Extension Center
extension registry
package manifest
installation lifecycle
compatibility policy
trust policy
payment
Commerce Kernel
Blocked by: —

## Scenario 4 — unsigned extension upload and identical install and enable flow

Charter text: An unsigned extension is uploaded, an explicit warning is shown, a second
merchant confirmation is required and audited, and the identical install and
enable flow succeeds.
Status: UNKNOWN — not yet assessed
Prerequisites:
Extension Center
installation lifecycle
trust policy
audit
Blocked by: —

## Scenario 5 — tax contract participates in checkout

Charter text: A tax contract participates in checkout and is reflected in the order total
before order placement.
Status: UNKNOWN — not yet assessed
Prerequisites:
tax
checkout
order
Blocked by: —

## Scenario 6 — event subscription receives order.created

Charter text: An event subscription receives order.created, with retry and idempotency
demonstrated by a plugin that subscribes to order.created, receives Core
retry delivery, and produces one effect only.
Status: UNKNOWN — not yet assessed
Prerequisites:
Event Layer
order.created
retry
idempotency
Blocked by: —

## Scenario 7 — declarative default Shop theme and an Admin theme

Charter text: The declarative default Shop theme and an Admin theme are each validated,
activated, configured, rendered at runtime without rebuild, and reverted by
reactivating the previous theme. Validation rejects a package containing
executable code or browser JavaScript.
Status: UNKNOWN — not yet assessed
Prerequisites:
Themes
Blocked by: —

## Scenario 8 — disabled extension has no Admin navigation

Charter text: A disabled extension has no Admin navigation, Shop presentation, callable
capability, new webhook delivery, or new background processing.
Status: UNKNOWN — not yet assessed
Prerequisites:
Extension Lifecycle
visibility policy
Blocked by: —

## Scenario 9 — update with no migration

Charter text: An update with no migration validates release and extension compatibility,
changes the application version, passes health checks, and the prior
application version remains restorable.
Status: UNKNOWN — not yet assessed
Prerequisites:
Core Updates
compatibility policy
operational health semantics
Blocked by: —

## Scenario 10 — update with a migration

Charter text: An update with a migration requires merchant confirmation and backup,
audits both Core and plugin ledgers before writing, blocks on mismatch,
reports migration and health results, and does not offer application
rollback after any migration is applied.
Status: UNKNOWN — not yet assessed
Prerequisites:
Core Updates
Plugin Database and Migrations
Plugin migration history
Blocked by: —

## Scenario 11 — exact release commit verification

Charter text: API, Admin, Shop, shared, and extension-contract verification pass for the
exact release commit.
Status: UNKNOWN — not yet assessed
Prerequisites:
Core public API
five capability contracts
Extension SDK
Blocked by: —

## Scenario 12 — storage abstraction and request-scoped state static audit

Charter text: No code outside the storage abstraction resolves a plugin package or
uploaded file path, and no request-scoped state is held in process memory.
This is a static audit, not a runtime test.
Status: UNKNOWN — not yet assessed
Prerequisites:
State and Storage Boundaries
PluginPackageStore interface
Merchant-uploaded files
Session state
Blocked by: —

## Scenario 13 — Extension SDK scaffolds a new extension

Charter text: The Extension SDK scaffolds a new extension, runs it in local development
mode, packages and signs it, and the resulting package installs into Core
through the normal upload path.
Status: UNKNOWN — not yet assessed
Prerequisites:
Extension SDK
Extension Center
Blocked by: —

## Scenario 14 — tracking integration and custom code snippet

Charter text: A merchant configures a tracking integration and a custom code snippet in
Admin. Both render on the storefront and on the order confirmation page
without rebuilding the Shop application, neither appears on the payment
form page, and both changes are recorded as auditable merchant actions.
Status: UNKNOWN — not yet assessed
Prerequisites:
Storefront Tracking and Custom Code
audit
Blocked by: —

## Scenario 15 — module-level container static audit

Charter text: An enumeration of every module-level container in Core that holds
plugin-derived state is checked against the rebuild path of each extension
lifecycle action, with every container accounted for under every action.
This is a static audit, not a runtime test.
Status: UNKNOWN — not yet assessed
Prerequisites:
State and Storage Boundaries
Extension Lifecycle
Blocked by: —

## Scenario 16 — unhandled asynchronous error

Charter text: An enabled extension raises an unhandled asynchronous error. The Core
process continues serving, the failure is recorded with its originating
extension, and no other extension's capability is affected.
Status: UNKNOWN — not yet assessed
Prerequisites:
Failure Containment
Blocked by: —

## Open decisions

(none recorded yet)
