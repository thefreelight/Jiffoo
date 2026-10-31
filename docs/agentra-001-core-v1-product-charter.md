# AGENTRA-001: Jiffoo Core V1 Product Charter

Status: active
Updated: 2026-10-31

## 1. Product Promise

Jiffoo Core V1 is a self-hosted commerce appliance for one merchant and one
storefront.

A merchant deploys Core once, owns its store data and operating environment,
and then manages daily commerce operations, extensions, and themes from the
Admin application. Core updates are performed by the operator with one official
host command; Admin shows the current version and health, not an update UI.
The merchant must not need SSH access, a plugin-specific deployment, or a
service restart to begin using an installed extension. This is the primary
differentiator.

Jiffoo is not a hosted marketplace platform. It combines the merchant control
of self-hosted software with a modern extension experience: install, configure,
enable, use, update, and diagnose from one product surface. Merchants can
write their own extensions; Core provides the published contracts and tooling
required to make that promise real.

Core V1 must run correctly with multiple API and worker instances sharing
PostgreSQL, Redis, and object storage. This is verified under Docker Compose
with at least two API and two worker instances. Core keeps no mutable
request-scoped state in process memory, and reaches plugin packages and
uploaded files through a storage abstraction rather than a fixed local path.
Extensions run in-process. Core does not constrain the state an extension
holds. An extension declares its own statelessness for multi-instance
deployment; Core does not enforce it in V1. Multi-instance orchestration
supports these shared-state instances in V1. Kubernetes deployment profiles,
autoscaling, and zero-downtime rolling Core updates are deferred.

## 2. Merchant Journeys

### Initial Store Operation

After initial deployment, the merchant creates and operates one store using
the built-in catalog, customers, inventory, cart, checkout, orders, Admin, and
Shop applications. The store completes baseline transactions with manual
payment, free shipping, zero tax, manual fulfillment, and console email when
no extension is installed.

### Add a Capability

The merchant browses a static marketplace JSON catalog configured by the
operator through EXTENSION_MARKETPLACE_URL, or uploads a local plugin ZIP.
The catalog declares plugin identity, publisher, versions, API compatibility,
download URL, size and SHA-256. It is not a V1 marketplace service API. If the
catalog is unavailable or unconfigured, browsing is unavailable while local
upload remains available.

Marketplace packages must be signed. Package downloads stay on the catalog's
origin; catalog and package requests do not follow redirects. HTTPS is
required, except that HTTP on 127.0.0.1 is allowed in test-signing mode or
under NODE_ENV=test. The catalog's publisher and digest declarations do not
establish package trust; Core verifies the downloaded package.

Downloaded and locally uploaded plugin packages use the same verified
installer and compatibility policy. Installation does not enable a plugin;
configuration and enablement use the normal Admin lifecycle transition.
The catalog SHA-256 verifies downloaded bytes only; it never establishes
package trust.

Local upload is preview-first. Preview validates the archive and reports its
identity, trust, compatibility and proposed operation without executing plugin
code. Final installation requires the preview token and the same package.
Unsigned installation requires a separate warning and an exact typed-slug
confirmation, recorded in AdminAuditEvent before plugin execution. Bundle
installation is removed; plugins are installed through marketplace or the
normal local ZIP upload path.

Before activation, Core shows the package version, declared capabilities,
compatibility, publisher identity when verifiable, and verification state. A
merchant configures the extension in a Core-native settings page, enables it,
and uses the new capability without restarting Core. A payment extension
becomes selectable through the normal checkout flow; theme management is the
surface through which themes are activated, while Core V1 ships one default
Shop theme.

### Update Core

The operator updates Core with one official host command. Before changing the
running version, the command reports the target version, compatibility impact,
backup requirement, and whether database migration is required. It rejects an
unverifiable release or an incompatible installed plugin. A failed update with
no migration automatically restores the prior application version. After any
Core or plugin migration is applied, recovery uses a documented command to
restore the pre-update backup, not application rollback. Admin shows the current
version and health only; there is no Core update UI in V1.

## 3. Core V1 Capabilities

### Commerce Kernel

