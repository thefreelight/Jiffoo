# AGENTRA-004: Payment Path Recon


## Coverage

This is a static source/configuration read. `dist/`, `.next/`, `node_modules/`,
and generated Prisma clients were excluded. No `schema.prisma` was found by
the `rg --files -g schema.prisma` search; model/enum statements therefore
cannot be authoritatively enumerated from schema source. Runtime checkout,
Stripe API calls, webhook delivery, database contents, and test results are
`UNVERIFIABLE_STATIC`; a running API plus request, Stripe-event, and database
observations would settle them. The premise of eight known failing API tests is
contradicted by `apps/api/tests/KNOWN-FAILURES.md`, which records zero failures.

## P. The checkout-to-payment path

### QP1. Storefront checkout paths that initiate payment
- **Answer:** Two Shop-facing client paths exist. The checkout page first calls the native Stripe-intent client; on the documented unsupported path it calls the plugin-first session client. The client path is selected in Shop checkout code, not by Core. Separately, theme clients call the plugin-first session endpoint directly. Core receives the session request in `paymentRoutes`, selects an enabled plugin, and forwards it to the internal plugin gateway.
- **Evidence:** apps/shop/app/[locale]/checkout/page.tsx:256 `// Native Cloudflare cores do not implement /payments/create-intent.`
- **Evidence:** apps/shop/lib/api.ts:301 `const response = await apiClient.post('/payments/create-intent', data)`
- **Evidence:** apps/shop/lib/api.ts:285 `}>> => apiClient.post('/payments/create-session', data),`
- **Evidence:** apps/api/src/core/payment/routes.ts:313 `path: '/api/payments/create-session?installation=default',`
- **Evidence:** packages/theme-api-sdk/src/client.ts:141 `createSession: (payload) => request('/payments/create-session', { method: 'POST', body: payload }),`
- **Method:** Searched `apps/shop`, `apps/api`, `apps/admin`, `packages`, and tests for `create-intent`, `create-session`, `PaymentSession`, `callPaymentPlugin`, and `checkout`.
- **Notes:** Whether either path is actually reached by a deployed Shop is `UNVERIFIABLE_STATIC`; an HTTP trace would settle it.

### QP2. Payment implementation selection and no-plugin result
- **Answer:** `getEnabledPaymentMethods` filters installed packages to category `payment`, then ignores missing, disabled, and deleted default instances. `resolvePluginSlugByMethod` matches the submitted method against slug/name, then retries after removing a `-payment` suffix. With no enabled methods, `POST /payments/create-session` returns `409 PAYMENT_PLUGIN_REQUIRED`; it does not invoke a fallback payment implementation.
- **Evidence:** apps/api/src/core/payment/routes.ts:95 `if (!defaultInstance || !defaultInstance.enabled || defaultInstance.deletedAt) {`
- **Evidence:** apps/api/src/core/payment/routes.ts:126 `const withoutPaymentSuffix = normalized.endsWith('-payment') ? normalized.slice(0, -8) : normalized;`
- **Evidence:** apps/api/src/core/payment/routes.ts:231 `'PAYMENT_PLUGIN_REQUIRED',`
- **Method:** Read `apps/api/src/core/payment/routes.ts`; searched payment and plugin-management source for `getEnabledPaymentMethods`, `resolvePluginSlugByMethod`, `PAYMENT_PLUGIN_REQUIRED`, and `defaultInstance`.

