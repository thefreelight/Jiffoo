# AGENTRA-002 Pass 0B -- Plugin Subsystem Recon


## Coverage

- G4 is exhaustive for module-level plugin-derived state in `apps/api/src/core/admin/extension-installer`, `plugin-management`, `core/storage`, and API plugin modules under the stated source-only exclusions.
- J1's named function is absent; the requested per-branch behavior is therefore `UNVERIFIABLE_STATIC` rather than inferred from unrelated code.
- K1 found no installable in-tree plugin package manifest. The external demo is an example, not evidence of an installed plugin package.
- O1 identifies code that carries session identifiers; no configured server-side HTTP-session store was located by the stated search.

## G. Plugin loading and the gateway

### Q G1. Trace enabled plugin package to HTTP code.
- **Answer:** Fixed gateway ownership is `apps/api/src/core/admin/extension-installer/plugin-runtime.ts`. The path is: extension routes call `handlePluginGateway`; it resolves database-backed package/instance context; reads `manifest.json` from `pluginPackageStore`; `ensureInternalRuntime` loads/registers the plugin onto an internal Fastify app; `handlePluginGateway` calls `forwardToPlugin`, which calls `runtime.app.inject`.
- **Evidence:** apps/api/src/core/admin/extension-installer/routes.ts:178 `await handlePluginGateway(request, reply, '/', fastify);`
- **Evidence:** apps/api/src/core/admin/extension-installer/plugin-runtime.ts:245 `async function resolveGatewayContext(`
- **Evidence:** apps/api/src/core/admin/extension-installer/plugin-runtime.ts:183 `async function readPluginManifest(slug: string): Promise<PluginManifest> {`
- **Evidence:** apps/api/src/core/admin/extension-installer/plugin-runtime.ts:460 `async function ensureInternalRuntime(`
- **Evidence:** apps/api/src/core/admin/extension-installer/plugin-runtime.ts:734 `runtime.app.inject({`
- **Method:** Read `routes.ts`, `plugin-runtime.ts`, `plugin-module-loader.ts`, storage adapter, and searched all calls to `handlePluginGateway`, `ensureInternalRuntime`, and `inject(`.

### Q G2. How is the module loaded?
- **Answer:** `loadPluginEntryModule` chooses ESM dynamic import or CommonJS `createRequire`/require. CommonJS resolution is cache-invalidated when `bustCache` is true; ESM loading uses a file URL with cache-busting parameters.
- **Evidence:** apps/api/src/core/admin/extension-installer/plugin-module-loader.ts:3 `import { createRequire } from 'module';`
- **Evidence:** apps/api/src/core/admin/extension-installer/plugin-module-loader.ts:6 `const runtimeRequire = createRequire(__filename);`
- **Evidence:** apps/api/src/core/admin/extension-installer/plugin-module-loader.ts:68 `delete runtimeRequire.cache[resolvedPath];`
- **Evidence:** apps/api/src/core/admin/extension-installer/plugin-module-loader.ts:71 `return runtimeRequire(resolvedPath);`
- **Method:** Read entire module loader and all `loadPluginEntryModule` call sites.

### Q G3. How is isolated Fastify created/dispatched?
- **Answer:** The runtime imports Fastify, constructs an internal instance in `ensureInternalRuntime`, and dispatches through its `inject()` interface after gateway context resolution.
- **Evidence:** apps/api/src/core/admin/extension-installer/plugin-runtime.ts:19 `import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';`
- **Evidence:** apps/api/src/core/admin/extension-installer/plugin-runtime.ts:734 `runtime.app.inject({`
- **Method:** Searched plugin runtime for `Fastify(`, `FastifyInstance`, `register`, and `inject(`; read the enclosing runtime creation/forwarding functions.