Core owns product, catalog, customer, inventory, cart, checkout, order,
payment state, administrator access, audit, and operational health semantics.
V1 has two account roles, customer and admin; every active admin has full Admin
access. Fine-grained Admin permissions are a future value-add outside Core V1.
The Core public API is versioned and remains owned by Core. Plugins may access
the self-hosted database under their publisher accountability boundary, while
Core remains the authority for its product semantics and support contract.

Known limitations (2026-10-04):

- RESOLVED (ec73b7ff2): webhook verification receives the original HTTP bytes.
  Real payment-provider integration acceptance remains provider-specific.
- RESOLVED (ec73b7ff2, 7a489044e): rejected webhook authentication returns the
  stable 401 PAYMENT_WEBHOOK_AUTHENTICATION_FAILED contract.
- RESOLVED (f4ee3d223): payment-provider disable and removal decisions share
  a transaction-scoped PostgreSQL advisory lock, and recheck the last enabled
  provider inside the write transaction. Concurrent administrators cannot
  disable or remove the final enabled payment provider.

Timezone policy (decided by Simo, 2026-10-12): one store timezone is selected
in Admin, defaults to UTC, and applies to Shop, Admin and notification emails.
Stored timestamps remain UTC.

### Extension Center and Execution

Core provides one Extension Center for marketplace downloads and local package
uploads. It has one extension registry, one package manifest, one installation
lifecycle, one compatibility policy, one visibility policy, and one trust
policy.

Known limitation (2026-10-04): each Admin plugin-list request reads and hashes
the stored package blob for every returned non-builtin plugin to report
package state. The list has no metadata-only integrity fast path.

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

The Extension SDK is required to provide the database connection and
versioning arrangement plugins use. It does not restrict which schemas,
tables, or SQL statements a plugin may use, per §4.

RESOLVED (1e836aa08): the SDK and PluginContext provide the handler-scoped
plugin database query and transaction path.

When a plugin is updated, module cache invalidation covers the entry module
and its dependency tree.
Invalidating only the entry module leaves the prior version's dependencies
resident and serving. Repeated extension updates in one Core process accumulate
memory because Node.js cannot unload a module. Periodic Core restart is
expected operational practice and is not a defect.

Known limitation (2026-10-04): old content-addressed plugin version
directories are retained during the process lifetime, including after update
or purge. A process restart releases module memory; no automatic removal of
these directories on restart is currently established.

Core V1 defines five capability contracts, each owned and versioned by Core:
payment, shipping, tax, fulfillment, and notification. The tax contract is
resolved before order placement and participates in the order total. Core may
ship a zero-tax builtin implementation, but the checkout call site exists in
V1.

Every extension has a Core-native settings page generated from its declared
configuration. Core owns navigation, form validation, secret storage,
authorization, and error presentation. An extension may also declare custom
Admin pages in its package. Core renders their static front-end assets only
inside Core-provided sandboxed iframes without allow-same-origin, beneath the
Admin plugin area, with administrator authorization and a versioned bridge.
These pages do not replace Core-native settings or inject application code
into Core pages.

Plugins may declare storefront pages under /apps/<slug>/... with translated
titles, Core-owned navigation placement, and optional sign-in requirements.
Core owns the page shell and renders package assets only in an opaque-origin
sandboxed iframe through a versioned bridge. Page context may include the
signed-in customer's ID, display name and email, or null when signed out,
alongside locale, currency, theme tokens and store information. Core owns
cart, checkout and payment actions; plugin pages never render on cart,
checkout or payment pages. Disabling a plugin removes its navigation and
makes its pages return 404.

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

Admin list and detail show the sanitized last recorded plugin error and its
timestamp. Recording is throttled per plugin for five seconds. A successful
enable, invocation or restore does not clear it; it is historical information,
not a current health verdict.

Known limitations (2026-10-04):

- Accepted V1 limitation: plugin code runs in-process and cannot be forcibly
  interrupted. A timed-out invocation can keep running, a synchronous
  infinite loop blocks its process, including the worker, and there is no
  process isolation.
- Accepted V1 limitation: install-time candidate prewarm and module loading
  have no overall execution deadline. The 15-minute operation lease fences
  publication; it is not an execution timeout and does not stop plugin code.

### State and Storage Boundaries

