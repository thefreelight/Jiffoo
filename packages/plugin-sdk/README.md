# @jiffoo-core/plugin-sdk

Extension authoring CLI and canonical Core types, version 1.0.0-alpha.1.
Supported runtime: Node.js >=24.13.1 <25, matching Core's Node 24 CI runtime.

Install the SDK tarball attached to the matching Core release:

```sh
npm i ./jiffoo-core-plugin-sdk-1.0.0-alpha.1.tgz
npx jiffoo-plugin create --slug my-extension --name "My extension" --output my-extension
```

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
