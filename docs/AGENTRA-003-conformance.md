# AGENTRA-003: Charter Conformance Diff


## Coverage

Static source and configuration only were inspected. `dist/`, `.next/`,
`node_modules/`, and generated Prisma clients were excluded. The exact runtime
outcome of checkout, package execution, database migration, updater execution,
and Shop rendering is `UNVERIFIABLE_STATIC`; a running instance with request,
database, and process observations would settle each such outcome. `openapi.json`
is treated as intent only. The requested C1 route inventory is incomplete at
individual-operation granularity because route handlers compose paths through
Fastify registrations; a route-table dump from a started Fastify instance would
settle every final method/path pair.

## Summary

| id | promise | verdict |
| --- | --- | --- |
| C-4-1 | §4 single merchant/storefront | CONTRADICTS |
| C-4-5 | §4 Core payment contract only | CONTRADICTS |
| C-4-7 | §4 themes are presentation data only | CONTRADICTS |
| C-4-8 | §4 imagic outside Core | CONTRADICTS |
| C-7-1 | Cloudflare Worker outside V1 | CONTRADICTS |
| C-7-2 | Kubernetes updater outside V1 | CONTRADICTS |
| C-7-3 | external plugin demo outside V1 | CONTRADICTS |
| C-7-4 | multi-store outside V1 | CONTRADICTS |
| C-7-5 | legacy executable Shop themes outside V1 | CONTRADICTS |
| C-7-6 | imagic-studio outside Core | CONTRADICTS |
| C2 | no remaining multi-store/platform concepts | CONTRADICTS |
| S5 | tax contract in order total | ABSENT |
| S14 | tracking and custom code placement/audit | ABSENT |
| B1-shipping | Core-owned shipping contract and call site | ABSENT |
| B1-tax | Core-owned tax contract and call site | ABSENT |
| B1-fulfillment | Core-owned fulfillment contract and call site | ABSENT |
| B1-notification | Core-owned notification contract and call site | ABSENT |
| B2-manual-payment | builtin manual payment | ABSENT |
| B2-zero-tax | builtin zero tax | ABSENT |
| B2-console-email | builtin console email | ABSENT |
| B6 | manifest SHA-256 migration verification | ABSENT |
| B7 | package-derived migration schema | ABSENT |
| B8 | tracking/custom-code storage and placement | ABSENT |
| S1 | disconnected baseline order | PARTIAL |
| S3 | signed payment extension flow | PARTIAL |
| S6 | retried idempotent event subscription | PARTIAL |
| S7 | declarative Shop and Admin themes | PARTIAL |
| S8 | disable removes all extension effects | PARTIAL |
| S10 | migration update audit and no rollback | PARTIAL |
| S12 | storage-only paths and no request state | PARTIAL |
| S13 | SDK scaffold, development, pack, sign | PARTIAL |
| S15 | state-container lifecycle audit | PARTIAL |
| S16 | unhandled plugin error containment | PARTIAL |
| B2-free-shipping | builtin free shipping | PARTIAL |
| B2-manual-fulfillment | builtin manual fulfillment | PARTIAL |
| B3 | generated Core-native extension settings | PARTIAL |
| B4 | failure containment | PARTIAL |
| B5 | plugin-derived state consistency | PARTIAL |
| B9 | declarative runtime theme path | PARTIAL |
| B10 | event retry and idempotency | PARTIAL |
| B11 | SDK scaffold, development, packaging, signing | PARTIAL |
| B12 | Core update safety flow | PARTIAL |
| B13 | dependency-tree module invalidation | PARTIAL |
| B14 | CommonJS and native-module enforcement | PARTIAL |
| C-4-2 | §4 identical package execution rights | PARTIAL |
| C-4-6 | §4 merchant-only browser injection | PARTIAL |
| C-4-9 | §4 auditable lifecycle actions | PARTIAL |
| C-7-7 | market connection OpenAPI entry outside V1 | PARTIAL |
| C1 | OpenAPI and registered-route two-way diff | PARTIAL |
| S9 | no-migration Core update rollback | UNVERIFIABLE_STATIC |
| S11 | release verification suites | UNVERIFIABLE_STATIC |
| S2 | unavailable index leaves upload | PRESENT |
| S4 | unsigned upload confirmation | PRESENT |
| B1-payment | Core-owned payment contract and call site | PRESENT |
| C-4-3 | §4 unsigned confirmation/audit | PRESENT |
| C-4-4 | §4 no plugin DB permission boundary | PRESENT |

## Part A — Acceptance Scenarios

### S1. Disconnected installation completes a baseline order
- **Charter location:** §5 scenario 1
- **Required artifact:** Checkout/order call path and builtins for all baseline behaviours.
- **Verdict:** PARTIAL
- **Evidence:** apps/api/src/core/payment/routes.ts:313 `path: '/api/payments/create-session?installation=default',`
- **Evidence:** apps/api/src/core/payment/routes.ts:345 `return sendError(reply, 502, 'PAYMENT_PLUGIN_INVALID_RESPONSE'`
- **Method:** Searched `apps/api/src`, `apps/shop`, and `packages` for `manual payment`, `create-session`, `free shipping`, `zero tax`, `manual fulfillment`, and `console email`.
- **Notes:** The checkout path forwards to a plugin and returns an error for an invalid plugin response; no manual-payment builtin was found.