Core V1 supports multiple API and worker instances sharing PostgreSQL, Redis,
and object storage. The Docker Compose acceptance setup runs at least two API
and two worker instances.

- Session state lives outside the process.
- Plugin ZIP bytes are persisted in PostgreSQL. PluginPackageStore exposes
  immutable content-addressed local package directories materialized from
  those bytes. No code outside the storage abstraction resolves a package
  path.
- Theme package bytes are persisted in PostgreSQL like plugin packages and
  materialized on every instance through the storage abstraction.
- Merchant-uploaded files use a storage abstraction with a local-disk backend
  for development and single-host use, and an S3-compatible backend for
  production. The default Compose deployment ships a self-hosted S3-compatible
  service shared by all instances.
- Background jobs take a distributed lock rather than assuming a single
  instance. Scheduled jobs are idempotent.
- Plugins may enqueue durable PostgreSQL-backed background tasks with
  idempotency keys and optional scheduled execution. Only workers execute
  declared handlers, with bounded runtimes, renewing leases, claim fencing,
  retries, cancellation and observable status across instances. Disabled
  plugins receive no new execution. Delivery is at least once; plugin authors
  must deduplicate external effects.
  Handlers declare concurrency, attempt and runtime limits within operator
  caps, with cluster-wide fairness and optional fenced final-failure hooks.
  Disable or dependency unavailability pauses pending work and aborts/fences
  running attempts without consuming an attempt or invoking a failure hook;
  tasks resume after availability returns. Uninstall cancels pending/running
  work without a failure hook, retaining history and inputs until purge.
  Compatible handler versions retain queued work across ordinary updates;
  update-aborted attempts retry without consuming their attempt budget.
  Each execution exposes a unique claim ID and increasing fence for
  plugin-owned conditional writes; task keys are retained until purge.
- Plugin files use Core object storage through scoped SDK operations and
  token-authorized uploads. References are isolated by plugin and owning
  customer or administrator; display uses short-lived signed URLs, not public
  object paths. Browser frames receive no Core session credentials.
- Core maintains a plugin registry version counter in the database, incremented
  on install, enable, disable and update. Each instance reads it to trigger
  coordinated runtime reload. Registry reload and cache invalidation use
  separate signals and counters.

After any extension lifecycle action, every piece of plugin-derived in-process
state is consistent with the database state for that installation. Every
module-level container holding plugin-derived state appears on the rebuild path
of every lifecycle action. A circuit breaker state, rate-limit counter, or
service reference that survives disable and re-enable produces behaviour that
contradicts the database. This is a static audit, like scenario 12.

### Plugin Database and Migrations

Core is required to discover and execute plain .sql migrations packaged by a
plugin during install or update, with the package-manifest audit specified
below.

RESOLVED (3650a285e, 0cd7d66c8): runtime migrations use declared, packaged
.sql files and the package-derived default schema.

There is no production data to preserve when changing the migration format.
The packaged .sql format is a clean break: exported {id, sql} migrations are
rejected, with no legacy ledger reconciliation.

A plugin must not run prisma migrate deploy, because that writes to
Core's _prisma_migrations ledger. A plugin may not ship a generated Prisma
client or another native module for queries.

Core provides a package-derived default schema when it executes a plugin's
migrations. This is a naming convention, not a permission boundary. Core
applies no GRANT restriction and a package may still reach Core tables, per
§4. Without such a namespace, plugin tables and Core tables would share one
namespace, leaving collision-safety to package authors with no default
protection.

Plugin migration history must be recorded in a dedicated plugin migration
ledger, separate from the Core migration ledger. Before execution, Core must
verify each plugin migration file's identity, order, and SHA-256 against the
installed package manifest, and record its result for audit.

RESOLVED (3650a285e, 9c2bc9aa1): the dedicated plugin migration ledger and
manifest auditor verify package identity, migration order and SHA-256 and
record migration results.

A checksum computed from migration contents and compared only to a prior
ledger entry does not satisfy this requirement: it detects modification of an
installed package migration but not substitution of the package. Core
migrations are audited against the selected release line. Plugin database
access is governed by publisher accountability rather than a Core schema,
table, or SQL permission boundary. Package authors are responsible for the
safety of their migrations and collision-safe naming when a package writes
outside the default schema.

