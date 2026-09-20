# AGENTRA-001: Jiffoo Core V1 Product Charter

Status: active
Updated: 2026-09-20

## 1. Product Promise

Jiffoo Core V1 is a self-hosted commerce appliance for one merchant and one
storefront.

A merchant deploys Core once, owns its store data and operating environment,
and then manages daily commerce operations, extensions, themes, and Core
upgrades from the Admin application. The merchant must not need SSH access, a
plugin-specific deployment, or a service restart to begin using an installed
extension. This is the primary differentiator.

Jiffoo is not a hosted marketplace platform. It combines the merchant control
of self-hosted software with a modern extension experience: install, configure,
enable, use, update, and diagnose from one product surface. Merchants can
write their own extensions; Core provides the published contracts and tooling
required to make that promise real.

Core V1 is delivered as a single instance. Its architecture must not prevent
future multi-instance deployment for Core itself: Core keeps no mutable
request-scoped state in process memory, and reaches plugin packages and
uploaded files through a storage abstraction rather than a fixed local path.
Extensions run in-process. Core does not constrain the state an extension
holds. An extension declares its own statelessness for multi-instance
deployment; Core does not enforce it in V1. Multi-instance orchestration
itself is not a V1 feature.

## 2. Merchant Journeys

### Initial Store Operation

After initial deployment, the merchant creates and operates one store using
the built-in catalog, customers, inventory, cart, checkout, orders, Admin, and
Shop applications. The store completes baseline transactions with manual
payment, free shipping, zero tax, manual fulfillment, and console email when
no extension is installed.

### Add a Capability

The merchant browses a static marketplace JSON index or uploads a local
package. The index contains a package name, version, download URL, SHA-256,
and publisher. It is not a V1 service API. If the index is unavailable,
Extension Center has no browsable list, while local upload remains available.

Marketplace download fetches a package only. Downloaded and uploaded packages
then follow one identical installation path: verification, compatibility
checking, migration handling, settings-page generation, and enablement. The
index SHA-256 verifies downloaded bytes only; it never establishes package
trust.

Before activation, Core shows the package version, declared capabilities,
compatibility, publisher identity when verifiable, and verification state. A
merchant configures the extension in a Core-native settings page, enables it,
and uses the new capability without restarting Core. A payment extension
becomes selectable through the normal checkout flow; theme management is the
surface through which themes are activated, while Core V1 ships one default
Shop theme.

### Update Core

The merchant sees an available Core version and chooses whether to update.
Before changing the running version, Core explains the target version,
compatibility impact, backup requirement, and whether database migration is
required. Core rejects an unverifiable release or an incompatible installed
extension. After an update, Core reports the health result and makes the prior
application version available when no Core or plugin migration has been
applied for that update.

## 3. Core V1 Capabilities

### Commerce Kernel

Core owns product, catalog, customer, inventory, cart, checkout, order,
payment state, merchant permission, audit, and operational health semantics.
The Core public API is versioned and remains owned by Core. Plugins may access
the self-hosted database under their publisher accountability boundary, while
Core remains the authority for its product semantics and support contract.

### Extension Center and Execution

Core provides one Extension Center for marketplace downloads and local package
uploads. It has one extension registry, one package manifest, one installation
lifecycle, one compatibility policy, one visibility policy, and one trust
policy.

V1 has exactly one local execution model. Packages run in-process through a
fixed plugin gateway. Plugin code is reached only through an isolated Fastify
instance dispatched with inject(). Plugin routes are never registered on the
Core Fastify instance. Fastify rejects route registration after the instance
has started, so a separate instance per installation is the only form in which
enablement without restart is possible. Remote hosted extensions are not V1
features.

V1 plugin entry modules are CommonJS. ESM plugin packages are not supported in
V1 because Node.js provides no supported way to invalidate a loaded ESM module
and the available workaround leaks memory on every update. A plugin package
must not contain native modules, including a bundled generated Prisma client.
Native modules cannot be required a second time, so a package containing one
cannot be updated without restarting Core, which defeats the product promise
in §1.

The Extension SDK provides the database access path plugins use. This is a
connection and versioning arrangement. It does not restrict which schemas,
tables, or SQL statements a plugin may use, per §4. When a plugin is updated,
module cache invalidation covers the entry module and its dependency tree.
Invalidating only the entry module leaves the prior version's dependencies
resident and serving. Repeated extension updates in one Core process accumulate
memory because Node.js cannot unload a module. Periodic Core restart is
expected operational practice and is not a defect.