### S2. Unavailable marketplace browsing does not prevent local upload
- **Charter location:** §5 scenario 2
- **Required artifact:** Independent upload route and marketplace client route.
- **Verdict:** PRESENT
- **Evidence:** apps/api/src/core/admin/extension-installer/routes.ts:109 `fastify.post('/upload',`
- **Evidence:** apps/api/src/core/admin/market/routes.ts:34 `fastify.get('/health',`
- **Method:** Searched extension-installer and market route files for `upload`, `market`, `catalog`, and Fastify registrations.

### S3. Signed extension installs, configures, enables, and completes payment
- **Charter location:** §5 scenario 3
- **Required artifact:** ZIP signature check, settings/enable route, gateway call, payment reconciliation.
- **Verdict:** PARTIAL
- **Evidence:** apps/api/src/core/admin/extension-installer/signature-verifier.ts:117 `const isValid = cryptoVerify(`
- **Evidence:** apps/api/src/core/admin/extension-installer/plugin-runtime.ts:734 `runtime.app.inject({`
- **Evidence:** apps/api/src/core/payment/routes.ts:440 `await syncPaymentFromPlugin(sessionId);`
- **Method:** Searched installer, plugin runtime, plugin management, and payment source for `signature`, `enable`, `inject`, `create-session`, and `syncPaymentFromPlugin`.
- **Notes:** Signature, gateway, and reconciliation call sites exist; static reading cannot demonstrate the required end-to-end provider callback and order transition.

### S4. Unsigned extension warning, confirmation, audit, and installation
- **Charter location:** §5 scenario 4
- **Required artifact:** Unsigned confirmation validation and audit write before installation.
- **Verdict:** PRESENT
- **Evidence:** apps/api/src/core/admin/extension-installer/plugin-fs-installer.ts:371 `if (trustLevel === 'unsigned' && !options?.confirmUnsigned) {`
- **Evidence:** apps/api/src/core/admin/extension-installer/plugin-fs-installer.ts:403 `event: 'plugin_unsigned_install_confirmed',`
- **Method:** Searched extension installer source for `unsigned`, `confirmUnsigned`, `confirmation`, and `audit`.

### S5. Tax contract participates before order placement
- **Charter location:** §5 scenario 5
- **Required artifact:** Tax contract type and checkout invocation that writes the resulting total.
- **Verdict:** ABSENT
- **Evidence:** apps/api/src/core/admin/extension-installer/contract-v1-runtime.ts:223 `if (kind === 'payment') registerPaymentDriver(app, driver, options.slug);`
- **Method:** Exact-symbol search for `TaxContract`, `TaxDriver`, `registerTax`, `calculateTax`, and `tax plugin` in `apps/api/src`, `packages/plugin-sdk`, `plugins`, and `examples`.

### S6. Retried, idempotent `order.created` subscriber
- **Charter location:** §5 scenario 6
- **Required artifact:** `order.created` publication, subscriber registration, retry, and idempotency record.
- **Verdict:** PARTIAL
- **Evidence:** apps/api/src/infra/jobs/handlers.ts:21 `await dispatchPluginRuntimeEvent(eventType, event.payload);`
- **Evidence:** apps/api/src/core/admin/extension-installer/contract-v1-runtime.ts:51 `await Promise.all([...handlers].map((handler) => handler(payload)));`
- **Method:** Searched plugin runtime, jobs, webhooks, and order code for `order.created`, `subscribe`, `dispatch`, `retry`, and `idempotency`.
- **Notes:** Subscriber dispatch exists, but no generic retry or idempotency mechanism for Contract V1 event handlers was found.

### S7. Declarative Shop/Admin themes validate, render, and revert
- **Charter location:** §5 scenario 7
- **Required artifact:** Declarative validator, runtime API reader, activation/revert implementation for both targets.
- **Verdict:** PARTIAL
- **Evidence:** apps/api/src/core/admin/theme-management/service.ts:19 `// Current @jiffoo/theme-api-sdk version (single source of truth)`
- **Evidence:** apps/api/src/core/admin/extension-installer/theme-app-installer.ts:1 `import {`
- **Method:** Searched theme installer/management, Shop/Admin runtime, and `packages/shop-themes` for `theme.json`, `validate`, `activate`, `revert`, `runtime`, and `theme-app`.
- **Notes:** Theme App installer/runtime remains present, directly conflicting with the required declarative-only condition.

### S8. Disabled extension has no presentation, calls, webhooks, or jobs
- **Charter location:** §5 scenario 8
- **Required artifact:** Disable state check at every gateway, webhook, UI, and background entry point.
- **Verdict:** PARTIAL
- **Evidence:** apps/api/src/core/admin/plugin-management/service.ts:379 `await teardownPluginRuntime(existing.id);`
- **Evidence:** apps/api/src/core/admin/extension-installer/plugin-runtime.ts:658 `internalRuntimes.delete(installationId);`
- **Method:** Searched plugin lifecycle, gateway, webhook subscription, theme-extension, and jobs source for `disable`, `enabled`, `teardown`, `unsubscribe`, and `delete`.
- **Notes:** Runtime teardown exists; no static evidence established all declared surfaces, especially plugin-owned handles and every background path.