### Q G4. What in-process plugin-derived state exists?
- **Answer:** `internalRuntimes` (installation ID to internal Fastify runtime); Contract V1 `services` and `eventHandlers`; gateway `breakerStore` and `rateLimitStore`; `loggedThemeExtensionWarnings`; singleton `pluginPackageStore`; singleton `gatewayMetrics`; and service/installer singletons. These are module-level state holders; database state is not counted as in-process state.
- **Evidence:** apps/api/src/core/admin/extension-installer/plugin-runtime.ts:161 `const internalRuntimes = new Map<string, InternalRuntime>();`
- **Evidence:** apps/api/src/core/admin/extension-installer/contract-v1-runtime.ts:43 `const services = new Map<string, unknown>();`
- **Evidence:** apps/api/src/core/admin/extension-installer/contract-v1-runtime.ts:45 `const eventHandlers = new Map<string, Map<string, Set<EventHandler>>>();`
- **Evidence:** apps/api/src/core/admin/extension-installer/gateway-protection.ts:107 `const breakerStore = new Map<string, BreakerEntry>();`
- **Evidence:** apps/api/src/core/admin/extension-installer/gateway-protection.ts:386 `const rateLimitStore = new Map<string, RateLimitEntry>();`
- **Evidence:** apps/api/src/core/admin/plugin-management/theme-extensions-service.ts:16 `const loggedThemeExtensionWarnings = new Set<string>();`
- **Evidence:** apps/api/src/core/storage/plugin-package-store.ts:113 `export const pluginPackageStore: PluginPackageStore = new LocalPluginPackageStore();`
- **Method:** Exhaustive targeted scan of `apps/api/src/core/admin/extension-installer`, `plugin-management`, `core/storage`, and `plugins` for module-level `Map`, `Set`, cache, singleton, `new`, and exported instance declarations.

## H. Reload, update, disable

### Q H1. What state is rebuilt per lifecycle action?
- **Answer:** Install/update paths warm an instance runtime after the database/package write; a changed manifest version or config causes `ensureInternalRuntime` to replace that installation's `internalRuntimes` entry. Uninstall clears the runtime entry and Contract V1 event handlers for the installation. Enable/disable database transitions increment the registry version, but no static evidence shows they clear gateway breaker/rate-limit maps, services, metrics, or warning Set. Lifecycle-hook timeout/error handling does not itself rebuild state.
- **Evidence:** apps/api/src/core/admin/extension-installer/plugin-fs-installer.ts:243 `await warmPluginInstanceRuntime(manifest.slug, instance.id);`
- **Evidence:** apps/api/src/core/admin/extension-installer/plugin-runtime.ts:623 `internalRuntimes.set(runtimeKey, newRuntime);`
- **Evidence:** apps/api/src/core/admin/extension-installer/plugin-runtime.ts:658 `internalRuntimes.delete(installationId);`
- **Evidence:** apps/api/src/core/admin/extension-installer/contract-v1-runtime.ts:55 `eventHandlers.delete(installationId);`
- **Method:** Read installer, management service, lifecycle hooks, runtime, Contract V1 runtime, and searched lifecycle verbs plus all G4 identifiers.

### Q H2. Module cache invalidation on same-package version update?
- **Answer:** Yes. The loader resolves the path and deletes the `runtimeRequire` cache entry when cache busting is requested; the runtime's version/config comparison causes recreation.
- **Evidence:** apps/api/src/core/admin/extension-installer/plugin-module-loader.ts:66 `const resolvedPath = runtimeRequire.resolve(absolutePath);`
- **Evidence:** apps/api/src/core/admin/extension-installer/plugin-module-loader.ts:68 `delete runtimeRequire.cache[resolvedPath];`
- **Evidence:** apps/api/src/core/admin/extension-installer/plugin-runtime.ts:479 `if (!configChanged && existing.manifest.version === manifest.version) {`
- **Method:** Read module loader and runtime update branch; searched `require.cache`, `delete`, `bustCache`, version, and installed timestamps.

### Q H3. Does disable stop plugin timers/listeners/handles?
- **Answer:** Static lifecycle code clears runtime entry and Contract V1 event handlers on teardown; no code was found that invokes plugin-provided timer/listener/handle cleanup or closes plugin-owned handles.
- **Evidence:** apps/api/src/core/admin/extension-installer/plugin-runtime.ts:658 `internalRuntimes.delete(installationId);`
- **Evidence:** apps/api/src/core/admin/extension-installer/contract-v1-runtime.ts:55 `eventHandlers.delete(installationId);`
- **Method:** Searched lifecycle/installer/runtime source for `disable`, `close`, `dispose`, `destroy`, `clearInterval`, `clearTimeout`, `removeListener`, `off`, and `onClose`.