Core V1 defines five capability contracts, each owned and versioned by Core:
payment, shipping, tax, fulfillment, and notification. The tax contract is
resolved before order placement and participates in the order total. Core may
ship a zero-tax builtin implementation, but the checkout call site exists in
V1.

Every extension has a Core-native settings page generated from its declared
configuration. Core owns navigation, form validation, secret storage,
authorization, and error presentation. An extension does not supply arbitrary
Admin application code in V1.

### Failure Containment

A single extension failure does not terminate the Core process. Core
establishes error boundaries around gateway dispatch, lifecycle hooks, and
event handler invocation. The process registers handlers for uncaught
exceptions and unhandled promise rejections. They record the failure and its
originating extension. They do not exit the process.

The gateway request timeout and circuit breaker are part of this contract, not
an implementation detail. V1 executes extension code in-process by design. A
signature establishes accountability, not isolation, so containment of failure
is Core's responsibility rather than the package's.

### State and Storage Boundaries

Core V1 runs as one instance but is built so a later multi-instance deployment
adds orchestration rather than requiring rearchitecture.

- Session state lives outside the process.
- Plugin packages are reached through a PluginPackageStore interface. V1 ships
  a local-directory implementation. No code outside that interface resolves a
  package path.
- Merchant-uploaded files follow the same pattern.
- Background jobs take a distributed lock rather than assuming a single
  instance. Scheduled jobs are idempotent.
- Core maintains a plugin registry version counter in the database, incremented
  on install, enable, disable and update. V1 writes it; a later multi-instance
  deployment reads it to trigger reload.

After any extension lifecycle action, every piece of plugin-derived in-process
state is consistent with the database state for that installation. Every
module-level container holding plugin-derived state appears on the rebuild path
of every lifecycle action. A circuit breaker state, rate-limit counter, or
service reference that survives disable and re-enable produces behaviour that
contradicts the database. This is a static audit, like scenario 12.

### Plugin Database and Migrations

Core discovers and executes database migrations packaged by a plugin during
its install or update. Plugin migrations are plain .sql files executed by Core
itself. A plugin must not run prisma migrate deploy, because that writes to
Core's _prisma_migrations ledger. A plugin may not ship a generated Prisma
client or another native module for queries.

Core provides a package-derived default schema when it executes a plugin's
migrations. This is a naming convention, not a permission boundary. Core
applies no GRANT restriction and a package may still reach Core tables, per
§4. Without such a namespace, plugin tables and Core tables would share one
namespace, leaving collision-safety to package authors with no default
protection.

Plugin migration history is recorded in a dedicated plugin migration ledger,
separate from the Core migration ledger. Before execution, Core verifies each
plugin migration file's identity, order, and SHA-256 against the SHA-256
recorded in the installed package manifest, and records its result for audit.
A checksum computed from migration contents and compared only to a prior
ledger entry does not satisfy this requirement: it detects modification of an
installed package migration but not substitution of the package. Core
migrations are audited against the selected release line. Plugin database
access is governed by publisher accountability rather than a Core schema,
table, or SQL permission boundary. Package authors are responsible for the
safety of their migrations and collision-safe naming when a package writes
outside the default schema.

### Event Layer

Extensions may also extend Core by subscribing to versioned Core events and
calling the versioned Core API. Core delivers events with retry and idempotency
guarantees. V1 events include at minimum order.created, order.paid,
order.fulfilled, customer.created, and product.updated.

This event layer supports extensions that do not implement a capability
contract, including ERP synchronization, CRM delivery, SMS, tagging, and
reporting, without a Core change.

### Extension SDK

Core ships an Extension SDK versioned alongside Core. It includes TypeScript
interface definitions for the five capability contracts and event layer, a
plugin scaffold, a local development mode, and packaging and signing tooling.
Without published contracts and tooling, the promise that merchants can write
their own extensions cannot be met.

### Storefront Tracking and Custom Code

Core V1 provides two distinct merchant-facing mechanisms. A merchant selects
a known tracking provider and supplies its identifier; Core renders the
corresponding snippet. Core owns snippet content and updates it with Core
releases. A merchant also supplies free-form markup for document head, body
start, and body end slots.

Both mechanisms exist because neither suffices alone. A provider allow-list
cannot keep pace with regional and long-tail tools, and free-form input alone
gives the most common providers no correctness or update path.