### S9. No-migration update validates and preserves restorable prior version
- **Charter location:** §5 scenario 9
- **Required artifact:** Update manifest validation, health check, and rollback branch conditioned on no migration.
- **Verdict:** UNVERIFIABLE_STATIC
- **Evidence:** scripts/jiffoo-updater.mjs:980 `currentStep: 'Restored previous healthy release',`
- **Method:** Searched `scripts`, update routes/services, and compose files for `manifest`, `migration`, `health`, `rollback`, and `restore`.
- **Notes:** Execution records and a post-update filesystem/database observation are required to establish the stated flow.

### S10. Migration update audits ledgers and disables rollback
- **Charter location:** §5 scenario 10
- **Required artifact:** Core/plugin manifest audit before write and migration-aware rollback prohibition.
- **Verdict:** PARTIAL
- **Evidence:** apps/api/src/core/admin/extension-installer/contract-v1-runtime.ts:93 `const expectedChecksum = checksum(migration.sql);`
- **Evidence:** apps/api/src/core/upgrade/service.ts:646 `if (migrationApplied) {`
- **Method:** Searched update, installer, Prisma migration, and scripts for `migration`, `sha256`, `manifest`, `rollback`, and `backup`.
- **Notes:** Plugin migration checks compare SQL content to a prior ledger, not each migration file to the installed package manifest SHA-256.

### S11. Release-commit verification suites pass
- **Charter location:** §5 scenario 11
- **Required artifact:** Executed verification results for API, Admin, Shop, shared, and contract checks.
- **Verdict:** UNVERIFIABLE_STATIC
- **Evidence:** package.json:29 `"test": "turbo test",`
- **Method:** Read workspace scripts and searched test configuration for API, Admin, Shop, shared, and extension-contract suites.
- **Notes:** Source identifies suites but cannot establish that they pass for a particular commit.

### S12. Storage abstraction only; no request-scoped process state
- **Charter location:** §5 scenario 12
- **Required artifact:** Plugin package/file access exclusively through storage interfaces and no mutable request-scoped globals.
- **Verdict:** PARTIAL
- **Evidence:** apps/api/src/core/storage/plugin-package-store.ts:113 `export const pluginPackageStore: PluginPackageStore = new LocalPluginPackageStore();`
- **Evidence:** apps/api/src/core/admin/extension-installer/plugin-runtime.ts:161 `const internalRuntimes = new Map<string, InternalRuntime>();`
- **Method:** Searched `apps/api/src` for `pluginPackageStore`, filesystem path resolution, module-level `Map`, `Set`, cache, and request state.
- **Notes:** The storage abstraction exists; static reading cannot prove that no request-scoped state is held anywhere.

### S13. SDK scaffolds, develops, packages, signs, and installs
- **Charter location:** §5 scenario 13
- **Required artifact:** SDK init, local-development command, package/sign command, and upload-compatible output.
- **Verdict:** PARTIAL
- **Evidence:** packages/plugin-sdk/src/cli/commands/init.ts:1 `import fs from 'fs';`
- **Evidence:** packages/plugin-sdk/src/cli/commands/pack.ts:168 `return crypto.createHash('sha256').update(content).digest('hex');`
- **Method:** Searched `packages/plugin-sdk` for `init`, `dev`, `pack`, `sign`, `zip`, and installer-compatible manifest references.
- **Notes:** Scaffold and packaging source exist; no local-development mode was found as a production Core execution path.

### S14. Merchant tracking/custom code placements and audit
- **Charter location:** §5 scenario 14
- **Required artifact:** Admin storage, audit, Shop/confirmation render slots, and payment-form exclusion.
- **Verdict:** ABSENT
- **Evidence:** apps/api/src/core/admin/system-settings/routes.ts:1 `import { FastifyInstance } from 'fastify';`
- **Method:** Exact searches for `tracking provider`, `trackingId`, `customCode`, `document head`, `body start`, `body end`, `order confirmation`, and `payment form` in API/Admin/Shop/theme source and Prisma schema.

### S15. Every plugin-derived container accounted for on every lifecycle action
- **Charter location:** §5 scenario 15
- **Required artifact:** A maintained container-by-action audit and lifecycle clear/rebuild calls.
- **Verdict:** PARTIAL
- **Evidence:** apps/api/src/core/admin/extension-installer/gateway-protection.ts:107 `const breakerStore = new Map<string, BreakerEntry>();`
- **Evidence:** apps/api/src/core/admin/extension-installer/gateway-protection.ts:386 `const rateLimitStore = new Map<string, RateLimitEntry>();`
- **Method:** Searched extension installer, plugin management, storage, and plugin source for module-level `Map`, `Set`, singleton, cache, `install`, `enable`, `disable`, `update`, and teardown calls.
- **Notes:** No source audit matrix was found, and no teardown call was found for breaker/rate-limit stores.