### Q H4. Plugin registry version increments and reads?
- **Answer:** Increment helper uses `systemSettings.upsert`. Call sites are in plugin management (lines 334, 381, 492, 557), filesystem installer (280, 378, 413), and bundle installer (254, 280). The displayed management/installer sites pass a transaction client (`tx`), so the helper is executed in that transaction callback. Registry-version reads were not located in source search.
- **Evidence:** apps/api/src/core/admin/extension-installer/plugin-registry-version.ts:1 `export async function incrementPluginRegistryVersion(client: any): Promise<void> {`
- **Evidence:** apps/api/src/core/admin/extension-installer/plugin-registry-version.ts:5 `update: { pluginRegistryVersion: { increment: 1 } },`
- **Evidence:** apps/api/src/core/admin/plugin-management/service.ts:334 `await incrementPluginRegistryVersion(tx);`
- **Evidence:** apps/api/src/core/admin/extension-installer/plugin-fs-installer.ts:280 `await incrementPluginRegistryVersion(tx);`
- **Evidence:** apps/api/src/core/admin/extension-installer/bundle-installer.ts:254 `if (enabled !== existingInstance.enabled) await incrementPluginRegistryVersion(tx);`
- **Method:** Searched all source for `incrementPluginRegistryVersion` and `pluginRegistryVersion`, then inspected containing transaction blocks.

## I. Failure containment

### Q I1. Are plugin invocations bounded?
- **Answer:** Gateway `inject()` is wrapped by a 30-second `Promise.race`; lifecycle hooks use a timeout race; Contract V1 event dispatch uses `Promise.all` without a local try/catch at the dispatch point. Gateway metrics recording has a best-effort catch.
- **Evidence:** apps/api/src/core/admin/extension-installer/plugin-runtime.ts:723 `const timeoutPromise = new Promise<never>((_, reject) => {`
- **Evidence:** apps/api/src/core/admin/extension-installer/plugin-runtime.ts:733 `const res = await Promise.race([`
- **Evidence:** apps/api/src/core/admin/plugin-management/lifecycle-hooks.ts:50 `new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`Lifecycle hook ${hookName} timed out after ${LIFECYCLE_TIMEOUT_MS}ms`)), LIFECYCLE_TIMEOUT_MS)),`
- **Evidence:** apps/api/src/core/admin/extension-installer/contract-v1-runtime.ts:51 `await Promise.all([...handlers].map((handler) => handler(payload)));`
- **Method:** Searched plugin runtime/lifecycle/event sources for `try`, `catch`, `Promise.race`, `timeout`, and invocation calls.

### Q I2. Process-level fatal handlers?
- **Answer:** `UNVERIFIABLE_STATIC`: no `uncaughtException` or `unhandledRejection` registration was found in source search.
- **Evidence:** apps/api/src/server.ts:1 `import 'dotenv/config';`
- **Method:** Exact search over `apps`, `packages`, `examples`, and `scripts` for `uncaughtException`, `unhandledRejection`, and `process.on(`, excluding `dist`, `.next`, `node_modules`, and generated clients.

### Q I3. Plugin-call timeout?
- **Answer:** Yes. Fixed gateway timeout is 30,000ms; lifecycle hooks have a timeout; protection module declares configurable gateway timeout default 10,000ms.
- **Evidence:** apps/api/src/core/admin/extension-installer/plugin-runtime.ts:55 `const REQUEST_TIMEOUT_MS = 30000;`
- **Evidence:** apps/api/src/core/admin/extension-installer/plugin-runtime.ts:726 ``Plugin "${slug}" request timeout (${REQUEST_TIMEOUT_MS}ms)` ``
- **Evidence:** apps/api/src/core/admin/extension-installer/gateway-protection.ts:22 `export const DEFAULT_GATEWAY_TIMEOUT_MS = 10_000;`
- **Method:** Searched plugin gateway/runtime/lifecycle modules for `timeout`, `AbortController`, `Promise.race`, and `setTimeout`.

## J. Plugin database access

### Q J1. `ensurePluginDatabaseEnv` behavior?
- **Answer:** `UNVERIFIABLE_STATIC`: no `ensurePluginDatabaseEnv` or `plugin-db-url.ts` exists in the scanned source. Therefore no static basis exists to assert trigger condition, schema derivation, write target, or install/runtime application.
- **Evidence:** apps/api/src/core/admin/extension-installer/contract-v1-runtime.ts:83 `export async function runContractV1Migrations(`
- **Method:** Exact search across `apps/api/src`, `apps/api/prisma`, `packages`, `plugins`, and `examples` for `ensurePluginDatabaseEnv`, `plugin-db-url`, `DATABASE_URL`, datasource, and schema.
- **Notes:** The named-file premise is contradicted by the source tree.

### Q J2. Does Core execute plugin `.sql` migrations?
- **Answer:** Core executes `ContractV1Runtime.migrations` SQL strings with `tx.$executeRawUnsafe(migration.sql)`. The shown code does not set `search_path`, wrap SQL, or require qualified names.
- **Evidence:** apps/api/src/core/admin/extension-installer/contract-v1-runtime.ts:108 `await tx.$executeRawUnsafe(migration.sql);`
- **Evidence:** apps/api/src/core/admin/extension-installer/contract-v1-runtime.ts:101 `await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))', slug);`
- **Method:** Searched extension runtime/installer and Prisma source for `.sql`, `migration`, `$executeRaw`, `$queryRaw`, and `search_path`; read the migration function.