### QP3. Payment persistence, visible models/statuses, and write sites
- **Answer:** The source uses Prisma delegates `order`, `payment`, and `paymentLedger`. Authoritative Prisma model declarations and enum declarations are unavailable because no `schema.prisma` is present. Visible payment fields are: `Payment` uses `orderId`, `paymentMethod`, `amount`, `currency`, `status`, `sessionId`, `sessionUrl`, `paymentIntentId`, `attemptNumber`, `idempotencyKey`, `expiresAt`, `providerEventId`, `failureReason`, `metadata`, and `updatedAt`; `PaymentLedger` uses `paymentId`, `orderId`, `eventType`, `amount`, `currency`, `provider`, `idempotencyKey`, and `providerEventId`; `Order` uses `status`, `paymentStatus`, `paymentAttempts`, `lastPaymentAttemptAt`, and `lastPaymentMethod`. Observed payment status literals are `PENDING`, `SUCCEEDED`, and `FAILED`; observed order payment literals are `PENDING`, `PAID`, `FAILED`, and `REFUNDED`.
- **Evidence:** apps/api/src/core/payment/routes.ts:371 `status: 'PENDING',`
- **Evidence:** apps/api/src/core/payment/reconciliation.ts:80 `status: 'SUCCEEDED',`
- **Evidence:** apps/api/src/core/payment/reconciliation.ts:167 `status: 'FAILED',`
- **Evidence:** apps/api/src/core/order/types.ts:66 `export const PaymentStatus = {`
- **Evidence:** apps/api/prisma/migrations/20260304000000_store_shipping_relations/migration.sql:83 `ADD COLUMN     "paymentStatus" "OrderPaymentStatus" NOT NULL DEFAULT 'PENDING',`
- **Method:** Searched API payment/order/admin-order source and Prisma migrations for `payment.create`, `payment.update`, `paymentLedger.create`, `paymentStatus`, `paymentAttempts`, `paymentIntentId`, and `status:`; used `rg --files -g schema.prisma` to locate schema source.
- **Notes:** Write sites include plugin session creation at `apps/api/src/core/payment/routes.ts:363`, Stripe intent creation at `apps/api/src/routes/payments.ts:120`, reconciliation updates at `apps/api/src/core/payment/reconciliation.ts:77` and `:164`, Stripe webhook updates at `apps/api/src/routes/payments.ts:279` and `:361`, native confirmation at `apps/api/src/core/payment/native-confirmation.ts:356`, and refund/order-admin paths at `apps/api/src/core/order/service.ts:919` and `apps/api/src/core/admin/order-management/service.ts:516`.

### QP4. Order transitions triggered by payment events
- **Answer:** Plugin reconciliation marks a successful payment and updates the order to `PROCESSING`/`PAID`; a failed verification updates `paymentStatus` to `FAILED`. The Stripe webhook has equivalent success and failure branches. Native confirmation updates a paid order to `PROCESSING`/`PAID` when the Stripe confirmation reports paid. All observed branches record order status history where the prior order was loaded.
- **Evidence:** apps/api/src/core/payment/reconciliation.ts:101 `paymentStatus: PaymentStatus.PAID,`
- **Evidence:** apps/api/src/core/payment/reconciliation.ts:186 `data: { paymentStatus: PaymentStatus.FAILED },`
- **Evidence:** apps/api/src/routes/payments.ts:302 `status: OrderStatus.PROCESSING, // Move to processing after payment`
- **Evidence:** apps/api/src/routes/payments.ts:390 `paymentStatus: PaymentStatus.FAILED,`
- **Evidence:** apps/api/src/core/payment/native-confirmation.ts:366 `? { status: OrderStatus.PROCESSING, paymentStatus: PaymentStatus.PAID }`
- **Method:** Searched payment, reconciliation, native-confirmation, Stripe route, and order service source for `OrderStatus`, `PaymentStatus`, `order.update`, and `recordOrderStatusHistory`.

## Q. The Stripe direct path

### QQ1. Stripe-prefix routes
- **Answer:** The Stripe-prefix registration creates `POST /api/payments/stripe/create-intent` and `POST /api/payments/stripe/webhook`. The same handler module is also registered at `/api/payments`, producing duplicate non-Stripe-prefix paths.
- **Evidence:** apps/api/src/routes/index.ts:116 `await fastify.register(stripePaymentRoutes, { prefix: '/api/payments/stripe' });`
- **Evidence:** apps/api/src/routes/payments.ts:39 `fastify.post('/create-intent', {`
- **Evidence:** apps/api/src/routes/payments.ts:214 `fastify.post('/webhook', {`
- **Method:** Read `apps/api/src/routes/index.ts` and `apps/api/src/routes/payments.ts`; searched registrations and `fastify.post` handlers.