### S16. Unhandled asynchronous plugin error does not terminate Core
- **Charter location:** §5 scenario 16
- **Required artifact:** Process handlers that attribute plugin errors and keep serving.
- **Verdict:** PARTIAL
- **Evidence:** apps/api/src/core/admin/extension-installer/plugin-runtime.ts:733 `const res = await Promise.race([`
- **Evidence:** apps/api/src/server.ts:48 `const fastify = Fastify({`
- **Method:** Exact search in `apps`, `packages`, `examples`, and `scripts` for `uncaughtException`, `unhandledRejection`, `process.on(`, gateway error boundaries, and lifecycle/event catches.
- **Notes:** Gateway timeout exists; no process-level uncaught-exception or unhandled-rejection registration was found.

## Part B — Charter Promises With No Acceptance Scenario

### B1-payment. Payment is a Core-owned, versioned contract with a call site
- **Charter location:** §3 Extension Center and Execution
- **Required artifact:** Contract type and checkout registration/invocation.
- **Verdict:** PRESENT
- **Evidence:** apps/api/src/core/admin/extension-installer/contract-v1-runtime.ts:19 `type PaymentDriver = {`
- **Evidence:** apps/api/src/core/payment/routes.ts:313 `path: '/api/payments/create-session?installation=default',`
- **Method:** Searched contract runtime, SDK, payment routes, and plugin runtime for payment contract types and gateway calls.

### B1-shipping. Shipping contract with a call site
- **Charter location:** §3 Extension Center and Execution
- **Required artifact:** Shipping contract type and Core invocation.
- **Verdict:** ABSENT
- **Evidence:** apps/api/src/core/admin/extension-installer/contract-v1-runtime.ts:223 `if (kind === 'payment') registerPaymentDriver(app, driver, options.slug);`
- **Method:** Exact-symbol search for `ShippingContract`, `ShippingDriver`, `registerShipping`, and `shipping provider` in API, SDK, plugins, and examples.

### B1-tax. Tax contract with a call site
- **Charter location:** §3 Extension Center and Execution
- **Required artifact:** Tax contract type and checkout invocation.
- **Verdict:** ABSENT
- **Evidence:** apps/api/src/core/cart/schemas.ts:66 `tax: { type: 'number', description: 'Tax amount' },`
- **Method:** Exact-symbol search for `TaxContract`, `TaxDriver`, `registerTax`, and `calculateTax` in API, SDK, plugins, and examples.

### B1-fulfillment. Fulfillment contract with a call site
- **Charter location:** §3 Extension Center and Execution
- **Required artifact:** Fulfillment contract type and Core invocation.
- **Verdict:** ABSENT
- **Evidence:** apps/api/src/core/order/schemas.ts:58 `description: 'Fulfillment status',`
- **Method:** Exact-symbol search for `FulfillmentContract`, `FulfillmentDriver`, `registerFulfillment`, and `fulfillment provider` in API, SDK, plugins, and examples.

### B1-notification. Notification contract with a call site
- **Charter location:** §3 Extension Center and Execution
- **Required artifact:** Notification contract type and Core invocation.
- **Verdict:** ABSENT
- **Evidence:** apps/api/src/core/notification/push-notification.service.ts:43 `export class PushNotificationService {`
- **Method:** Exact-symbol search for `NotificationContract`, `NotificationDriver`, `registerNotification`, and plugin notification dispatch in API, SDK, plugins, and examples.

### B2-manual-payment. Builtin manual payment without an extension
- **Charter location:** §2 Initial Store Operation
- **Required artifact:** Builtin payment implementation reached by checkout.
- **Verdict:** ABSENT
- **Evidence:** apps/api/src/core/payment/routes.ts:313 `path: '/api/payments/create-session?installation=default',`
- **Method:** Searched API/Shop/SDK source for `manual payment`, `manualPayment`, `manual-payment`, and payment-provider builtin registrations.

### B2-free-shipping. Builtin free shipping without an extension
- **Charter location:** §2 Initial Store Operation
- **Required artifact:** Checkout shipping calculation with a zero-cost builtin.
- **Verdict:** PARTIAL
- **Evidence:** apps/api/src/core/discount/engine.ts:307 `private static calculateFreeShippingDiscount(cart: Cart): number {`
- **Method:** Searched API/Shop source for `free shipping`, `freeShipping`, `shipping amount`, and shipping providers.
- **Notes:** A promotion discount exists; no independent shipping capability builtin was found.

### B2-zero-tax. Builtin zero tax without an extension
- **Charter location:** §2 Initial Store Operation
- **Required artifact:** Zero-tax implementation reached before total/order placement.
- **Verdict:** ABSENT
- **Evidence:** apps/api/src/core/cart/schemas.ts:66 `tax: { type: 'number', description: 'Tax amount' },`
- **Method:** Searched API/Shop source for `zero tax`, `zeroTax`, tax calculator, and tax-provider builtin registrations.

### B2-manual-fulfillment. Builtin manual fulfillment without an extension
- **Charter location:** §2 Initial Store Operation
- **Required artifact:** Merchant order-status fulfillment path unrelated to an extension contract.
- **Verdict:** PARTIAL
- **Evidence:** apps/api/src/core/admin/order-management/service.ts:382 `* Ship order - create shipment record with tracking info`
- **Method:** Searched API/Admin source for `manual fulfillment`, `fulfillmentStatus`, `ship order`, and fulfillment providers.
- **Notes:** Order-management logic exists, but it is not declared or called as the charter's builtin fulfillment contract.