### Q J3. Plugin migration ledger?
- **Answer:** Yes: `plugin_runtime_migrations`, separate from Prisma's ledger. Columns are `plugin_slug`, `migration_id`, `checksum`, `applied_at`; primary key is `(plugin_slug, migration_id)`. Write site is the INSERT in `runContractV1Migrations`; table creation is in `ensureMigrationLedger`.
- **Evidence:** apps/api/src/core/admin/extension-installer/contract-v1-runtime.ts:65 `CREATE TABLE IF NOT EXISTS plugin_runtime_migrations (`
- **Evidence:** apps/api/src/core/admin/extension-installer/contract-v1-runtime.ts:70 `applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),`
- **Evidence:** apps/api/src/core/admin/extension-installer/contract-v1-runtime.ts:109 `await tx.$executeRawUnsafe(`
- **Method:** Exact search for `plugin_runtime_migrations`, `migration ledger`, `INSERT INTO`, and `CREATE TABLE` in source and migrations.

### Q J4. SHA-256 migration-file manifest verification?
- **Answer:** No manifest-file SHA-256 verification was found before Contract V1 migration execution. Contract V1 calculates a SHA-256 checksum of the SQL string for its ledger comparison, which is distinct from verification against package manifest bytes.
- **Evidence:** apps/api/src/core/admin/extension-installer/contract-v1-runtime.ts:59 `return createHash('sha256').update(sql).digest('hex');`
- **Evidence:** apps/api/src/core/admin/extension-installer/contract-v1-runtime.ts:93 `const expectedChecksum = checksum(migration.sql);`
- **Method:** Searched extension/installer/package source for `migration`, `sha256`, `manifest`, `verifyFileIntegrity`, `createHash`, and `.sql`.

## K. In-tree plugins

### Q K1. Plugin packages in tree?
- **Answer:** No in-tree installable plugin package (manifest plus plugin package directory) was found. `plugins/core/types` is type-only; `examples/external-plugin-demo` is an Express example that declares inline capabilities and has no discovered `manifest.json`, `schema.prisma`, `PrismaClient`, or `.sql` migrations.
- **Evidence:** plugins/core/types/index.ts:6 `export * from './payment';`
- **Evidence:** examples/external-plugin-demo/src/index.ts:93 `capabilities: ['demo-feature', 'sample-api'],`
- **Method:** Enumerated `plugins` and `examples` for `package.json`, `manifest.json`, `schema.prisma`, `*.sql`, and searched for `PrismaClient`, datasource, and capabilities.

### Q K2. PrismaClient singleton/disconnect for in-tree plugins?
- **Answer:** Not applicable: no in-tree plugin instantiates `PrismaClient` in the scanned tree.
- **Evidence:** examples/external-plugin-demo/src/index.ts:1 `import express from 'express';`
- **Method:** Exact search under `plugins` and `examples` for `PrismaClient`, `$disconnect`, `disable`, and `update`.

## L. Capability contracts and events

### Q L1. Five capability contracts?
- **Answer:** Payment contract type EXISTS in `contract-v1-runtime.ts` as internal `PaymentDriver`; shipping, tax, fulfillment, and notification contract types DO NOT EXIST in the scanned plugin runtime/SDK source.
- **Evidence:** apps/api/src/core/admin/extension-installer/contract-v1-runtime.ts:18 `type PaymentDriver = {`
- **Evidence:** plugins/core/types/index.ts:6 `export * from './payment';`
- **Method:** Searched `apps/api/src`, `packages/plugin-sdk`, `plugins`, and examples for exported/interface/type names containing payment, shipping, tax, fulfillment, and notification plus `Contract`/`Provider`.

