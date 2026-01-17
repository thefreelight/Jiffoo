# API Core Endpoint Overview

This document lists the **Core API** HTTP endpoints available in the open-source scope, grouped by feature area.
**Source of Truth**: Generated from `apps/api/openapi.json` (OpenAPI 3.0.3).

## Conventions

- **Base URL**: `http(s)://<host>:<port>`
- **Auth (end-user/admin)**: `Authorization: Bearer <JWT>`

- **Swagger UI**: `GET /docs`

---

## System

- `GET /` — API root metadata and quick links.
- `GET /health` — Full health check (DB/Redis/plugins).
- `GET /health/live` — Liveness probe.
- `GET /health/ready` — Readiness probe.
- `GET /docs` — Interactive API documentation (Swagger UI).
- `GET /success` — Payment success redirect.
- `GET /cancel` — Payment cancel redirect.

## Install

- `GET /api/install/status` — Check whether the system is installed.
- `GET /api/install/check-database` — Verify database connectivity.
- `POST /api/install/complete` — Finish installation (creates initial admin + basic config).

## Upgrade

- `GET /api/upgrade/version` — Get current version info.
- `POST /api/upgrade/check` — Check compatibility with a target version.
- `GET /api/upgrade/status` — Get upgrade progress/status.
- `POST /api/upgrade/backup` — Create an upgrade backup.
- `POST /api/upgrade/perform` — Run an upgrade to a target version.
- `POST /api/upgrade/rollback` — Roll back using a backup ID.

## Auth

- `POST /api/auth/register` — Register a new user.
- `POST /api/auth/login` — Login and obtain tokens.
- `GET /api/auth/me` — Get the current authenticated user.
- `POST /api/auth/refresh` — Refresh the access token.
- `POST /api/auth/logout` — Logout (client-side token removal).
- `POST /api/auth/change-password` — Change the current user password.

## Account

- `GET /api/account/profile` — Get current user profile.
- `PUT /api/account/profile` — Update current user profile.

## Admin Management (Users)

- `GET /api/admin/users/` — Get users list (search, limit, page).
- `POST /api/admin/users/` — Create user (admin).
- `GET /api/admin/users/:id` — Get user by ID.
- `PUT /api/admin/users/:id` — Update user.
- `DELETE /api/admin/users/:id` — Delete user.
- `POST /api/admin/users/:id/reset-password` — Reset user password.

## Admin Management (Products)

- `GET /api/admin/products/` — Get products list (search, category, price, etc.).
- `POST /api/admin/products/` — Create product.
- `GET /api/admin/products/:id` — Get product by ID.
- `PUT /api/admin/products/:id` — Update product.
- `DELETE /api/admin/products/:id` — Delete product.
- `GET /api/admin/products/categories` — Get product categories (admin).

## Admin Management (Orders)

- `GET /api/admin/orders/` — Get orders list (status, page).
- `GET /api/admin/orders/:id` — Get order by ID.
- `PUT /api/admin/orders/:id/status` — Update order status.
- `GET /api/admin/orders/stats` — Get order statistics.
- `POST /api/admin/orders/:id/ship` — Ship order with tracking info.
- `POST /api/admin/orders/:id/refund` — Refund order (full or partial).
- `POST /api/admin/orders/:id/cancel` — Cancel order.

## Catalog (Public)

- `GET /api/products/` — List products (filters/pagination).
- `GET /api/products/:id` — Get a single product by ID.
- `GET /api/products/categories` — List product categories.
- `GET /api/products/search` — Search products by keyword.

## Cart

- `GET /api/cart/` — Get current user cart.
- `DELETE /api/cart/` — Clear the cart.
- `POST /api/cart/items` — Add an item to the cart.
- `PUT /api/cart/items/:itemId` — Update a cart item quantity.
- `DELETE /api/cart/items/:itemId` — Remove an item from the cart.

## Orders

- `POST /api/orders/` — Create an order from cart/items + shipping address.
- `GET /api/orders/` — List current user orders.
- `GET /api/orders/:id` — Get a single order.
- `POST /api/orders/:id/cancel` — Cancel an order (current user only).

## Payments

- `GET /api/payments/available-methods` — List available payment methods.
- `POST /api/payments/create-session` — Create a payment session for an order.
- `GET /api/payments/verify/:sessionId` — Verify a payment session.
- `POST /api/payments/stripe/webhook` — Stripe webhook receiver.

## Uploads

- `POST /api/upload/product-image` — Upload a product image.
- `POST /api/upload/avatar` — Upload user avatar.
- `DELETE /api/upload/file/:filename` — Delete an uploaded file.
- `GET /api/upload/image-url/:filename` — Get image URL by size.

## Themes

### Public
- `GET /api/themes/active` — Get currently active theme.
- `GET /api/themes/installed` — List installed themes.

### Admin
- `GET /api/admin/themes/` — List installed themes (admin).
- `GET /api/admin/themes/active` — Get active theme (admin).
- `POST /api/admin/themes/:slug/activate` — Activate a theme.
- `POST /api/admin/themes/rollback` — Roll back to previous theme.
- `PUT /api/admin/themes/config` — Update theme configuration.

## Plugins

### Public
- `GET /api/plugins/` — List locally installed plugins.
- `GET /api/plugins/:slug` — Get details for a locally installed plugin.

### Admin
- `GET /api/admin/plugins/` — Get installed plugins list.
- `GET /api/admin/plugins/installed` — Get installed plugins list (alias).
- `GET /api/admin/plugins/categories` — List plugin categories.
- `get /api/admin/plugins/:slug` — Get plugin state.
- `POST /api/admin/plugins/:slug/install` — Install a plugin.
- `POST /api/admin/plugins/:slug/enable` — Enable a plugin.
- `POST /api/admin/plugins/:slug/disable` — Disable a plugin.
- `PUT /api/admin/plugins/:slug/config` — Update plugin configuration.

### Marketplace (Admin)
- `GET /api/admin/plugins/marketplace` — List marketplace plugins.
- `GET /api/admin/plugins/marketplace/search` — Search marketplace plugins.
- `GET /api/admin/plugins/marketplace/:slug` — Get marketplace plugin details.

## Extensions (Offline ZIP Installer)

`kind` is one of: `theme-shop`, `theme-admin`, `plugin`.

- `POST /api/extensions/:kind/install` — Install an extension from a ZIP upload.
- `DELETE /api/extensions/:kind/:slug` — Uninstall an extension.
- `GET /api/extensions/:kind` — List installed extensions.
- `GET /api/extensions/:kind/:slug` — Get installed extension details.

## Store Context

- `GET /api/mall/context` — Get store context (theme + locale + currency).

## Cache (Admin)

- `GET /api/cache/health` — Cache Health Check.

## Logging (Frontend Observability)

- `POST /api/logs/batch` — Batch receive frontend logs.
- `GET /api/logs/health` — Log system health check.
- `POST /api/logs/alerts/:id/resolve` — Resolve alert.