### B2-console-email. Console email without an extension
- **Charter location:** §2 Initial Store Operation
- **Required artifact:** Console transport selected as baseline notification delivery.
- **Verdict:** ABSENT
- **Evidence:** apps/api/src/core/notification/digital-delivery-email.ts:1 `import { env } from '@/config/env';`
- **Method:** Searched API configuration and notification source for `console email`, `consoleEmail`, `ConsoleTransport`, and `nodemailer` console transport.

### B3. Generated Core-native settings pages and Core-owned controls
- **Charter location:** §3 Extension Center and Execution
- **Required artifact:** Manifest-schema form generator plus navigation, validation, secrets, authorization, and error handling.
- **Verdict:** PARTIAL
- **Evidence:** apps/admin/app/[locale]/plugins/[slug]/page.tsx:1 `import { PluginWorkspace } from '@/components/plugins/PluginWorkspace';`
- **Evidence:** apps/api/src/core/admin/plugin-management/config-secrets.ts:1 `import crypto from 'crypto';`
- **Method:** Searched Admin plugin UI and API plugin-management source for `configSchema`, `settings`, `secret`, `authorization`, `validation`, and error handling.
- **Notes:** Plugin settings and encrypted configuration helpers exist; static search did not establish schema-generated forms with all specified Core-owned responsibilities.

### B4. Failure containment at gateway, lifecycle, event, and process level
- **Charter location:** §3 Failure Containment
- **Required artifact:** Error boundaries and non-exiting process handlers with extension attribution.
- **Verdict:** PARTIAL
- **Evidence:** apps/api/src/core/admin/plugin-management/lifecycle-hooks.ts:50 `new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`Lifecycle hook ${hookName} timed out after ${LIFECYCLE_TIMEOUT_MS}ms`)),`
- **Evidence:** apps/api/src/core/admin/extension-installer/contract-v1-runtime.ts:51 `await Promise.all([...handlers].map((handler) => handler(payload)));`
- **Method:** Searched gateway, lifecycle, event, and server source for `try`, `catch`, `timeout`, `uncaughtException`, `unhandledRejection`, and `process.on`.
- **Notes:** Gateway/lifecycle bounding exists; generic event dispatch has no local catch and no process-level handlers were found.

### B5. Plugin-derived state consistency matrix
- **Charter location:** §3 State and Storage Boundaries
- **Required artifact:** Every module-level holder mapped to install/enable/disable/update/re-enable rebuild or clear actions.
- **Verdict:** PARTIAL
- **Evidence:** apps/api/src/core/admin/extension-installer/plugin-runtime.ts:161 `const internalRuntimes = new Map<string, InternalRuntime>();`
- **Evidence:** apps/api/src/core/admin/extension-installer/contract-v1-runtime.ts:45 `const eventHandlers = new Map<string, Map<string, Set<EventHandler>>>();`
- **Method:** Enumerated module-level `Map`, `Set`, cache, and singleton declarations under extension installer, plugin management, and storage; searched all lifecycle call sites.

| container | install | enable | disable | update | re-enable |
| --- | --- | --- | --- | --- | --- |
| `internalRuntimes` | warm call | no clear found | delete | replace on version/config change | recreated on gateway demand |
| `services` | registration possible | no clear found | no clear found | no clear found | no clear found |
| `eventHandlers` | registration possible | no clear found | delete via teardown | no explicit rebuild found | registration on runtime load |
| `breakerStore` | no action found | no action found | no action found | no action found | no action found |
| `rateLimitStore` | no action found | no action found | no action found | no action found | no action found |
| `loggedThemeExtensionWarnings` | no action found | no action found | no action found | no action found | no action found |

### B6. Plugin migration verification against installed-manifest SHA-256
- **Charter location:** §3 Plugin Database and Migrations
- **Required artifact:** Pre-execution comparison of each migration file identity/order/hash to installed manifest.
- **Verdict:** ABSENT
- **Evidence:** apps/api/src/core/admin/extension-installer/contract-v1-runtime.ts:93 `const expectedChecksum = checksum(migration.sql);`
- **Method:** Searched installer/runtime/package source for `migration`, `manifest`, `sha256`, `verifyFileIntegrity`, `createHash`, and `.sql`.

### B7. Package-derived default schema for plugin SQL
- **Charter location:** §3 Plugin Database and Migrations
- **Required artifact:** Deterministic schema derivation and SQL execution targeting it.
- **Verdict:** ABSENT
- **Evidence:** apps/api/src/core/admin/extension-installer/contract-v1-runtime.ts:108 `await tx.$executeRawUnsafe(migration.sql);`
- **Method:** Exact searches for `search_path`, `CREATE SCHEMA`, `schemaName`, `plugin schema`, and `set_config` in API, Prisma, SDK, plugins, and examples.

### B8. Tracking/custom code storage, placement exclusion, and audit
- **Charter location:** §3 Storefront Tracking and Custom Code
- **Required artifact:** Merchant-input models/routes, render slots, payment-form exclusion, and audit record.
- **Verdict:** ABSENT
- **Evidence:** apps/shop/app/[locale]/checkout/page.tsx:265 `// /payments/create-session. Try the native shape first so storefront`
- **Method:** Exact searches for `tracking provider`, `trackingId`, `customCode`, `document head`, `body start`, `body end`, `order confirmation`, `payment form`, and corresponding Prisma model names.

