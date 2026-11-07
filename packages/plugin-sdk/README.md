# @jiffoo-core/plugin-sdk

Extension authoring CLI and canonical Core types, version 1.0.0-alpha.7.
Supported runtime: Node.js >=24.13.1 <25, matching Core's Node 24 CI runtime.

Install the SDK tarball attached to the matching Core release:

```sh
npm i ./jiffoo-core-plugin-sdk-1.0.0-alpha.7.tgz
npx jiffoo-plugin create --slug my-extension --name "My extension" --output my-extension
```

## Plugin pages (`create --pages`)

`jiffoo-plugin create --pages` scaffolds the frontend of a plugin next to the
server scaffold. The flag takes no value:

```sh
npx jiffoo-plugin create --slug my-extension --name "My extension" --output my-extension --pages
```

The generated project gains:

```
ui/index.html        the page document, the module entry and nothing else
ui/entry.ts          the bridge connection and the rendered page skeleton
ui/styles.css        the place for the page specific rules
ui/vite.config.mts   the Vite build of the page
```

The `manifest.json` gains a `ui` declaration with `bridgeVersion`, the
`assetDirectory` (`ui`), a `storefrontPages` entry and an `adminPages` entry.
The sample page has the id `studio`, the path `/studio` and the entry
`index.html`. `npm run build` then produces the server bundle and the page
assets in one run: `tools/build.mjs` bundles the server with esbuild and
builds `ui/` with Vite into `dist/package/ui/`, so the whole page stays
inside the declared asset directory.

The page talks to Core through `@jiffoo/plugin-bridge`. `createPluginBridge()`
opens the connection to the page shell; `bridge.ready` resolves when the shell
has handed over the page context, and `bridge.context()` returns it. The
bridge writes the Core theme variables onto `:root` and marks the document
with `data-plugin-theme-ready="true"`, so the page never hardcodes a color, a
radius or a spacing.

### Installing the page dependencies

`@jiffoo/plugin-bridge` and `@jiffoo/plugin-ui` are not published to npm yet.
Install them from the Core release assets as local file dependencies:

```sh
npm i ./jiffoo-plugin-bridge-1.0.0-alpha.4.tgz ./jiffoo-plugin-ui-1.0.0-alpha.1.tgz
```

Then change the `dependencies` of the generated `package.json` to the same
file paths, because the versions in the scaffold are the published coordinates
of the packages, not a registry entry. The Vite and the TypeScript versions of
the scaffold are pinned, like every other build input of a generated plugin.

### The plugin UI stylesheet

`@jiffoo/plugin-ui` is a CSS-only package with no dependency. Import the two
stylesheets from the page entry:

```ts
import '@jiffoo/plugin-ui/tokens.css';
import '@jiffoo/plugin-ui/styles.css';
```

`tokens.css` maps the Core theme variables onto the `--jpu-*` tokens and
supplies a fallback for every token while `data-plugin-theme-ready` is absent.
`styles.css` provides the component classes:

- layout: `jpu-page`, `jpu-stack` with `jpu-stack--xs`, `jpu-stack--sm`,
  `jpu-stack--md` and `jpu-stack--lg`, `jpu-row`, `jpu-divider`
- text: `jpu-heading`, `jpu-heading--lg`, `jpu-text`, `jpu-text--muted`,
  `jpu-code`
- surfaces: `jpu-card`
- actions: `jpu-btn`, with `jpu-btn--primary`, `jpu-btn--secondary`,
  `jpu-btn--outline`, `jpu-btn--ghost` and `jpu-btn--danger`, and the sizes
  `jpu-btn--sm` and `jpu-btn--lg`
- forms: `jpu-field`, `jpu-label`, `jpu-input`, `jpu-textarea`, `jpu-hint`,
  `jpu-error`
- status: `jpu-badge` with `jpu-badge--neutral`, `jpu-badge--success`,
  `jpu-badge--warning` and `jpu-badge--danger`, `jpu-status`, `jpu-empty`,
  `jpu-spinner`

A page that uses these classes never writes an inline style and never injects
markup as a string: the appearance belongs to the Core theme and the text
belongs to the DOM.

Install the generated project's dependencies and run its build script before
packing `dist/package` with `jiffoo-plugin pack --input ... --output plugin.zip`.
`jiffoo-plugin migrations --input my-extension` validates local migration bytes
and prints their declaration; it never connects to a database.

```typescript
import type { PluginContext } from '@jiffoo-core/plugin-sdk';
```

The root export supplies the generated canonical authoring declarations,
including page, task and service manifest declarations. Runtime capabilities
come from Core. `@jiffoo-core/plugin-sdk/cli` resolves the installed CLI.
The package ships tsc-compiled signing, migration, manifest/config/event and
UI-asset validators internally; it has no Core application runtime imports or
workspace dependencies. Archiver and zod remain ordinary npm dependencies.

From the repository, `pnpm --filter @jiffoo-core/plugin-sdk build` builds the
package. `pnpm --filter @jiffoo-core/plugin-sdk test:standalone` runs the
database-free clean-install smoke script. Its audited node:test wrapper is
selected through `pnpm verify:quick --test-files="scripts/plugin-sdk-standalone.test.mjs"`.
It installs the tarball and scaffold build tools in an external temporary
directory and removes that directory afterward. It does not start services.

