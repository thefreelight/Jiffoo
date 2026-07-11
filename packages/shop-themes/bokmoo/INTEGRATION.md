# Bokmoo Theme Integration

This document explains what the Bokmoo storefront theme expects from the host application and how it maps to the Bokmoo backend API contract.

## Version

- Theme slug: `bokmoo`
- Current reset baseline: `0.0.1`

## Architecture

Bokmoo theme should remain presentation-focused.

Recommended flow:

1. Theme renders catalog, product detail, checkout, success, install, help, and legal pages.
2. Jiffoo owns cart and payment unless the host intentionally bypasses Jiffoo checkout.
3. Bokmoo backend owns fulfillment allocation and install-session generation.
4. Theme reads Bokmoo fulfillment data and displays it.

Do not put eSIM allocation logic inside the theme.

## Config the Host Should Provide

Bokmoo theme currently reads these values from `config.site`:

- `eyebrow`
- `headline`
- `subheadline`
- `primaryCtaLabel`
- `primaryCtaHref`
- `secondaryCtaLabel`
- `secondaryCtaHref`
- `supportEmail`
- `apiBaseUrl`

Recommended environment values:

- production: `https://api.bokmoo.com`
- staging: `https://staging-api.bokmoo.com`
- local: `http://localhost:<port>`

If `apiBaseUrl` is not provided, the theme defaults to production.

## Current Bokmoo API Adapter

File:

- [api.ts](/Users/jordan/Projects/jiffoo-extensions-official/packages/shop-themes/bokmoo/src/lib/api.ts)

Current exported helpers:

- `getBokmooProducts`
- `getBokmooProduct`
- `getBokmooOrders`
- `getBokmooOrder`
- `getBokmooInstallSession`
- `mapBokmooApiProductToThemeProduct`
- `mapBokmooApiOrderToThemeOrder`
- `normalizeProductForTheme`
- `normalizeInstallSession`
- `getProductIdFromLocation`
- `getOrderIdFromLocation`

## What the Host Must Supply

### Catalog pages

Two supported models exist:

1. Host passes Jiffoo product objects into theme components.
2. Theme falls back to Bokmoo API when product props are empty.

Current fallback behavior:

- `ProductsPage` can self-load `/api/products`
- `ProductDetailPage` can self-load `/api/products/:id` if it can infer a product id from the URL
- Product list pagination reads the wrapped response `meta.total` when the API provides it
- Product list supports client-side `All`, `Popular`, `Local`, `Regional`, and `Global` filters for the current result page

Recommended host behavior:

- Prefer SSR/Jiffoo-driven product props when available
- Keep product ids and variant ids aligned with Bokmoo backend contract

### Order success / install page

The theme needs an order id.

Current lookup order:

1. `order?.id` passed as prop
2. `orderId` query param
3. `id` query param
4. `/orders/:id` path segment

Recommended host behavior:

- On success redirect, include `?orderId=<id>`
- If available, also pass an `order` object with `id`

### Order detail page

Current lookup order:

1. `order` prop
2. `orderId` query param
3. `id` query param
4. `/orders/:id` path segment

### Orders page

Current behavior:

- Host-provided `orders` are used first.
- If `orders` is empty, the theme can self-load `GET /api/orders?page=<page>&limit=10`.
- Returned Bokmoo orders are mapped with `mapBokmooApiOrderToThemeOrder`.
- Auth is required for this fallback unless the host proxies customer/session context.

### Auth token

Current adapter behavior:

1. explicit `token` in adapter config if caller provides one
2. browser `localStorage.auth_token`
3. `auth_token` cookie

Recommended host behavior:

- Prefer a host-side proxy/BFF for customer/order endpoints
- If direct browser access is used, provide a session-derived bearer token consistently

## Current Install Session Support

Files:

- [OrderSuccessPage.tsx](/Users/jordan/Projects/jiffoo-extensions-official/packages/shop-themes/bokmoo/src/components/OrderSuccessPage.tsx)
- [OrderDetailPage.tsx](/Users/jordan/Projects/jiffoo-extensions-official/packages/shop-themes/bokmoo/src/components/OrderDetailPage.tsx)
- [InstallSessionPanel.tsx](/Users/jordan/Projects/jiffoo-extensions-official/packages/shop-themes/bokmoo/src/components/InstallSessionPanel.tsx)

Current behavior:

- Order success page polls `GET /api/orders/:id/install-session`
- Poll schedule:
  - every 3s for early attempts
  - every 10s after that
  - stops after timeout and shows retry/support state
- Order detail page:
  - fetches install session when possible
  - also normalizes fulfillment-like fields already embedded in order items
- Fulfillment aliases from mobile contracts are supported, including:
  - `activation_code`
  - `matching_id`
  - `qr_code`
  - `qrCodeContent`
  - `lpa_string`
  - `smdp_address`
  - `supportEmail`
  - `supportPhone`
- UI renders:
  - `smdpAddress`
  - `matchingId`
  - `activationCode`
  - `confirmationCode`
  - `lpaString`
  - iOS / Android / general instructions
  - support email / phone

## Sensitive Fields

The following fields are treated as sensitive and should not be logged to analytics or public caches:

- `activationCode`
- `matchingId`
- `confirmationCode`
- `lpaString`
- `qrCode`

Theme expectation:

- These fields appear only after payment success
- Install pages should use no-store behavior when server-rendered

## Recommended Next Host Tasks

To complete the integration cleanly, the host should do these next:

1. Provide a stable `apiBaseUrl` into Bokmoo theme config.
2. Ensure success page URL includes `orderId`.
3. Decide whether customer/order calls go through:
   - browser -> Bokmoo API directly
   - browser -> Jiffoo BFF -> Bokmoo API
4. Ensure customer auth token is available in one stable place.
5. Keep product ids and variant ids consistent across Jiffoo and Bokmoo.

## Current Theme Status

Implemented:

- product object normalization
- catalog fallback loading
- product detail fallback loading
- install-session polling and display
- fulfillment alias normalization

Not fully complete yet:

- a formal host-side BFF contract
- explicit token injection strategy
- server-rendered no-store install page behavior
- fully Bokmoo-native checkout bypass flow