### B9. Declarative theme path from API at runtime
- **Charter location:** §3 Themes
- **Required artifact:** Runtime API data reader, block/section renderer, and rejection of executable content.
- **Verdict:** PARTIAL
- **Evidence:** apps/api/src/core/admin/theme-management/service.ts:19 `// Current @jiffoo/theme-api-sdk version (single source of truth)`
- **Evidence:** apps/api/src/core/admin/theme-app-runtime/manager.ts:1 `import {`
- **Method:** Searched Theme API SDK, API theme management, Shop/Admin theme runtime, and all theme packages for `theme.json`, `sections`, `blocks`, runtime reader, validator, and executable assets.
- **Notes:** Theme management exists while Theme App runtime and executable theme packages are also retained.

### B10. Retry and idempotency for plugin event subscribers
- **Charter location:** §3 Event Layer
- **Required artifact:** Subscriber delivery records/retry and idempotency key/effect guard.
- **Verdict:** PARTIAL
- **Evidence:** apps/api/src/core/admin/extension-installer/contract-v1-runtime.ts:51 `await Promise.all([...handlers].map((handler) => handler(payload)));`
- **Evidence:** apps/api/src/core/webhooks/delivery-worker.ts:226 `const { subscriptionId, eventId, eventType, payload, installationId, aggregateId } = params;`
- **Method:** Searched event runtime, jobs, webhooks, and Prisma schema for plugin subscriber `retry`, `idempotency`, `delivery`, and event records.
- **Notes:** Webhook delivery machinery exists; no generic Contract V1 subscriber retry/idempotency path was found.

### B11. Extension SDK scaffold, development, package, and signing
- **Charter location:** §3 Extension SDK
- **Required artifact:** SDK commands covering all four operations.
- **Verdict:** PARTIAL
- **Evidence:** packages/plugin-sdk/src/cli/commands/init.ts:1 `import fs from 'fs';`
- **Evidence:** packages/plugin-sdk/src/cli/commands/pack.ts:168 `return crypto.createHash('sha256').update(content).digest('hex');`
- **Method:** Searched all plugin SDK source and manifest scripts for `init`, `dev`, `local`, `pack`, `sign`, and `publish`.
- **Notes:** Init/pack source exists; no SDK local Core development execution path was located.

### B12. Core update identity, compatibility, backup, maintenance, health, no rollback after migration
- **Charter location:** §3 Core Updates
- **Required artifact:** Update state machine implementing every listed guard.
- **Verdict:** PARTIAL
- **Evidence:** apps/api/src/core/upgrade/service.ts:528 `if (process.env.KUBERNETES_SERVICE_HOST || process.env.HELM_RELEASE_NAME || process.env.ARGOCD_APP_NAME) {`
- **Evidence:** scripts/jiffoo-updater.mjs:585 `async function acquireUpgradeLock(workspaceDir, statusFile, targetVersion) {`
- **Method:** Searched update routes/services/executors and updater scripts for `release`, `integrity`, `compatibility`, `backup`, `maintenance`, `health`, `migration`, and `rollback`.
- **Notes:** Static sources contain update machinery, but Kubernetes handling contradicts Docker Compose as the sole V1 delivery form and manifest-level plugin migration verification is absent.

### B13. Module invalidation includes entry module dependency tree
- **Charter location:** §3 Extension Center and Execution
- **Required artifact:** Recursive dependency-cache invalidation before update reload.
- **Verdict:** PARTIAL
- **Evidence:** apps/api/src/core/admin/extension-installer/plugin-module-loader.ts:68 `delete runtimeRequire.cache[resolvedPath];`
- **Method:** Searched API, SDK, plugins, examples, scripts, and tests for `require.cache`, `delete`, `children`, dependency tree, `createRequire`, and ESM cache-busting imports.
- **Notes:** The code deletes the resolved entry path; no recursive traversal of `module.children` or dependency graph was found.

### B14. CommonJS-only/no-native-package constraint enforced at install or packaging
- **Charter location:** §3 Extension Center and Execution
- **Required artifact:** Manifest/module-format and native-artifact rejection.
- **Verdict:** PARTIAL
- **Evidence:** apps/api/src/core/admin/extension-installer/plugin-module-loader.ts:71 `return runtimeRequire(resolvedPath);`
- **Evidence:** apps/api/src/core/admin/extension-installer/plugin-module-loader.ts:57 `return import(`${moduleUrl.href}?v=${encodeURIComponent(options.version)}`);`
- **Method:** Searched installer, SDK packer, manifest schemas, and loader for `CommonJS`, `ESM`, `type: module`, `.node`, native module, and `import(`.
- **Notes:** The loader explicitly supports ESM; no installer/packer native-module rejection was found.

## Part C — Prohibited Surfaces

### C-4-1. Core is single merchant and single storefront
- **Charter location:** §4 rule 1
- **Required artifact:** Absence of multi-store routes/data paths.
- **Verdict:** CONTRADICTS
- **Evidence:** apps/api/src/core/admin/dashboard/routes.ts:17 `fastify.get('/dashboard/multi-store-stats', {`
- **Method:** Searched source, Prisma, tests, and OpenAPI for `multi-store`, `multistore`, `storeId`, and `tenant`.