### Plugin Trust Model in V1

Plugin code runs in-process in the Core process. The SDK database path applies a
schema `search_path` default that points at the plugin's own schema, but it
applies no table-level boundary: a schema-qualified statement can still reach
Core tables, and a package may also reach Core tables through Node module
resolution inside the Core process. This is publisher accountability under §4,
not technical isolation, and it is an accepted V1 limitation. The concrete
locations are `apps/api/src/core/admin/extension-installer/plugin-database.ts`
(the plugin transaction and its `search_path` default),
`apps/api/src/core/admin/extension-installer/plugin-database-sql.ts` (the SQL
admission rules) and
`apps/api/src/core/admin/extension-installer/plugin-module-loader.ts` (the
in-process module loader).

### Event Layer

Extensions may also extend Core by subscribing to versioned Core events and
calling the versioned Core API. An extension declares its subscriptions (event
type and version) in its manifest and registers in-process handlers. Core
delivers each event to each subscribed installation at least once, with retry
and a stable event ID; an extension achieves a single effect by deduplicating
on that ID. Delivery order is not guaranteed. V1 does not deliver events to
external URLs. V1 events are order.created, order.confirmed, order.paid,
order.cancelled, order.refunded, order.fulfilled, payment.succeeded,
payment.failed, customer.created, product.created, and product.updated.

V1 order event payloads include an optional `orderNumber` string matching
`PREFIX-YYYYMMDD-NNNN` (2–6 uppercase ASCII prefix letters, 8 date digits,
and at least 4 sequence digits). Events emitted after the readable-order-number
release always include this field; older stored events may omit it. For
`order.paid`, the field belongs to the nested `order` object. Historical event
snapshots and event versions remain unchanged. HTTP order responses require
`orderNumber` because all order rows are numbered by the migration.

This event layer supports extensions that do not implement a capability
contract, including ERP synchronization, CRM delivery, SMS, tagging, and
reporting, without a Core change. Event handlers run in-process: Core cannot
stop a handler that exceeds its time limit, and process isolation remains
deferred.

Events occurring while an extension is disabled or dependency-unavailable
are never delivered later. Core provides a read-only, cursor-paginated SDK
query of paid orders and their lines for recovery after missed events, plugin
crashes or exhausted retries. It requires the merchant-approved manifest
permission commerce:orders.read and enforces bounded time windows and page
sizes. Plugins deduplicate reconciliation and event effects by order ID in
their own transactional effect ledger; this query is not event replay.

### Plugin Services

Plugins may export versioned service methods and declare dependencies on
other plugins' services. Calls pass through Core with trusted caller identity,
timeouts, failure containment and idempotency keys for money-like operations.
Calls work in task handlers and final-failure hooks. Consumers declare the
specific provider and permitted methods; Core shows and enforces merchant
grants. Provider business errors retain structured code, message and details,
distinct from Core failures, and the SDK generates versioned client types.
Install and enable validate dependency versions and ordering. Disabling a
dependency requires merchant confirmation of affected dependents and makes
them unavailable for new work; uninstall and purge
are blocked while an enabled dependent exists. Core does not promise an
atomic cross-plugin transaction or exactly-once external effects.

### Extension SDK

Core ships an Extension SDK versioned alongside Core. It includes TypeScript
definitions for the five capability contracts and event layer, create
scaffolds for integration, shipping and payment plugins, and keygen, pack,
sign, upload and dev commands. Scaffold builds produce CommonJS packages.

The SDK also includes a versioned front-end bridge package, a Vite-based
plugin-page scaffold, and server-side storage, durable task and service APIs.
Browser assets are built separately from the CommonJS server entry and are
delivered in the same verified plugin package. An example plugin demonstrates
pages, uploads, long-running tasks and a call to another plugin's service.

Upload uses the normal preview and final-install path with an administrator
access token. Unsigned upload requires an interactive terminal and exact
typed-slug confirmation; it is never automatically uploaded by dev mode.
An explicit --enable uses the normal enable transition only for a first
installation and does not re-enable an existing installation.