### QQ2. Stripe-route behavior and contract-path equivalence
- **Answer:** `create-intent` authorizes the order owner, calls `StripeService.createPaymentIntent`, persists a `Payment`/`PaymentLedger` pair, and returns `clientSecret` plus `paymentIntentId`. The contract path creates a hosted session through `callPaymentPlugin` and requires `sessionId` plus `url`; it has no equivalent client-secret response. Stripe `webhook` verifies `stripe-signature`, constructs a Stripe event, and directly changes payment/order state for `payment_intent.succeeded` and `payment_intent.payment_failed`. The generic contract webhook receives `/webhook/:provider`, contains a Stripe-name special case, and calls plugin session reconciliation for `checkout.session.completed`; it is not equivalent signature verification or event processing.
- **Evidence:** apps/api/src/routes/payments.ts:106 `const { clientSecret, id: paymentIntentId } = await StripeService.createPaymentIntent({`
- **Evidence:** apps/api/src/core/payment/routes.ts:341 `if (!session?.sessionId || !session?.url) {`
- **Evidence:** apps/api/src/routes/payments.ts:224 `const signature = request.headers['stripe-signature'];`
- **Evidence:** apps/api/src/core/payment/routes.ts:456 `if (normalizeMethodKey(provider) === 'stripe') {`
- **Method:** Read the direct Stripe and contract payment route modules; searched `createPaymentIntent`, `constructWebhookEvent`, `create-session`, `webhook`, and `syncPaymentFromPlugin`.

### QQ3. Stripe references outside route handlers
- **Answer:** Static references include route registrations, Shop client calls/config fallback, API configuration/service/native confirmation, Admin order display, tests, package types, and configuration. No in-tree Stripe plugin package manifest was found.
- **Evidence:** apps/api/src/routes/index.ts:115 `await fastify.register(stripePaymentRoutes, { prefix: '/api/payments' });`
- **Evidence:** apps/shop/lib/api.ts:301 `const response = await apiClient.post('/payments/create-intent', data)`
- **Evidence:** apps/shop/app/[locale]/checkout/page.tsx:68 `const fallbackStripePublishableKey = (process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '').trim();`
- **Evidence:** apps/admin/app/[locale]/orders/[id]/page.tsx:262 `{(order.stripePaymentIntentId || (order.payments && order.payments[0]?.paymentIntentId)) && (`
- **Evidence:** apps/api/src/core/payment/native-confirmation.ts:162 `intent = await StripeService.confirmNativePayment({`
- **Evidence:** apps/api/tests/routes/payments.test.ts:336 `'stripe-signature': 'test-signature',`
- **Evidence:** packages/shared/src/types/dto/order-dto.ts:115 `stripePaymentIntentId?: string | null;`
- **Method:** Case-sensitive searches for `stripe`, `Stripe`, `create-intent`, `stripePayment`, and `StripeService` in `apps/api`, `apps/shop`, `apps/admin`, `packages`, `tests`, and `e2e`.
- **Notes:** Classification: route registrations are `apps/api/src/routes/index.ts:115-116`; client call is `apps/shop/lib/api.ts:301`; type import/field is `packages/shared/src/types/dto/order-dto.ts:115`; configuration is `apps/api/src/config/env.ts:47-50`, `apps/shop/app/[locale]/checkout/page.tsx:68`, and `apps/api/src/services/stripe.service.ts:141-150`; tests include `apps/api/tests/routes/payments.test.ts`, `apps/api/tests/core/stripe-service-config.test.ts`, and `apps/api/tests/core/native-payment-confirmation.test.ts`.