### C-4-2. Package trust tiers have identical execution rights
- **Charter location:** §4 rule 2
- **Required artifact:** Trust classification without execution-right branching.
- **Verdict:** PARTIAL
- **Evidence:** apps/api/src/core/admin/extension-installer/trust-level.ts:5 `export type PluginTrustLevel = 'builtin' | 'signed' | 'unsigned';`
- **Method:** Searched installer, runtime, gateway, and plugin management for `builtin`, `signed`, `unsigned`, `trustLevel`, and permission branches.
- **Notes:** Trust tiers exist; static reading does not settle all downstream execution-right equality.

### C-4-3. Unsigned packages require warning, confirmation, and audit
- **Charter location:** §4 rule 3
- **Required artifact:** Confirmation guard and audit event.
- **Verdict:** PRESENT
- **Evidence:** apps/api/src/core/admin/extension-installer/plugin-fs-installer.ts:371 `if (trustLevel === 'unsigned' && !options?.confirmUnsigned) {`
- **Evidence:** apps/api/src/core/admin/extension-installer/plugin-fs-installer.ts:403 `event: 'plugin_unsigned_install_confirmed',`
- **Method:** Searched extension installer for `unsigned`, `confirmUnsigned`, `warning`, and audit events.

### C-4-4. Core does not restrict plugin schema/table/SQL access
- **Charter location:** §4 rule 4
- **Required artifact:** Unrestricted SQL execution rather than a permission boundary.
- **Verdict:** PRESENT
- **Evidence:** apps/api/src/core/admin/extension-installer/contract-v1-runtime.ts:108 `await tx.$executeRawUnsafe(migration.sql);`
- **Method:** Searched plugin migration/runtime source for GRANT, schema guards, allow-lists, `$executeRaw`, and SQL policy.

### C-4-5. Payment has no retained provider-specific direct checkout path
- **Charter location:** §4 rule 5
- **Required artifact:** Absence of direct provider route registration.
- **Verdict:** CONTRADICTS
- **Evidence:** apps/api/src/routes/index.ts:112 `await fastify.register(stripePaymentRoutes, { prefix: '/api/payments/stripe' });`
- **Method:** Searched API/Shop/Admin/SDK source for `stripe`, provider-specific payment prefixes, intent routes, and direct checkout paths.

### C-4-6. Browser script/injection originates only from merchant Admin input
- **Charter location:** §4 rule 6
- **Required artifact:** No package-declared browser injection and merchant storage/render path.
- **Verdict:** PARTIAL
- **Evidence:** apps/api/src/core/admin/theme-app-runtime/gateway.ts:1 `import {`
- **Method:** Searched theme/plugin manifests, API, Shop, Admin, and Prisma for browser script, embed, injection, tracking, and custom code declarations.
- **Notes:** Theme App gateway contradicts the package-runtime prohibition; merchant tracking/custom-code implementation was not found.

### C-4-7. Themes are presentation data only
- **Charter location:** §4 rule 7
- **Required artifact:** No Theme App process/gateway/executable theme runtime.
- **Verdict:** CONTRADICTS
- **Evidence:** apps/api/src/core/admin/theme-app-runtime/manager.ts:1 `import {`
- **Evidence:** apps/api/src/routes/index.ts:126 `await fastify.register(themeAppGatewayRoutes, { prefix: '/theme-app' });`
- **Method:** Searched theme runtime, installer, routes, theme packages, and environment config for `theme-app`, `runtime`, `gateway`, and executable artifacts.

### C-4-8. imagic is outside Core and receives no exception
- **Charter location:** §4 rule 8
- **Required artifact:** Absence of in-tree imagic theme/runtime treatment.
- **Verdict:** CONTRADICTS
- **Evidence:** packages/shop-themes/imagic-studio/package.json:2 `"name": "@jiffoo/theme-imagic-studio",`
- **Method:** Searched source, package manifests, deployment assets, tests, and OpenAPI for `imagic` and `imagic-studio`.

### C-4-9. Lifecycle and theme activation actions are auditable
- **Charter location:** §4 rule 9
- **Required artifact:** Audit writes for Core/extension updates, enable/disable, and theme activation.
- **Verdict:** PARTIAL
- **Evidence:** apps/api/src/core/admin/extension-installer/plugin-fs-installer.ts:403 `event: 'plugin_unsigned_install_confirmed',`
- **Method:** Searched lifecycle, theme management, updater, and audit source for `audit`, `event:`, `activate`, `enable`, `disable`, and `update`.
- **Notes:** An install-confirmation audit event exists; the complete set of required lifecycle and theme audit actions was not found.

### C-7-1. Cloudflare Worker is outside the V1 worktree
- **Charter location:** §7 entry 1
- **Required artifact:** Absence of Cloudflare Worker application.
- **Verdict:** CONTRADICTS
- **Evidence:** apps/cloudflare-native-core-api/package.json:2 `"name": "@jiffoo/cloudflare-native-core-api",`
- **Method:** Searched workspace manifests, `apps`, `deploy`, `scripts`, and configuration for `cloudflare`, `wrangler`, and `worker`.