Each Core release distributes a self-contained SDK tarball as a release asset.
Pre-releases use 1.0.0-alpha.N. npm publishing is deferred until the owner
provides an npm organisation; public publish access will be configured then.

Durable tasks use `ctx.tasks.handle/enqueue/get/list/cancel`. Registration must
match the signed manifest. Tasks are at-least-once, worker-only executions,
with a fresh claimId and increasing fence on every invocation; attempt numbers
can repeat after pause/update. Propagate AbortSignal to external APIs. Core SDK
operations reject expired/revoked claims, but already-issued operations may
complete. The scaffold's examples/tasks.ts contains a repair handler, durable
intent guidance and a conditional result-write recipe for plugin-owned tables.
Use a distinct UTC time-bucket key for each periodic enqueue. Keys survive
terminal history until purge. Anonymous tasks have principal=null and no
customer/admin authority. Request principal overrides are forbidden.

Import `TaskPermanentError` to skip retries and schedule the declared final
hook. One automatic hook invocation can become UNKNOWN after timeout/crash;
reconcile compensation with stable provider keys rather than blindly replaying.
Disable/dependency loss pauses tasks without a retry charge or refund hook;
uninstall cancels them. Ignored abort retains physical execution occupancy.
Handler limits are concurrency 1-16, attempts 1-20, runtime 1-600 seconds;
shared operator caps may be lower. A final hook has its own 1-60 second budget.

Import `PluginBusinessError` to refuse a request you understand. Thrown inside
`ctx.database.transaction`, it rolls that transaction back and reaches your own
service layer with its code, so you answer with
`ctx.services.businessError({code,message,details})` and the consumer sees a
provider rejection instead of a system failure. The class, its marker and the
guard that reads the marker are published with the package, in the runtime
export and in the type snapshot, so a plugin raises the refusal without
declaring the marker itself. A refusal is not a plugin
failure: it is not recorded as one and it does not open the breaker. Every
other exception stays a failure of the plugin and keeps the sanitised
PLUGIN_ERROR of Core.

A refusal only stays a refusal if its details match the `errorDetails` schema
the method declares. The details of a refusal that does not match the declared
schema are a failure of the provider, so declare every detail the method can
refuse with.

For task development use `jiffoo-plugin dev --worker`, an already-running
loopback Core API, and JIFFOO_DEV_WORKER_ENTRY pointing to the matching compiled
Core worker entry. Explicit DATABASE_URL_TEST and REDIS_URL select the dedicated
local test environment; the worker revalidates the lane registry. No database
is reset by dev. Only the SDK-owned child receives shutdown signals.
In approved integration tests, attach the real Core drain engine with
attachPluginTaskDrain(), then import drainPluginTasks from this package.
The helper is NODE_ENV=test-only, requires includeFinalFailure:true and explicit
installationIds/deadlineMs, reports future work and UNKNOWN hooks, and refuses
to conceal unsettled invocations. advanceDueTo affects only the captured task
selection and never changes execution deadlines.

The current integration batch adds `ctx.commerce.products.getVariants({variantIds,locale})`
under the installation grant `commerce:products.read`. It returns published variant
ids, product ids/slugs, localized product titles, variant titles, currency, decimal
price strings and availability. Request only the ids needed; checkout remains the
authority for the final price and stock. A usage provider stores mappings to usage
amounts, not a separate currency-price database.

`ctx.customers.lookup({ids})` and `ctx.customers.search({query,afterId?,limit?})`
require `customers:read` and a live bound ADMIN principal. The minimal projection
contains `id`, `displayName`, `email`, `accountPath` and pagination. `accountPath`
is relative to the Core administrator locale; it is not a customer-facing link.
These reads alone do not implement action authorization for business mutations.
Declare plugin actions in `adminActions` and call `ctx.authorization.require(action)`;
Core requires both installation `actions:<action>` and an explicit administrator
action grant. No grant means denial. Operators can bootstrap the first policy
authority with the Core tool `scripts/plugin-action-policy-bootstrap.mjs`, supplying
an explicit database environment name, expected database and administrator id.
It defaults to dry-run, checks complete migration checksums and schema state, and
requires a separately authorized `--apply` for a write. It is not run automatically
by installation, and this integration session did not execute bootstrap.

Storage private `put/get/readUrl` remain principal-owned. `publish/unpublish/publicUrl`
add explicit image publication with 60-second revocable URLs. Publishing requires
`storage.publish` and an administrator-owned image; another authorized administrator
in the installation can unpublish it. Publication survives publisher logout/disable
until explicitly revoked or the installation becomes unavailable.
`retain/release` register explicit references; active references block `delete`.
`delete(reference,{idempotencyKey})` requires `storage.delete` and returns an operation
id; query `deletion(operationId)` until DELETED or FAILED. Cleanup uses existing
durable leases and recovery. DELETED covers only the verified absent active object
(`erasureScope: 'active-object'`), not historical S3 versions or backups. Plugin
ledger, financial, task and audit records are not cascade-deleted. Reuse Core account
disable and revocation instead of implementing a second authentication system.

These additions are source-level batch contracts until verification and external
package-consumer checks pass. Use the matching Core release's SDK tarball with its
recorded version, source revision and SHA256; do not treat a generated workspace
type or an unchanged package version as evidence that a release was delivered.