### Q L2. Payment flow to state transition?
- **Answer:** Checkout payment route posts create-session, forwards to plugin gateway, persists session data, and verify route calls `syncPaymentFromPlugin`; Contract V1 payment webhook calls `applyNormalizedPluginWebhook`. The exact external provider callback is plugin-defined and absent from Core source.
- **Evidence:** apps/api/src/core/payment/routes.ts:219 `fastify.post('/create-session', {`
- **Evidence:** apps/api/src/core/payment/routes.ts:313 `path: '/api/payments/create-session?installation=default',`
- **Evidence:** apps/api/src/core/payment/routes.ts:359 `sessionId: session.sessionId as string,`
- **Evidence:** apps/api/src/core/payment/routes.ts:430 `fastify.get('/verify/:sessionId', {`
- **Evidence:** apps/api/src/core/payment/routes.ts:440 `await syncPaymentFromPlugin(sessionId);`
- **Evidence:** apps/api/src/core/admin/extension-installer/contract-v1-runtime.ts:160 `await applyNormalizedPluginWebhook(pluginSlug, result as Record<string, unknown>);`
- **Method:** Read payment routes, plugin gateway, reconciliation, webhook normalizer, and Contract V1 driver routes; searched `create-session`, `verify`, `webhook`, and order-paid state calls.

### Q L3. Event publication/subscription layer?
- **Answer:** Contract V1 has in-process subscription storage keyed by installation/event type and dispatches with `Promise.all`. Jobs dispatch plugin runtime events. The context `publish` function is a no-op. Retry/idempotency machinery is present for webhooks/payment paths, but no generic plugin event retry/idempotency mechanism was found.
- **Evidence:** apps/api/src/core/admin/extension-installer/contract-v1-runtime.ts:45 `const eventHandlers = new Map<string, Map<string, Set<EventHandler>>>();`
- **Evidence:** apps/api/src/core/admin/extension-installer/contract-v1-runtime.ts:51 `await Promise.all([...handlers].map((handler) => handler(payload)));`
- **Evidence:** apps/api/src/infra/jobs/handlers.ts:21 `await dispatchPluginRuntimeEvent(eventType, event.payload);`
- **Evidence:** apps/api/src/core/admin/extension-installer/contract-v1-runtime.ts:181 `publish: async () => undefined,`
- **Method:** Searched plugin/runtime/jobs/webhook source for `eventType`, `dispatch`, `publish`, `subscribe`, `retry`, and `idempotency`.

## M. Package verification and signing

### Q M1. Package signature verification?
- **Answer:** Yes: signature verifier calculates ZIP SHA-256 and verifies an Ed25519 signature; manifest signature helpers and file-integrity utilities also exist.
- **Evidence:** apps/api/src/core/admin/extension-installer/signature-verifier.ts:96 `const zipHash = createHash('sha256').update(zipBuffer).digest();`
- **Evidence:** apps/api/src/core/admin/extension-installer/signature-verifier.ts:117 `const isValid = cryptoVerify(`
- **Method:** Searched installer, SDK, and API source for `signature`, `verify`, `cryptoVerify`, and `sha256`.

### Q M2. Verification trust root?
- **Answer:** The official PEM key is read from `apps/api/src/core/admin/extension-installer/keys/official.pub`; additional trusted keys are sourced from environment configuration in `signature.ts`. Verification mode derives from `EXTENSION_SIGNATURE_VERIFY` and may be required/optional/disabled.
- **Evidence:** apps/api/src/core/admin/extension-installer/signature-verifier.ts:71 `const keyPath = path.join(KEYS_DIR, 'official.pub');`
- **Evidence:** apps/api/src/core/admin/extension-installer/signature-verifier.ts:86 `const mode = process.env.EXTENSION_SIGNATURE_VERIFY || 'optional';`
- **Evidence:** apps/api/src/core/admin/extension-installer/signature.ts:98 `// 2. Extra trusted keys from environment variable`
- **Method:** Read signature modules and searched key-load/env access paths.

### Q M3. SHA-256 verification of uploaded/downloaded package bytes?
- **Answer:** Yes for ZIP signature verification: a SHA-256 digest of the ZIP buffer/file is the verified data. Generic file integrity also compares SHA-256 in `verifyFileIntegrity`.
- **Evidence:** apps/api/src/core/admin/extension-installer/signature-verifier.ts:206 `const hash = createHash('sha256');`
- **Evidence:** apps/api/src/core/admin/extension-installer/signature.ts:255 `const actualHash = createHash('sha256').update(fileBuffer).digest('hex');`
- **Method:** Searched package installer and signature modules for ZIP reads, hash creation, and integrity comparison.