### C-7-2. Kubernetes updater tooling is outside the V1 worktree
- **Charter location:** §7 entry 2
- **Required artifact:** Absence of Kubernetes update sources.
- **Verdict:** CONTRADICTS
- **Evidence:** scripts/jiffoo-k8s-updater-agent.mjs:327 `currentStep: 'Inspecting current Kubernetes release state',`
- **Method:** Searched `apps`, `deploy`, `scripts`, and root configuration for `kubernetes`, `k8s`, `helm`, `apiVersion:`, and `kind:`.

### C-7-3. External plugin demo is outside the V1 worktree
- **Charter location:** §7 entry 3
- **Required artifact:** Absence of external plugin demo source.
- **Verdict:** CONTRADICTS
- **Evidence:** examples/external-plugin-demo/src/index.ts:1 `import express from 'express';`
- **Method:** Enumerated `examples` and searched workspace source/configuration for `external-plugin-demo`, `express`, and remote plugin references.

### C-7-4. Multi-store functionality is outside V1
- **Charter location:** §7 entry 4
- **Required artifact:** Absence of multi-store route/service.
- **Verdict:** CONTRADICTS
- **Evidence:** apps/api/src/core/admin/dashboard/service.ts:187 `static async getMultiStoreStats() {`
- **Method:** Searched API/Admin/Shop/Prisma/tests/OpenAPI for `multi-store`, `multiStore`, `storeId`, and plural store management routes.

### C-7-5. Legacy executable Shop themes are outside V1
- **Charter location:** §7 entry 5
- **Required artifact:** Absence of framework-dependent/executable theme packages.
- **Verdict:** CONTRADICTS
- **Evidence:** packages/shop-themes/app-landingpage/package.json:15 `"next": "^16.0.7",`
- **Method:** Enumerated `packages/shop-themes/*` and searched manifests/source for `next`, `react`, `src/app`, `runtime`, and component files.

### C-7-6. imagic-studio theme package is outside Core
- **Charter location:** §7 entry 6
- **Required artifact:** Absence of the package.
- **Verdict:** CONTRADICTS
- **Evidence:** packages/shop-themes/imagic-studio/src/runtime.ts:1 `export { default } from './index';`
- **Method:** Enumerated and searched all `packages/shop-themes/imagic-studio` paths and workspace references.

### C-7-7. Market connection status OpenAPI entry is outside V1
- **Charter location:** §7 entry 7
- **Required artifact:** No market connection status API surface or OpenAPI entry.
- **Verdict:** PARTIAL
- **Evidence:** apps/api/src/core/admin/market/routes.ts:34 `fastify.get('/health', {`
- **Method:** Searched `openapi.json`, API route registration, market source, Admin source, and tests for `market`, `connection`, `status`, and `health`.
- **Notes:** The market health route exists. OpenAPI is intent only and is not used as implementation evidence.

### C1. Static OpenAPI and registered-route two-way diff
- **Charter location:** Part C additional C1
- **Required artifact:** Complete method/path comparison across `/api/...` and `/api/v1/...` registration surfaces.
- **Verdict:** PARTIAL
- **Evidence:** apps/api/src/routes/index.ts:51 `await fastify.register(registerV1Routes, { prefix: '/api/v1' });`
- **Evidence:** apps/api/src/routes/index.ts:112 `await fastify.register(stripePaymentRoutes, { prefix: '/api/payments/stripe' });`
- **Evidence:** apps/api/src/routes/v1/index.ts:45 `await fastify.register(apiTokenRoutes, { prefix: '/admin/api-tokens' });`
- **Method:** Read both registrar modules; searched `apps/api/src` for `fastify.get`, `fastify.post`, `fastify.put`, `fastify.patch`, `fastify.delete`, and `fastify.register`; searched `openapi.json` for `/api/` and `/v1/` path keys.
- **Notes:** Registered but not mirrored across surfaces include the unversioned Stripe prefix, notification, currency, discount, recommendation, market, webhook, staff, inventory, warehouse, stock-alert, health/error, and Bokmoo registrations in `routes/index.ts`; V1-only registrations include API-token and internal plugin-order prefixes. The static OpenAPI file cannot prove a handler, and composed plugin routes prevent a complete operation-level match without Fastify's runtime route table.

### C2. Remaining multi-store, tenant, plan, subscription, platform-account, or Super Admin concepts
- **Charter location:** Part C additional C2
- **Required artifact:** No matching source, Prisma, test, or OpenAPI references.
- **Verdict:** CONTRADICTS
- **Evidence:** apps/api/src/core/admin/dashboard/routes.ts:17 `fastify.get('/dashboard/multi-store-stats', {`
- **Evidence:** apps/api/prisma/migrations/20260423000000_admin_memberships/migration.sql:48 `WHEN u."role" = 'TENANT_ADMIN' THEN 'ADMIN'`
- **Evidence:** apps/api/src/core/external-orders/service.ts:26 `planId?: string | null;`
- **Method:** Case-insensitive exact/string-pattern search of API/Admin/Shop/packages/Prisma/tests/OpenAPI for `multi-store|multistore|tenant|plan|subscription|platform account|platform-account|super admin|superadmin`.