Dev mode requires a loopback Core URL and a package that Core preview
classifies as test-signed. It uses <slug>-dev and strictly numeric
major.minor.patch versions, incrementing the patch above the greater source
or installed development version. It watches and rebuilds changed output,
then packages, signs and uploads it; unchanged output is skipped and a build
failure preserves the last good installation. The source manifest is not
rewritten.

RESOLVED (1e836aa08): the SDK and PluginContext provide the handler-scoped
plugin database query and transaction path.

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
A theme package must not carry browser script or declare an injection point.
An extension package may carry declared sandboxed page assets, rendered only
inside Core-provided opaque-origin frames through the versioned bridge, never
injected into Core pages and never rendered on cart, checkout or payment pages.
Extension packages cannot declare Core-page injection points. The merchant is
responsible for the safety, performance, and regulatory compliance of custom
code. Core records which merchant account
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

RESOLVED for the demonstrated cross-timezone order-detail cause (2026-10-12):
OrderDetail previously formatted with the host/browser's implicit timezone.
Actual hydrateRoot reproduction shows differing date text; explicit store
zones now pass the hydration regression and E2E_RELOAD_STRESS=1 home,
checkout and cross-timezone order-detail reload checks. The earlier intermittent
home failure did not reproduce in the pre-change baseline.

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
switch, migration, health check, and backup-restore flows define the supported
update behavior. A single binary is not a V1 promise. The deployment supports
multiple API and worker instances sharing PostgreSQL, Redis, and object storage.
Kubernetes deployment profiles, autoscaling, and zero-downtime rolling Core
updates are deferred (§6).

Core updates and extension updates are separate merchant operations. Extension
updates replace one verified package. Core updates replace the Core application
version and may include a controlled database migration.

Core updates are performed by the operator with one official host command.
The command performs, in order: release identity and integrity verification,
installed-plugin compatibility checks, maintenance with all API and worker
instances stopped or drained, backup before any migration, Core and plugin
migrations, application start, and health checks. Daily operations, extensions,
and themes remain in Admin without SSH access or service restart. Admin shows
the current version and health only; V1 has no update UI and no updater
container with Docker socket access.

Before any migration write in the update flow, Core audits Core migration
names, order, and SHA-256 fingerprints against the selected release line. It audits plugin
migration names, order, and SHA-256 fingerprints against each installed package
manifest. Any drift or mismatch blocks the update. Once any Core or plugin
migration has been applied after the backup snapshot taken for that update,
Core does not offer application rollback for that update. A failed update with
no migration automatically restores the prior application version. After any
migration is applied, recovery is a restore from the pre-update backup using a
documented host command. This audit requirement applies to migration writes in
the update flow, not every business write.

### Extension Lifecycle

An enabled extension is visible only at its declared product surface. Disabling
an extension removes its Admin and Shop entry points and stops Core from running
its code for new work: capability calls, event delivery, and background
processing. Pending tasks pause; running attempts are aborted and fenced
without consuming an attempt, then become eligible again after enable or
dependency recovery. Uninstall instead cancels pending/running tasks. Neither
pause nor cancellation invokes a task final-failure hook. Lifecycle hooks
(onDisable, onUninstall) and install/upgrade
validation are the only exceptions. Events that occur while an extension is
disabled or dependency-unavailable are never delivered, even after availability
returns; permissioned paid-order reconciliation recovers missed effects
without replaying events. For a disabled
payment extension, inbound payment callbacks are refused with a retryable
response, reconciliation skips it, and manual mark-paid is blocked; Admin warns
about orders awaiting payment before it is disabled. Core continues to protect
already-created orders according to its transaction state rules.

Uninstall is a soft removal: the plugin is disabled and appears in Removed,
while configuration, encrypted credentials, package bytes and local directories
are retained. Restore validates the retained package and signing policy and
keeps the plugin disabled; enabling remains a separate merchant action.
Builtin plugins cannot be uninstalled or purged.

Purge requires prior uninstall and exact typed-slug confirmation. Any PENDING
payment for the plugin blocks purge. Purge deletes Core-held installation
records, configuration, secrets and package blobs, and records an
AdminAuditEvent. It preserves order and payment history, plugin-owned data,
the plugin migration ledger and local package directories.

