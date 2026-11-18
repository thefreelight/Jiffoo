# BOKMOO App API Production Runbook

## Purpose

This runbook verifies the production backend surface used by the BOKMOO Android app:

- Auth and account APIs in Jiffoo core
- eSIM product and order APIs in Jiffoo core
- native payment confirmation and payment webhooks in Jiffoo core
- BOKMOO card, install gate, profile, notifications, and support APIs in the `bokmoo-connect` official plugin
- Jiffoo `order.paid` fulfillment delivery into `bokmoo-connect`

The app base URL should be configured as:

```bash
BOKMOO_API_BASE_URL=https://api.bokmoo.com
```

## Ownership Boundary

Core owns shared platform behavior:

- `/api/auth/*`
- `/api/account`
- `/api/products`
- `/api/orders`
- `/api/payments/*`
- BOKMOO app facade forwarding under `/api/cards`, `/api/profiles`, `/api/payment-methods`, `/api/notifications`, and `/api/support/*`

The `bokmoo-connect` official plugin owns BOKMOO-specific durable business state:

- card claim/verify/unbind policy
- eSIM install-session/install-complete gate
- profile records and install traces
- app notifications
- support tickets/card actions
- Jiffoo `order.paid` fulfillment allocation

Do not move BOKMOO card or install policy into the shop theme.

## Required Core Environment

Configure these before production smoke:

```bash
ENABLE_OUTBOX_WORKER=true
BOKMOO_JIFFOO_WEBHOOK_SECRET=<shared-order-paid-secret>

GOOGLE_ANDROID_CLIENT_ID=<bokmoo-android-client-id>
GOOGLE_IOS_CLIENT_ID=<bokmoo-ios-client-id-if-needed>
GOOGLE_WEB_CLIENT_ID=<bokmoo-web-client-id-if-needed>

APPLE_BUNDLE_ID=<bokmoo-ios-or-android-service-audience>
APPLE_SERVICE_ID=<apple-service-id-if-used>
APPLE_TEAM_ID=<apple-team-id>
APPLE_KEY_ID=<apple-key-id>
APPLE_PRIVATE_KEY=<apple-private-key-with-newlines-escaped>

STRIPE_SECRET_KEY=<stripe-secret-key>
STRIPE_WEBHOOK_SECRET=<stripe-webhook-secret>
```

If Apple authorization-code exchange uses a prebuilt client secret, set:

```bash
APPLE_CLIENT_SECRET=<apple-client-secret>
```

## Required Plugin Environment And Config

The `bokmoo-connect` plugin must be installed, enabled, migrated, and backed by a production database:

```bash
BOKMOO_CONNECT_DATABASE_URL=postgresql://...
```

Plugin instance config should include:

```json
{
  "jiffooWebhookSecret": "<same value as BOKMOO_JIFFOO_WEBHOOK_SECRET>",
  "allowMockFulfillment": false,
  "fulfillmentProviderUrl": "https://<esim-provider>/allocate",
  "fulfillmentProviderToken": "<provider-token>",
  "paymentMethodProviderUrl": "https://<payment-provider>/payment-methods",
  "paymentMethodProviderToken": "<payment-provider-token>"
}
```

The fulfillment provider is called only when an `order.paid` payload does not already contain `lpaString`, `smdpAddress`, and `activationCode`. A provider response may be direct or wrapped in `{ "data": ... }`.

Expected ready payload:

```json
{
  "data": {
    "packageId": "prod_japan_5gb",
    "lpaString": "LPA:1$rsp.example$MATCHING-ID",
    "qrCode": "LPA:1$rsp.example$MATCHING-ID",
    "smdpAddress": "rsp.example",
    "activationCode": "MATCHING-ID",
    "confirmationCode": null
  }
}
```

If no provider is configured and the webhook has no activation payload, the plugin records a pending fulfillment and `install-session` returns `FULFILLMENT_NOT_READY`.

The payment method provider is called by `POST /api/payment-methods` when configured. It should tokenize/store the App-provided payment token and return a safe display payload. A response may be direct or wrapped in `{ "data": ... }`.

Expected payment method provider payload:

```json
{
  "data": {
    "provider": "stripe",
    "paymentMethodId": "pm_123",
    "customerId": "cus_123",
    "card": {
      "brand": "visa",
      "last4": "4242",
      "exp_month": 12,
      "exp_year": 2031
    }
  }
}
```

If `paymentMethodProviderUrl` is not configured, `POST /api/payment-methods` stores only a local test/development payment method record. Production should configure the provider.

## Deploy Order

1. Deploy the API image containing the BOKMOO app facade and social/native payment code.
2. Run core migrations:

```bash
pnpm --filter api exec prisma migrate deploy
```

3. Publish/install the `bokmoo-connect` official plugin artifact.
4. Run plugin migrations against `BOKMOO_CONNECT_DATABASE_URL`:

```bash
cd extensions/plugins/bokmoo-connect
BOKMOO_CONNECT_DATABASE_URL=postgresql://... pnpm exec prisma migrate deploy
```

5. Enable the plugin instance and confirm its instance ID is the runtime installation ID.
6. Set the plugin config above.
7. Confirm the outbox worker is running.

## Safe Production Smoke

Run public and route-presence checks:

```bash
node scripts/smoke-bokmoo-app-api.mjs \
  --base-url https://api.bokmoo.com \
  --country JP
```

Run authenticated customer read checks:

```bash
node scripts/smoke-bokmoo-app-api.mjs \
  --base-url https://api.bokmoo.com \
  --user-token <customer-jwt> \
  --country JP
```

Run install gate checks for a known paid order:

```bash
node scripts/smoke-bokmoo-app-api.mjs \
  --base-url https://api.bokmoo.com \
  --user-token <customer-jwt> \
  --order-id <order-id> \
  --country JP
```

If the order has no verified BOKMOO card or no ready fulfillment, the script expects `403`, `404`, or `409` and verifies that no QR/LPA/activation fields are leaked in the error response.

Run support read checks:

```bash
node scripts/smoke-bokmoo-app-api.mjs \
  --base-url https://api.bokmoo.com \
  --support-token <support-jwt-with-support-read> \
  --country JP
```

Optional write checks:

```bash
node scripts/smoke-bokmoo-app-api.mjs \
  --base-url https://api.bokmoo.com \
  --user-token <customer-jwt> \
  --create-ticket \
  --country JP
```

Optional signed Jiffoo webhook check:

```bash
node scripts/smoke-bokmoo-app-api.mjs \
  --base-url https://api.bokmoo.com \
  --send-order-paid \
  --webhook-secret <shared-order-paid-secret> \
  --order-id <paid-order-id> \
  --webhook-user-id <customer-user-id> \
  --product-id <product-id> \
  --variant-id <variant-id> \
  --country JP
```

Only run the signed webhook check against a disposable smoke order or a controlled test user because it creates or updates a fulfillment record.

## Social Sign-In For The App (Native Token Channel)

The native worker owns identity login (`identity-login.ts`). The web flow
(authorization-code redirect through the storefront) and the app channel share
the same account layer: identities bind strictly by (issuer, subject), an
identical email never merges accounts (`IDENTITY_EMAIL_IN_USE`), and every
login lands as a plain shop session.

### Endpoint

```text
POST https://api.bokmoo.com/api/v1/auth/identity/native
Content-Type: application/json

{
  "providerSlug": "apple-auth",   // apple-auth | google-auth | facebook-auth
  "idToken": "<token from the provider SDK>",
  "nonce": "<nonce the app generated for this sign-in>",  // recommended, replay guard
  "fullName": "Display Name"      // optional; Apple reveals the name only once, outside the token
}
```

Response: the same shape as `POST /api/v1/auth/login` —
`{ user, access_token, token_type: "Bearer", expires_in, refresh_token, token }`
plus the `auth_token`/`refresh_token` cookies for webview shells. The app keeps
the Bearer tokens and sends `Authorization: Bearer <access_token>`.

### Verification the app cannot bypass

The `idToken` arrives from the wire, so Core signature-verifies it against the
provider JWKS before any account is touched:

- **Apple** (`apple-auth`): ES256, JWKS `https://appleid.apple.com/auth/keys`,
  `iss=https://appleid.apple.com`, `aud` = the configured **bundle ID**,
  `email_verified` = `"true"`, optional `nonce` equality.
- **Google** (`google-auth`): RS256, JWKS
  `https://www.googleapis.com/oauth2/v3/certs`,
  `iss=https://accounts.google.com`, `aud` = the configured **Android or iOS
  client ID** (`androidClientId` / `iosClientId` in the google-auth plugin
  settings — the web client ID is NOT an accepted app audience).
- **Facebook** (`facebook-auth`): RS256/ES256 per JWKS
  `https://www.facebook.com/.well-known/jwks.json`,
  `iss=https://facebook.com`, `aud` = the App ID.

### Nonce flow (recommended)

1. The app generates a random nonce per sign-in attempt and keeps it locally.
2. The app passes the same nonce into the provider SDK request.
3. The returned id_token carries the nonce inside its claims; the app posts
   the nonce together with the token — a mismatch, or reuse of an old token
   pair, is rejected (`IDENTITY_REJECTED`).

### Configuration

Everything is configured in the admin plugin settings (no env vars on the
worker itself): `google-auth` (web client + optional android/ios client IDs),
`facebook-auth` (app ID + app secret), `apple-auth` (Services ID, team ID,
key ID, .p8 private key, optional bundle ID). Disabling a provider in the
admin makes `POST /identity/native` answer `503 IDENTITY_UNAVAILABLE` for it
immediately. Errors: `400 IDENTITY_REJECTED` (token failed verification),
`409 IDENTITY_EMAIL_IN_USE` (an account already owns the email; link from
account settings instead), `429 IDENTITY_RATE_LIMITED`.

The legacy `/api/auth/google` and `/api/auth/apple` paths in this runbook's
acceptance list are superseded by `POST /api/v1/auth/identity/native`; treat
the identity route as the contract and the old paths as removed.

## Acceptance Criteria

Production is ready for the Android MVP only when all of these are true:

- `GET /api/products?type=esim&country=JP&page=1&limit=12` returns public eSIM plans.
- `POST /api/v1/auth/identity/native` is routed and rejects invalid tokens with `400 IDENTITY_REJECTED` (never 404/500).
- Google and Apple real tokens exchange for BOKMOO sessions in app QA.
- `POST /api/orders` creates an eSIM order with `expectedTotal`, `currency`, and `paymentMethodId`.
- native payment confirmation or Stripe webhook marks the order paid.
- `POST /api/payment-methods` stores only provider-tokenized payment details in production.
- `order.paid` reaches `bokmoo-connect` with a valid signature.
- the fulfillment provider returns real LPA/SM-DP+/activation payloads, or Jiffoo sends those fields in the webhook.
- `install-session` returns activation payload only for the owning user with a verified BOKMOO card.
- `install-complete` writes card/profile trace.
- support endpoints require explicit support scopes.

## Rollback Notes

If the API code must be rolled back:

- keep core and plugin migrations in place
- disable the `bokmoo-connect` plugin instance only if app traffic must stop
- do not delete card, profile, fulfillment, or support-ticket tables
- keep `allowMockFulfillment=false` in production