## N. OpenAPI and route registration

### Q N1. OpenAPI mechanism?
- **Answer:** `apps/api/openapi.json` is generated by `apps/api/scripts/export-openapi.ts`, which builds the app then writes Fastify's OpenAPI output. Tests load that file and skip selected checks when it is absent; it is not treated as hand-maintained.
- **Evidence:** apps/api/package.json:49 `"export:openapi": "tsx scripts/export-openapi.ts"`
- **Evidence:** apps/api/scripts/export-openapi.ts:72 `const outputPath = path.join(process.cwd(), 'openapi.json');`
- **Evidence:** apps/api/tests/helpers/openapi.ts:16 `const openapiPath = path.resolve(__dirname, '../../openapi.json');`
- **Method:** Read API scripts/tests/package manifest and searched `openapi.json`, swagger, and export script references.

### Q N2. API route registration mechanism?
- **Answer:** It is explicit Fastify registration. `server.ts` calls `registerRoutes`; `routes/index.ts` registers module route plugins with prefixes; `routes/v1/index.ts` is a parallel versioned registration surface. A programmatic enumerator should start at these two files and recursively inspect each registered route module's `fastify.get/post/route` calls.
- **Evidence:** apps/api/src/server.ts:448 `await registerRoutes(fastify);`
- **Evidence:** apps/api/src/routes/index.ts:64 `export async function registerRoutes(fastify: FastifyInstance) {`
- **Evidence:** apps/api/src/routes/index.ts:128 `await fastify.register(extensionInstallerRoutes, { prefix: '/api/extensions' });`
- **Evidence:** apps/api/src/routes/v1/index.ts:79 `await fastify.register(extensionInstallerRoutes, { prefix: '/extensions' });`
- **Method:** Searched API source for `registerRoutes`, `fastify.register`, and route files; read server and both registration indexes.

## O. State externalization

### Q O1. Session-state storage?
- **Answer:** No configured HTTP session store was found. Payment session identifiers/URLs are persisted through Prisma payment records; session-like client data is not enough to assert a server session subsystem.
- **Evidence:** apps/api/src/core/payment/routes.ts:359 `sessionId: session.sessionId as string,`
- **Evidence:** apps/api/src/core/payment/reconciliation.ts:18 `const payment = await prisma.payment.findFirst({ where: { sessionId } });`
- **Method:** Searched API source/config for `session`, `Session`, `express-session`, `@fastify/session`, store configuration, Redis session, cookie session, and Prisma session models.

### Q O2. Scheduled/background jobs and locks?
- **Answer:** Static registrations include BullMQ queue/worker infrastructure, outbox poller interval, inventory forecasting cron, stock-alert cron, external-order polling timer, payment reconciliation, backup-health, and market update checker. Contract V1 migrations take PostgreSQL advisory transaction lock; no generic per-job lock was identified. The updater has a filesystem upgrade lock, separate from API jobs.
- **Evidence:** apps/api/src/infra/jobs/index.ts:44 `export async function startJobInfrastructure(): Promise<void> {`
- **Evidence:** apps/api/src/infra/jobs/outbox-poller.ts:47 `this.interval = setInterval(() => {`
- **Evidence:** apps/api/src/core/inventory/forecasting/worker.ts:73 `cron: '0 2 * * *', // Daily at 2:00 AM`
- **Evidence:** apps/api/src/core/stock-alert/jobs.ts:61 `cron: '0 * * * *', // Every hour at minute 0`
- **Evidence:** apps/api/src/core/external-orders/polling-worker.ts:102 `this.timer = setTimeout(() => {`
- **Evidence:** apps/api/src/core/admin/extension-installer/contract-v1-runtime.ts:101 `await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))', slug);`
- **Evidence:** scripts/jiffoo-updater.mjs:585 `async function acquireUpgradeLock(workspaceDir, statusFile, targetVersion) {`
- **Method:** Searched API/server/jobs/core and scripts for `startJobInfrastructure`, `new Queue`, `new Worker`, `cron`, `setInterval`, `setTimeout`, `schedule`, `lock`, and `acquire`.