## 4. Non-Negotiable Rules

- Core is single merchant and single storefront. It has no multi-tenant SaaS,
  Super Admin, commercial-plan, subscription, or platform-account requirement.
- There are three package trust tiers with identical execution rights:
  builtin ships with Core; signed has certificate-verified publisher identity
  and package integrity; unsigned has neither. Core persists the signing-root
  classification separately from the trust tier.
- EXTENSION_TEST_SIGNING_MODE is an operator switch available in any
  environment and defaults off. It requires a valid Ed25519
  JIFFOO_TEST_PLUGIN_ROOT_PUBLIC_KEY distinct from the official root.
  Authenticated Admin displays a test-signing banner; test-root packages are
  labeled Test-signed and are never presented as officially Verified.
- API and worker refuse startup for an invalid mode value, a test root while
  mode is off, or an enabled mode with a missing, invalid or official test
  root. Official-root override inputs are allowed only under NODE_ENV=test.
  Turning test-signing mode off blocks loading, enabling, restoring and
  invoking installed test-signed plugins; it does not by itself prevent Core
  startup. Signed records without an established signing root require
  reinstall.
- An unsigned package may install and execute local business code. Core shows
  an explicit warning, requires a separate exact typed-slug confirmation, and
  records it in AdminAuditEvent before plugin execution.
- A package signature establishes publisher accountability, not technical
  isolation. Core does not restrict a package's database schema, table, or SQL
  access in V1. The package-derived default schema in §3 is a naming convention
  and does not narrow this rule. The package publisher accepts responsibility
  for database safety and compatibility.
- Payment extensions implement the Core payment contract. Core owns checkout,
  payment state, order state, reconciliation, and provider-independent error
  semantics. Provider-specific direct checkout paths are not retained.
- Storefront custom code and tracking identifiers originate only from merchant
  input in Admin. Theme packages cannot carry browser script. Extension
  packages may carry browser assets only for declared pages rendered in
  Core-provided sandboxed iframes without allow-same-origin and accessed through
  the versioned bridge. Neither package type may declare Core-page injection
  points; plugin pages never render on cart, checkout or payment pages.
- Themes are presentation data only. Executable Theme App processes, theme
  gateways, and arbitrary executable theme runtimes are not Core V1 features.
- imagic is built as Core plugins on the general plugin page capability and
  receives no product-specific exception. It is not a V1 static theme.
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
   retry delivery, and produces one effect only by deduplicating on the stable
   event ID.
7. The declarative default Shop theme and an Admin theme are each validated,
   activated, configured, rendered at runtime without rebuild, and reverted by
   reactivating the previous theme. Validation rejects a package containing
   executable code or browser JavaScript.
8. A disabled extension has no Admin navigation, Shop presentation, callable
   capability, new event delivery, or new background processing.
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
17. At least two API and two worker instances run under Docker Compose sharing
    PostgreSQL, Redis, and S3-compatible object storage. Shared rate limiting,
    task claims and fencing, extension lifecycle and runtime reload, and plugin,
    theme, and uploaded-file availability remain correct across instances.
18. A verified plugin package provides storefront and Admin pages in Core
    shells through sandboxed iframes without allow-same-origin. Three-language
    navigation, theme tokens, locale and light/dark changes work. The storefront
    page receives signed-in customer ID, display name and email, adds a product
    through Core cart actions, completes Core checkout and offers a return link
    from the payment result page. Sign-out removes identity and revokes access;
    disabling the plugin removes navigation and makes both page surfaces 404.
    Admin pages require an administrator and an Admin-scoped plugin token.
19. Opaque-origin requests use plugin-scoped Bearer tokens with no cookies.
    Null Origin is rejected by every cookie-authenticated endpoint, including
    requests that do not require CORS preflight. Ordinary Core credentials and
    forged bridge sources cannot bypass this isolation. Vite-built module
    scripts and bundled fonts load under the frame CSP. No plugin frame renders
    on cart, checkout, payment or result pages; result pages contain only the
    Core-owned return link.
    Frame attributes and response sandbox allow scripts and forms, but not
    same-origin access. A React/Vite onSubmit handler works while CSP
    form-action 'none' blocks actual form submission/navigation.