### QQ4. Stripe environment, persistence, webhooks, and rows
- **Answer:** API config declares `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, and `STRIPE_WEBHOOK_SECRET`. The direct Stripe route persists `paymentMethod: 'stripe'`, `paymentIntentId`, and ledger `provider: 'stripe'`. It handles the Stripe signature header and both payment-intent success/failure event types. The actual database rows are `UNVERIFIABLE_STATIC` without a database query.
- **Evidence:** apps/api/src/config/env.ts:47 `STRIPE_SECRET_KEY: z.string().optional(),`
- **Evidence:** apps/api/src/routes/payments.ts:124 `paymentMethod: 'stripe',`
- **Evidence:** apps/api/src/routes/payments.ts:143 `provider: 'stripe',`
- **Evidence:** apps/api/src/routes/payments.ts:224 `const signature = request.headers['stripe-signature'];`
- **Method:** Searched API/Shop/Admin/packages/tests for `STRIPE_`, `stripePayment`, `paymentIntentId`, `stripe-signature`, and `StripeService`.

### QQ5. Stripe payment plugin package
- **Answer:** No installable Stripe plugin package was found. This conclusion concerns package source only, not database-installed packages or deployed files.
- **Evidence:** apps/api/src/core/payment/routes.ts:95 `if (!defaultInstance || !defaultInstance.enabled || defaultInstance.deletedAt) {`
- **Method:** Enumerated `plugins`, `extensions`, `examples`, and `packages` for `manifest.json`, `package.json`, and names/paths matching `stripe`; searched their manifests and source for a Stripe plugin entry.

## R. What a builtin payment implementation would attach to

### QR1. `PaymentDriver` contract
- **Answer:** `PaymentDriver` has required `createSession(input: Record<string, unknown>): Promise<unknown> | unknown`; optional `verifySession(sessionId: string): Promise<unknown> | unknown`; and optional `handleWebhook(payload: unknown): Promise<unknown> | unknown`. The return type is unconstrained `unknown`; the outer payment route later requires a response containing `sessionId` and `url`.
- **Evidence:** apps/api/src/core/admin/extension-installer/contract-v1-runtime.ts:19 `type PaymentDriver = {`
- **Evidence:** apps/api/src/core/admin/extension-installer/contract-v1-runtime.ts:20 `createSession(input: Record<string, unknown>): Promise<unknown> | unknown;`
- **Evidence:** apps/api/src/core/admin/extension-installer/contract-v1-runtime.ts:21 `verifySession?(sessionId: string): Promise<unknown> | unknown;`
- **Evidence:** apps/api/src/core/admin/extension-installer/contract-v1-runtime.ts:22 `handleWebhook?(payload: unknown): Promise<unknown> | unknown;`
- **Method:** Read the Contract V1 runtime and searched API/SDK/plugins/examples for `type PaymentDriver` and `registerDriver`.

### QR2. Driver registration and lookup
- **Answer:** Registration does not use a Core-wide driver registry. During `activateContractV1`, the context's `registerDriver` accepts only `kind === 'payment'` and installs Fastify routes closing over the supplied driver on that plugin's isolated app. At request time, Core selects a plugin slug from enabled package metadata and calls the gateway; the plugin-local `/api/payments/create-session` route calls `driver.createSession`.
- **Evidence:** apps/api/src/core/admin/extension-installer/contract-v1-runtime.ts:223 `registerDriver: (kind: string, driver: PaymentDriver) => {`
- **Evidence:** apps/api/src/core/admin/extension-installer/contract-v1-runtime.ts:224 `if (kind === 'payment') registerPaymentDriver(app, driver, options.slug);`
- **Evidence:** apps/api/src/core/admin/extension-installer/contract-v1-runtime.ts:127 `app.post('/api/payments/create-session', async (request, reply) => {`
- **Evidence:** apps/api/src/core/payment/routes.ts:278 `const pluginSlug = resolvePluginSlugByMethod(paymentMethod, availableMethods);`
- **Method:** Read contract runtime and payment routes; searched for `PaymentDriver`, `registerDriver`, `registerPaymentDriver`, `resolvePluginSlugByMethod`, and maps keyed by payment driver.

### QR3. Existing builtin/default/null/fallback driver
- **Answer:** No builtin/default/null/fallback payment driver or other capability driver was found in the scanned source. The direct Stripe service is an in-Core alternate route implementation, not a `PaymentDriver` registration.
- **Evidence:** apps/api/src/core/admin/extension-installer/contract-v1-runtime.ts:224 `if (kind === 'payment') registerPaymentDriver(app, driver, options.slug);`
- **Method:** Exact searches across `apps/api/src`, `packages`, `plugins`, and `examples` for `registerDriver`, `PaymentDriver`, `default driver`, `fallback driver`, `Null`, `builtin`, `manual payment`, `ShippingDriver`, `TaxDriver`, `FulfillmentDriver`, and `NotificationDriver`.

### QR4. Required plugin payment response fields
- **Answer:** The payment route unwraps `payload.data` when present, then rejects the response unless the resulting object has truthy `sessionId` and `url`. `expiresAt` is optional and defaults to 30 minutes; `paymentIntentId` is optional and stored as null when absent.
- **Evidence:** apps/api/src/core/payment/routes.ts:340 `const session = (pluginResult.payload?.data ?? pluginResult.payload) as Record<string, unknown>;`
- **Evidence:** apps/api/src/core/payment/routes.ts:341 `if (!session?.sessionId || !session?.url) {`
- **Evidence:** apps/api/src/core/payment/routes.ts:342 `return sendError(reply, 502, 'PAYMENT_PLUGIN_INVALID_RESPONSE', 'Payment plugin returned invalid create-session response');`
- **Method:** Read `apps/api/src/core/payment/routes.ts` around the gateway response and persistence transaction.

## S. Admin and storefront surfaces

### QS1. Admin payment configuration, selection, and status
- **Answer:** Admin order detail displays payment intent identifiers, payment status, and payment records. Plugin configuration is presented through the plugin workspace; static reading does not prove it has payment-specific controls. No dedicated Admin payment-method selection page was found.
- **Evidence:** apps/admin/app/[locale]/orders/[id]/page.tsx:262 `{(order.stripePaymentIntentId || (order.payments && order.payments[0]?.paymentIntentId)) && (`
- **Evidence:** apps/admin/app/[locale]/plugins/[slug]/page.tsx:1 `import { PluginWorkspace } from '@/components/plugins/PluginWorkspace';`
- **Method:** Searched Admin source for `payment`, `Payment`, `stripe`, `paymentMethod`, `paymentStatus`, `PaymentIntent`, and plugin configuration components.

### QS2. Shop payment endpoint calls
- **Answer:** `apps/shop/lib/api.ts` calls available-methods, create-session, verify-session, and create-intent. The main checkout page selects the direct-intent and session flows. Theme API SDK and legacy theme source also call session endpoints.
- **Evidence:** apps/shop/lib/api.ts:270 `}>>> => apiClient.get('/payments/available-methods'),`
- **Evidence:** apps/shop/lib/api.ts:285 `}>> => apiClient.post('/payments/create-session', data),`
- **Evidence:** apps/shop/lib/api.ts:293 `}>> => apiClient.get(`/payments/verify/${sessionId}`),`
- **Evidence:** apps/shop/lib/api.ts:301 `const response = await apiClient.post('/payments/create-intent', data)`
- **Evidence:** packages/theme-api-sdk/src/client.ts:142 `verifySession: (sessionId) => request(`/payments/verify/${sessionId}`),`
- **Method:** Searched Shop, theme SDK, theme source, Admin, and tests for `/payments/`, `createSession`, `createPaymentIntent`, and `verifySession`.

### QS3. Admin manual payment recording
- **Answer:** No Admin route/page/component explicitly records a manual payment against an order was found. Admin order-management has refund and shipping/status operations, which are distinct source paths.
- **Evidence:** apps/api/src/core/admin/order-management/service.ts:382 `* Ship order - create shipment record with tracking info`
- **Method:** Exact/string-pattern search in `apps/admin`, `apps/api/src/core/admin`, API route tests, and Admin tests for `manual payment`, `record payment`, `mark paid`, `payment manual`, `manualPayment`, and `paymentStatus.*PAID` writes.

## T. Test coverage

### QT1. Existing payment-path tests
- **Answer:** `apps/api/tests/routes/payments.test.ts` covers payment routes and Stripe webhook requests; `apps/api/tests/core/payment-routes.test.ts` covers enabled payment package/session route behavior; `apps/api/tests/core/stripe-service-config.test.ts` covers Stripe runtime configuration; `apps/api/tests/core/native-payment-confirmation.test.ts` covers Stripe-backed Apple Pay/Google Pay confirmation; `apps/api/tests/core/order-service.test.ts` covers order payment/refund state; `e2e/shop/checkout.spec.ts` and its duplicate `tests/e2e/core/shop/checkout.spec.ts` are checkout E2E sources; `apps/shop/tests/payment-result-redirect.test.ts` covers Shop redirect behavior.
- **Evidence:** apps/api/tests/routes/payments.test.ts:8 `* - POST /api/payments/stripe/webhook`
- **Evidence:** apps/api/tests/core/payment-routes.test.ts:78 `const STRIPE_PACKAGE = {`
- **Evidence:** apps/api/tests/core/native-payment-confirmation.test.ts:89 `it('marks order paid when Stripe confirms a native payment method', async () => {`
- **Evidence:** apps/shop/tests/payment-result-redirect.test.ts:1 `import { describe, expect, it } from 'vitest';`
- **Method:** Enumerated test files matching `payment|checkout|order|stripe`, then read their describe/test labels and imports.

### QT2. Tests that specifically reference Stripe routes
- **Answer:** `apps/api/tests/routes/payments.test.ts` explicitly posts Stripe webhook requests. `apps/api/tests/core/payment-routes.test.ts` uses a Stripe-named plugin fixture but tests the contract path. `apps/api/tests/core/stripe-service-config.test.ts` and `apps/api/tests/core/native-payment-confirmation.test.ts` exercise Stripe service behavior, not the two direct route handlers.
- **Evidence:** apps/api/tests/routes/payments.test.ts:336 `'stripe-signature': 'test-signature',`
- **Evidence:** apps/api/tests/core/payment-routes.test.ts:78 `const STRIPE_PACKAGE = {`
- **Evidence:** apps/api/tests/core/stripe-service-config.test.ts:35 `describe('StripeService runtime config', () => {`
- **Method:** Searched all allowed test directories for `stripe`, `StripeService`, `/payments/stripe`, `create-intent`, and `stripe-signature`.

### QT3. Known failing API tests touching payment, checkout, or totals
- **Answer:** The premise is contradicted: the known-failures source states `1494 passed / 0 failed / 2 skipped` and labels historical debt cleared. It lists two skipped API-standards tests, neither payment, checkout, nor order-total specific. Test-source-only evidence cannot establish current suite failures.
- **Evidence:** apps/api/tests/KNOWN-FAILURES.md:4 `> **Suite**: `apps/api` — 91 files, 1494 passed / 0 failed / 2 skipped (1496)`
- **Evidence:** apps/api/tests/KNOWN-FAILURES.md:10 `| `business JSON operations should use ApiResponse<T> envelope with typed data` |`
- **Method:** Read `apps/api/tests/KNOWN-FAILURES.md`; searched allowed API test source for `fail`, `skip`, `payment`, `checkout`, and `totalAmount`.