Custom code and tracking identifiers originate from merchant input in Admin.
A theme package or extension package must not carry browser script or declare
an injection point. The merchant is responsible for the safety, performance,
and regulatory compliance of custom code. Core records which merchant account
changed it and when. Core does not review its content. This is the same
accountability posture Core takes toward unsigned packages.

Neither mechanism renders on the payment form page. Both render on the order
confirmation page. PCI DSS v4.0.1 requirements 6.4.3 and 11.6.1, mandatory
since 31 March 2025, require every script on a payment page to be authorised,
integrity-checked, and inventoried with written justification, and require
change detection on those pages. The requirement covers all scripts on the
payment page, including analytics and chat widgets. Core's default deployment
must not place a merchant under that obligation. Changes to either mechanism
take effect without rebuilding or redeploying the Shop application.

### Themes

A theme is declarative data, not code. A theme package supplies design tokens,
assets, controlled copy, and a declared block and section layout. Core ships
the components that render it. The compiled Shop and Admin applications read
theme data from the API at runtime. Themes cannot change checkout, order,
authorization, or Core API semantics.

A theme package contains no executable server code, browser JavaScript, UI
component source, or application framework dependency. Executable theme
runtime bundles, theme application installers, and package-declared storefront
embed injection are not Core V1 features. An Admin theme contains design
tokens, CSS variables, assets, and controlled configuration only. An Admin
theme cannot provide a layout declaration, templates, React components, or
JavaScript.

Core validates a theme package before activation. Reverting a theme means
reactivating the previously active theme. Core V1 ships exactly one default
Shop theme built on this declarative path. Theme packages that do not conform
leave the worktree, per §7.

### Core Updates

Docker Compose is the single V1 reference delivery form. Its backup, image
switch, migration, health check, and application-version rollback flows define
the supported update behavior. A single binary is not a V1 promise.

The Docker Compose update flow assumes a single instance and a local
filesystem. Multi-instance update orchestration is deferred (§6).

Core updates and extension updates are separate merchant operations. Extension
updates replace one verified package. Core updates replace the Core application
version and may include a controlled database migration.

Core updates are operator initiated. A supported update verifies the exact
release identity and integrity, checks installed-extension compatibility,
requires a current backup before any database migration, enters a safe
maintenance flow when required, and validates post-update health.

Before every database write, Core audits Core migration names, order, and
SHA-256 fingerprints against the selected release line. It audits plugin
migration names, order, and SHA-256 fingerprints against each installed package
manifest. Any drift or mismatch blocks the update. Once any Core or plugin
migration has been applied after the backup snapshot taken for that update,
Core does not offer application rollback for that update.

### Extension Lifecycle

An enabled extension is visible only at its declared product surface. Disabling
an extension removes its Admin and Shop entry points, rejects new calls to its
capability, and prevents new background or webhook side effects. Core continues
to protect already-created orders according to its transaction state rules.
Physical package deletion and extension-data deletion are not V1 requirements.

## 4. Non-Negotiable Rules

- Core is single merchant and single storefront. It has no multi-tenant SaaS,
  Super Admin, commercial-plan, subscription, or platform-account requirement.
- There are three package trust tiers with identical execution rights:
  builtin ships with Core; signed has verifiable publisher identity and
  package integrity; unsigned has neither. Core displays publisher identity
  and verification state when available.
- An unsigned package may install and execute local business code. Core shows
  an explicit warning, requires a second merchant confirmation, and records
  that confirmation in the audit log before installation continues.
- A package signature establishes publisher accountability, not technical
  isolation. Core does not restrict a package's database schema, table, or SQL
  access in V1. The package-derived default schema in §3 is a naming convention
  and does not narrow this rule. The package publisher accepts responsibility
  for database safety and compatibility.
- Payment extensions implement the Core payment contract. Core owns checkout,
  payment state, order state, reconciliation, and provider-independent error
  semantics. Provider-specific direct checkout paths are not retained.
- Storefront custom code and tracking identifiers originate only from merchant
  input in Admin. No theme package or extension package may carry browser
  script or declare an injection point.
- Themes are presentation data only. Executable Theme App processes, theme
  gateways, and arbitrary executable theme runtimes are not Core V1 features.
- imagic is a downstream branded product outside Core that consumes the Core
  API. It is not a V1 static theme and receives no Core V1 exception.
- Core update, extension update, enable, disable, and theme activation are
  auditable merchant actions with a visible result.

## 5. V1 Acceptance Scenarios

One exact Core release is ready for evaluation only when all scenarios below
are demonstrated:

1. A disconnected installation completes a baseline order with no extension.
2. When the marketplace index is unreachable, browsing is unavailable and
   local package upload still works.
3. A signed extension is downloaded from the marketplace, verified,
   configured in Admin, enabled without restarting Core, selected in checkout,
   receives its provider callback, and completes the Core order transition.
4. An unsigned extension is uploaded, an explicit warning is shown, a second
   merchant confirmation is required and audited, and the identical install and
   enable flow succeeds.
5. A tax contract participates in checkout and is reflected in the order total
   before order placement.
6. An event subscription receives order.created, with retry and idempotency
   demonstrated by a plugin that subscribes to order.created, receives Core
   retry delivery, and produces one effect only.
7. The declarative default Shop theme and an Admin theme are each validated,
   activated, configured, rendered at runtime without rebuild, and reverted by
   reactivating the previous theme. Validation rejects a package containing
   executable code or browser JavaScript.
8. A disabled extension has no Admin navigation, Shop presentation, callable
   capability, new webhook delivery, or new background processing.
9. An update with no migration validates release and extension compatibility,
   changes the application version, passes health checks, and the prior
   application version remains restorable.
10. An update with a migration requires merchant confirmation and backup,
    audits both Core and plugin ledgers before writing, blocks on mismatch,
    reports migration and health results, and does not offer application
    rollback after any migration is applied.
11. API, Admin, Shop, shared, and extension-contract verification pass for the
    exact release commit.
12. No code outside the storage abstraction resolves a plugin package or
    uploaded file path, and no request-scoped state is held in process memory.
    This is a static audit, not a runtime test.
13. The Extension SDK scaffolds a new extension, runs it in local development
    mode, packages and signs it, and the resulting package installs into Core
    through the normal upload path.
14. A merchant configures a tracking integration and a custom code snippet in
    Admin. Both render on the storefront and on the order confirmation page
    without rebuilding the Shop application, neither appears on the payment
    form page, and both changes are recorded as auditable merchant actions.
15. An enumeration of every module-level container in Core that holds
    plugin-derived state is checked against the rebuild path of each extension
    lifecycle action, with every container accounted for under every action.
    This is a static audit, not a runtime test.
16. An enabled extension raises an unhandled asynchronous error. The Core
    process continues serving, the failure is recorded with its originating
    extension, and no other extension's capability is affected.

## 6. Deferred Decisions

The following are not implied by Core V1 and require a new product decision:

- remote third-party applications, their hosting model, and OAuth;
- executable signed storefront extensions, UI slots, CSP, and data access;
- plugin-owned custom Admin pages and analytics dashboards;
- multiple configuration instances for one extension;
- physical extension uninstallation and extension data deletion;
- promotion and discount as an extension contract;
- official extension and theme source, artifact publication, production
  rollout, or closed-source repository work inside the Core worktree.
- multi-instance deployment: package distribution to all instances, per-request
  registry version checking and reload, plugin load coordination during rolling
  updates, and multi-instance Core update orchestration. Registry reload and
  cache invalidation are separate signals requiring separate counters.
  Concurrent registry loading across instances requires coordination;
- Kubernetes and other deployment profiles;
- consent management and cookie banner for storefront tracking;
- sandboxed extension execution. V1 chooses publisher accountability over
  technical isolation. Products that sandbox extension code restrict it to
  standard language built-ins without third-party module imports, which is
  incompatible with the capability contracts in §3;
- storefront script sandboxing, in which tracking code subscribes to structured
  events rather than executing in the page;

## 7. Outside the V1 Worktree

This section identifies surfaces that are not part of Core V1; their presence
in the worktree does not make them V1 surfaces.

- The Cloudflare Worker application is a separate deployment surface outside
  Docker Compose, the single V1 reference delivery form.
- Kubernetes updater tooling is a Kubernetes deployment surface; §6 defers
  Kubernetes and other deployment profiles.
- The external plugin demo example is a remote execution model from an earlier
  batch; remote hosted extensions are not V1 features.
- Multi-store functionality is outside V1 because §4 requires one merchant and
  one storefront.
- Legacy Shop theme packages with an application framework dependency, UI
  component source, or executable runtime bundle are outside V1 because §3
  defines one conforming declarative default theme.
- The imagic-studio theme package is outside Core by §4's imagic rule.
- The market connection status endpoint entry in the static OpenAPI document is
  outside V1 because it describes a platform-account concept prohibited by §4.