20. A customer uploads a file from a plugin frame to Core storage; the owning
    plugin reads the reference and writes a file through the SDK. A short-lived
    signed URL displays the file. Other plugins/customers, expired or tampered
    grants, disabled plugins and purged installations cannot access it.
    A bridge file.download action lets the customer save a generated image
    after Core-owned confirmation without frame download privileges.
21. A plugin's durable task runs longer than 30 seconds with lease renewal
    across at least two worker instances. Competing claims, worker loss, stale
    completion, retry, idempotency, scheduled execution, cancellation and disable
    are demonstrated without accepting stale fenced writes or new disabled work.
    Handler-declared limits and cluster-wide fairness are enforced; ignored
    aborts retain physical execution slots. Final failures can call a refund
    service once through a fenced worker hook, with unknown outcomes retained
    for reconciliation. Disable and dependency loss pause tasks; running
    attempts abort/fence without consuming an attempt or invoking a failure
    hook, then resume with a fresh claim after recovery. Uninstall cancels
    pending/running work without a hook; cancelled payloads remain queryable.
    Compatible handler updates preserve queued tasks and retry aborted attempts
    without a budget charge. Unique claim IDs and increasing fences protect
    plugin-owned conditional result writes from older attempts. Task keys
    remain until purge; recurring self-enqueue uses time-bucket keys. SDK dev and test drain
    run tasks and final-failure hooks through the same engine.
22. Two plugins call a declared versioned service through Core with trusted
    caller identity and money-like idempotency. Timeout/unknown outcomes are
    reconciled without repeating the business effect. Missing dependencies and
    cycles are rejected; dependency disable makes dependents unavailable and
    uninstall/purge is blocked while an enabled dependent exists.
    Provider disable requires confirmation of its impact. Merchant-approved
    method permissions apply in requests, tasks and failure hooks; structured
    provider errors pass through unchanged and generated wallet-v1 types
    compile in the consumer. Debit/enqueue crash gaps and unknown compensation
    use stable business keys; dependency unavailability is explicitly retryable
    and pauses dependent tasks until recovery.
23. A wallet provider is disabled while another enabled payment provider
    completes a paid order. No event from the disabled window is delivered
    later. After recovery, a merchant-granted commerce:orders.read SDK query
    lists paid orders and their lines using bounded windows and cursor pages.
    Reconciliation credits the order once, deduplicating by order ID against
    events and repeated/concurrent sweeps. Plugin crashes and exhausted event
    retries are also recovered; missing or revoked permission is rejected.

## 6. Deferred Decisions

The following are not implied by Core V1 and require a new product decision:

- remote third-party applications, their hosting model, and OAuth;
- component-rendered extensions and UI slots inside Core pages; V1 instead
  supports declared sandboxed storefront and Admin pages with scoped data
  access and an explicit frame CSP;
- multiple configuration instances for one extension;
- automatic reclamation of retained local package directories and deletion
  of plugin-owned database data or plugin migration history; Core-held
  installation records, configuration, secrets and package blobs can be
  deleted through the audited purge operation;
- promotion and discount as an extension contract;
- official extension and theme source, artifact publication, production
  rollout, or closed-source repository work inside the Core worktree.
- Kubernetes deployment profiles, autoscaling, and zero-downtime rolling Core
  updates;
- consent management and cookie banner for storefront tracking;
- sandboxed server-side extension execution. V1 chooses publisher
  accountability over technical isolation for server code; browser page
  sandboxing does not change this boundary. Products that sandbox server code
  restrict it to standard language built-ins without third-party module imports, which is
  incompatible with the capability contracts in §3;
- storefront script sandboxing, in which tracking code subscribes to structured
  events rather than executing in the page;

## 7. Outside the V1 Worktree

This section identifies surfaces that are not part of Core V1; their presence
in the worktree does not make them V1 surfaces.

- The Cloudflare Worker application is a separate deployment surface outside
  Docker Compose, the single V1 reference delivery form.
- Kubernetes updater tooling is a Kubernetes deployment surface; §6 defers
  Kubernetes deployment profiles, autoscaling, and zero-downtime rolling Core
  updates.
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
