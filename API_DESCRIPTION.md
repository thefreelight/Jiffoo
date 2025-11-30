# Jiffoo Mall Backend API Reference

**Version**: 1.0.0 | **Docs**: 2.6.0 | **Updated**: 2025-10-14
**Tech Stack**: Fastify 4.24+, TypeScript 5.8+, PostgreSQL, Prisma 6.16+, Redis, JWT, Stripe, Resend
**Architecture**: Multi-tenant SaaS with complete tenant isolation
**Total Endpoints**: 140 production-ready endpoints (including Unified Payment Gateway + Stripe Payment Plugin + Resend Email Plugin + Admin/Super-Admin Plugin Management)
---

## Authentication
All protected endpoints require JWT Bearer token:
```
Authorization: Bearer <jwt-token>
```
**Roles**: `USER`, `TENANT_ADMIN`, `SUPER_ADMIN`  
**Multi-tenant**: Use `x-tenant-id` header for login/register (tenantId=0 for super admin)
---

## API Endpoints

### Authentication (`/api/auth`) - 5 endpoints
- `POST /api/auth/register` - User registration (OAuth2 response) [Public, requires x-tenant-id]
- `POST /api/auth/login` - User login (OAuth2 response) [Public, requires x-tenant-id]
- `GET /api/auth/me` - Get current user profile [Auth]
- `POST /api/auth/refresh` - Refresh access token [Public]
- `POST /api/auth/logout` - User logout [Auth]

### User Account (`/api/account`) - 2 endpoints
- `GET /api/account/profile` - Get personal profile [Auth]
- `PUT /api/account/profile` - Update personal profile (username, avatar) [Auth]

### Admin User Management (`/api/admin/users`) - 6 endpoints
- `GET /api/admin/users` - List users in tenant (pagination, search, role filter) [Tenant Admin]
- `GET /api/admin/users/:id` - Get user details [Tenant Admin]
- `PUT /api/admin/users/:id` - Update user info [Tenant Admin]
- `PATCH /api/admin/users/:id/role` - Update user role [Tenant Admin]
- `POST /api/admin/users/batch` - Batch operations (activate, deactivate, delete, updateRole) [Tenant Admin]
- `DELETE /api/admin/users/:id` - Delete user [Tenant Admin]

### Super Admin User Management (`/api/super-admin/users`) - 7 endpoints
- `GET /api/super-admin/users` - List all users across tenants (with tenant filter) [Super Admin]
- `GET /api/super-admin/users/stats` - Get user statistics [Super Admin]
- `GET /api/super-admin/users/:id` - Get user details [Super Admin]
- `PUT /api/super-admin/users/:id` - Update user info [Super Admin]
- `PATCH /api/super-admin/users/:id/role` - Update user role [Super Admin]
- `POST /api/super-admin/users/batch` - Batch operations [Super Admin]
- `DELETE /api/super-admin/users/:id` - Delete user [Super Admin]

### Super Admin Tenant Management (`/api/super-admin/tenants`) - 7 endpoints
- `GET /api/super-admin/tenants/stats` - Get tenant statistics [Super Admin]
- `GET /api/super-admin/tenants` - List all tenants (pagination, search, status filter) [Super Admin]
- `GET /api/super-admin/tenants/:id` - Get tenant details [Super Admin]
- `POST /api/super-admin/tenants` - Create tenant with admin user (atomic) [Super Admin]
- `PUT /api/super-admin/tenants/:id` - Update tenant info [Super Admin]
- `PUT /api/super-admin/tenants/:id/status` - Update tenant status (pending/active/suspended/terminated) [Super Admin]
- `DELETE /api/super-admin/tenants/:id` - Delete tenant (safe deletion) [Super Admin]

### Public Products (`/api/products`) - 3 endpoints
- `GET /api/products` - List products (pagination, search, filters, sorting) [Public]
- `GET /api/products/:id` - Get product details (excludes stock, tenantId) [Public]
- `GET /api/products/categories` - Get product categories with counts [Public]

### Admin Product Management (`/api/admin/products`) - 9 endpoints
- `GET /api/admin/products` - List products in tenant (full info, lowStock filter) [Tenant Admin]
- `GET /api/admin/products/stock/low` - Get low stock products [Tenant Admin]
- `GET /api/admin/products/stock/overview` - Get stock statistics [Tenant Admin]
- `POST /api/admin/products/:id/stock/adjust` - Adjust stock (increase/decrease with reason) [Tenant Admin]
- `GET /api/admin/products/:id` - Get product details [Tenant Admin]
- `POST /api/admin/products` - Create product [Tenant Admin]
- `PUT /api/admin/products/:id` - Update product [Tenant Admin]
- `DELETE /api/admin/products/:id` - Delete product [Tenant Admin]
- `POST /api/admin/products/batch` - Batch operations (delete, updateStock, increaseStock, decreaseStock) [Tenant Admin]

### Super Admin Product Management (`/api/super-admin/products`) - 7 endpoints
- `GET /api/super-admin/products/stats` - Get product statistics [Super Admin]
- `GET /api/super-admin/products` - List all products across tenants [Super Admin]
- `GET /api/super-admin/products/:id` - Get product details [Super Admin]
- `POST /api/super-admin/products` - Create product for any tenant [Super Admin]
- `PUT /api/super-admin/products/:id` - Update product [Super Admin]
- `POST /api/super-admin/products/batch` - Batch operations (updatePrice, updateStock, updateCategory, delete) [Super Admin]
- `DELETE /api/super-admin/products/:id` - Delete product [Super Admin]

### Shopping Cart (`/api/cart`) - 6 endpoints
- `GET /api/cart` - Get user cart (database + Redis cache, 7-day TTL) [Auth Required]
- `POST /api/cart/add` - Add product to cart (stock validation, price snapshot) [Auth Required]
- `PUT /api/cart/update` - Update cart item quantity (0 = remove) [Auth Required]
- `DELETE /api/cart/remove/:itemId` - Remove specific item from cart [Auth Required]
- `DELETE /api/cart/clear` - Clear entire cart (database + cache) [Auth Required]
- `GET /api/cart/stats` - Get cart statistics for tenant [Auth Required]

### User Orders (`/api/orders`) - 3 endpoints
- `POST /api/orders` - Create order from cart (stock deduction) [Auth]
- `GET /api/orders` - List user's orders (pagination) [Auth]
- `GET /api/orders/:id` - Get order details [Auth]

### Unified Payment Gateway (`/api/payments`) - 2 endpoints
**Silent Filtering**: Payment methods automatically filtered based on license, usage limits, and availability
- `GET /api/payments/available-methods` - Get available payment methods (license validation, usage limit check, silent filtering) [Auth Required]
- `POST /api/payments/create-session` - Create payment session (unified gateway routing to plugin endpoints, usage tracking) [Auth Required]

### Admin Order Management (`/api/admin/orders`) - 5 endpoints
- `GET /api/admin/orders` - List orders in tenant (search, status filter) [Tenant Admin]
- `GET /api/admin/orders/:id` - Get order details [Tenant Admin]
- `PATCH /api/admin/orders/:id/status` - Update order status [Tenant Admin]
- `POST /api/admin/orders/batch` - Batch operations [Tenant Admin]
- `GET /api/admin/orders/stats` - Get order statistics [Tenant Admin]

### Super Admin Order Management (`/api/super-admin/orders`) - 5 endpoints
- `GET /api/super-admin/orders` - List all orders across tenants [Super Admin]
- `GET /api/super-admin/orders/:id` - Get order details [Super Admin]
- `PATCH /api/super-admin/orders/:id/status` - Update order status [Super Admin]
- `POST /api/super-admin/orders/batch` - Batch operations [Super Admin]
- `GET /api/super-admin/orders/stats` - Get cross-tenant statistics [Super Admin]

### Stripe Payment Plugin (`/api/plugins/stripe/api`) - 15 endpoints
**Core Payment Features (Free Plan: 1000 API calls, 100 transactions/month)**
- `GET /api/plugins/stripe/api/health` - Plugin health check [Public]
- `POST /api/plugins/stripe/api/create-checkout-session` - Create Stripe Checkout session (inventory reservation 30min, auto stock deduction on success) [Auth Required]
- `GET /api/plugins/stripe/api/verify-session` - Verify payment session status (order sync, payment record retrieval) [Auth Required]
- `POST /api/plugins/stripe/api/webhook` - Stripe webhook handler (9 event types: checkout, subscription, invoice, payment_method; signature verification, auto order/subscription sync, webhook retry mechanism) [Public, Stripe Signature Required]

**Plan Management (All Plans)**
- `GET /api/plugins/stripe/api/plan/current` - Get current plan details (features, limits, usage, subscription, available plans) [Auth Required]
- `POST /api/plugins/stripe/api/plan/upgrade-preview` - Get upgrade cost preview (proration calculation, immediate charge amount, upgrade type) [Auth Required]
- `POST /api/plugins/stripe/api/plan/upgrade` - Upgrade to Business/Enterprise (free→paid: Stripe Checkout; paid→paid: immediate proration; auto usage reset, subscription history tracking) [Auth Required]
- `POST /api/plugins/stripe/api/plan/downgrade` - Downgrade plan (deferred to period end, cancel_at_period_end flag, subscription change tracking) [Auth Required]
- `POST /api/plugins/stripe/api/plan/cancel-downgrade` - Cancel pending downgrade (restore cancel_at_period_end=false, subscription change tracking) [Auth Required]

**Subscription Management (Business Plan+)**
- `POST /api/plugins/stripe/api/subscriptions` - Create Stripe subscription (auto customer creation, payment method attachment, trial support, local record creation) [Auth Required, Business Plan+]
- `GET /api/plugins/stripe/api/subscriptions/:id` - Get subscription details (real-time Stripe sync, invoice history, change history) [Auth Required, Business Plan+]
- `PUT /api/plugins/stripe/api/subscriptions/:id` - Update subscription (plan change with proration, Stripe sync, change tracking) [Auth Required, Business Plan+]
- `DELETE /api/plugins/stripe/api/subscriptions/:id` - Cancel subscription (immediate or deferred, Stripe cancellation, change tracking) [Auth Required, Business Plan+]

**Advanced Features**
- `POST /api/plugins/stripe/api/create-refund` - Create refund (partial/full, reason tracking, auto processing) [Auth Required, Business Plan+]
- `POST /api/plugins/stripe/api/create-installment-plan` - Create installment payment plan (auto calculation, recurring subscription, metadata tracking) [Auth Required, Enterprise Plan]

### Resend Email Plugin (`/api/plugins/resend/api`) - 11 endpoints
**Core Email Features (Free Plan: 100 emails, 500 API calls/month)**
- `GET /api/plugins/resend/api/health` - Plugin health check [Public]
- `POST /api/plugins/resend/api/send` - Send single email (usage limits: 100 emails/month, 500 API calls/month) [Auth Required]
- `POST /api/plugins/resend/api/send-batch` - Send batch emails (usage limits: 100 emails/month, 500 API calls/month) [Auth Required, Business Plan]
- `GET /api/plugins/resend/api/status/:messageId` - Get email delivery status [Auth Required]
- `GET /api/plugins/resend/api/capabilities` - Get plugin capabilities and configuration [Auth Required]
- `POST /api/plugins/resend/api/webhook` - Resend webhook handler (email status updates: delivered, opened, clicked, bounced) [Public, Svix Signature Required - TODO]

**Plan Management (All Plans)**
- `GET /api/plugins/resend/api/plan/current` - Get current plan details (features, limits, usage, subscription, available plans, pending changes) [Auth Required]
- `POST /api/plugins/resend/api/plan/upgrade-preview` - Get upgrade cost preview (proration calculation, immediate charge amount, upgrade type) [Auth Required]
- `POST /api/plugins/resend/api/upgrade` - Upgrade to Business/Enterprise (free→paid: Stripe Checkout; paid→paid: Stripe Checkout; auto usage reset, subscription history tracking) [Auth Required]
- `POST /api/plugins/resend/api/downgrade` - Downgrade plan (paid→free: deferred to period end; paid→paid: immediate with proration; subscription change tracking) [Auth Required]
- `POST /api/plugins/resend/api/cancel-downgrade` - Cancel pending downgrade (restore cancel_at_period_end=false, subscription change tracking) [Auth Required]

### File Upload (`/api/upload`) - 4 endpoints
- `POST /api/upload/product-image` - Upload product image (5MB max, JPEG/PNG/WebP) [Tenant Admin]
- `POST /api/upload/avatar` - Upload user avatar [Auth]
- `DELETE /api/upload/file/:filename` - Delete uploaded file [Tenant Admin]
- `GET /api/upload/image-url/:filename` - Get image URL [Public]

### Cache Management (`/api/cache`) - 6 endpoints
- `GET /api/cache/stats` - Get cache statistics (Redis keys count) [Tenant Admin]
- `GET /api/cache/health` - Cache health check [Tenant Admin]
- `DELETE /api/cache/products` - Clear product cache [Tenant Admin]
- `DELETE /api/cache/search` - Clear search cache [Tenant Admin]
- `DELETE /api/cache/key/:key` - Delete specific cache key [Tenant Admin]
- `GET /api/cache/key/:key` - Get cache value [Tenant Admin]

### Admin Plugin Management (`/api/admin/plugins`) - 15 endpoints
**Plugin Discovery & Installation**
- `GET /api/admin/plugins/marketplace` - List available plugins in marketplace (with installation status, subscription plans) [Tenant Admin]
- `GET /api/admin/plugins/marketplace/search` - Search plugins by keyword with category filter [Tenant Admin]
- `GET /api/admin/plugins/marketplace/:slug` - Get plugin details from marketplace (features, pricing, plans, installation status) [Tenant Admin]
- `GET /api/admin/plugins/categories` - Get all plugin categories with counts [Tenant Admin]
- `POST /api/admin/plugins/:slug/install` - Install plugin (with plan selection, trial option, subscription creation) [Tenant Admin]
- `DELETE /api/admin/plugins/:slug/uninstall` - Uninstall plugin and cancel subscriptions [Tenant Admin]

**Installed Plugin Management**
- `GET /api/admin/plugins/installed` - List installed plugins (with status, subscription info, usage stats) [Tenant Admin]
- `GET /api/admin/plugins/installed/:slug` - Get installed plugin details (configuration, status, subscription) [Tenant Admin]
- `GET /api/admin/plugins/:slug/config` - Get plugin configuration [Tenant Admin]
- `PUT /api/admin/plugins/:slug/config` - Update plugin configuration [Tenant Admin]
- `PATCH /api/admin/plugins/:slug/toggle` - Enable or disable plugin [Tenant Admin]
- `GET /api/admin/plugins/installed/:slug/usage` - Get plugin usage statistics [Tenant Admin]
- `GET /api/admin/plugins/installed/:slug/subscription` - Get plugin subscription details (current plan, usage, limits, subscription history with usage data, available plans, pending changes) [Tenant Admin]
- `POST /api/admin/plugins/installed/:slug/upgrade` - Upgrade plugin plan (free→paid requires Stripe Checkout, paid→paid immediate with proration) [Tenant Admin]
- `POST /api/admin/plugins/installed/:slug/verify-checkout` - Verify Stripe Checkout session after payment [Tenant Admin]

### Super Admin Plugin Management (`/api/super-admin/plugins`) - 20 endpoints 
**Global Plugin Statistics**
- `GET /api/super-admin/plugins/stats` - Get global plugin statistics (total plugins, installations, revenue, top plugins) [Super Admin]
- `GET /api/super-admin/plugins/plugin-usage-overview` - Get plugin usage across all tenants (custom pricing count, tenant modes) [Super Admin]

**Plugin-Specific Statistics**
- `GET /api/super-admin/plugins/:pluginSlug/stats` - Get specific plugin statistics (installations, subscriptions, revenue by plan) [Super Admin]
- `GET /api/super-admin/plugins/:pluginSlug/tenants/:tenantId` - Get tenant plugin details (subscription, usage, customizations) [Super Admin]

**Subscription Management (Plugin-Scoped)**
- `GET /api/super-admin/plugins/subscriptions` - List all subscriptions across plugins (pagination, filtering) [Super Admin]
- `GET /api/super-admin/plugins/:pluginSlug/subscriptions` - List plugin subscriptions (pagination, status filter, tenant filter) [Super Admin]
- `POST /api/super-admin/plugins/:pluginSlug/tenants/:tenantId/subscriptions` - Manually create subscription for tenant [Super Admin]
- `GET /api/super-admin/plugins/:pluginSlug/subscriptions/:id` - Get subscription details (tenant, plugin, invoices, changes, events) [Super Admin]
- `PUT /api/super-admin/plugins/:pluginSlug/subscriptions/:id/status` - Update subscription status (active/canceled/paused, reason tracking) [Super Admin]
- `PUT /api/super-admin/plugins/:pluginSlug/subscriptions/:id/usage` - Update subscription usage (set/reset API calls and transactions) [Super Admin]

**Subscription Plan Management (Plugin-Scoped)** 
- `GET /api/super-admin/plugins/:pluginSlug/plans` - List plugin subscription plans (with active subscriptions and revenue stats) [Super Admin]
- `POST /api/super-admin/plugins/:pluginSlug/plans` - Create subscription plan (pricing, features, limits, trial days, auto-sync to Plugin.pricing) [Super Admin]
- `PUT /api/super-admin/plugins/:pluginSlug/plans/:planId` - Update subscription plan (pricing, features, limits, auto-sync to Plugin.pricing) [Super Admin]
- `DELETE /api/super-admin/plugins/:pluginSlug/plans/:planId` - Delete subscription plan (validates no active subscriptions, auto-sync to Plugin.pricing) [Super Admin]

**Tenant Customization (Plugin-Scoped)**
- `POST /api/super-admin/plugins/:pluginSlug/tenants/:tenantId/custom-pricing` - Create custom pricing for VIP tenant (features, limits, validity period) [Super Admin]
- `POST /api/super-admin/plugins/:pluginSlug/tenants/:tenantId/feature-overrides` - Set feature override (force enable/disable specific features) [Super Admin]
- `GET /api/super-admin/plugins/:pluginSlug/tenants/:tenantId/subscription-history` - Get tenant subscription history with usage data [Super Admin]
- `POST /api/super-admin/plugins/:pluginSlug/tenants/:tenantId/usage-overrides` - Create usage override (temporary limit increase, validity period) [Super Admin]
- `GET /api/super-admin/plugins/:pluginSlug/tenants/:tenantId/usage-overrides` - List tenant usage overrides [Super Admin]
- `DELETE /api/super-admin/plugins/:pluginSlug/tenants/:tenantId/usage-overrides/:id` - Delete usage override [Super Admin]

### System (`/health`, `/`) - 2 endpoints
- `GET /health` - System health check (database, Redis, disk, memory) [Public]
- `GET /` - API discovery (list all endpoints) [Public]

---

## Key Features

**Multi-tenancy**: Complete data isolation via tenantId, automatic filtering in all queries
**Authentication**: JWT with OAuth2 standard, access/refresh tokens, 15min/7day expiry
**Authorization**: RBAC with 3 roles (USER, TENANT_ADMIN, SUPER_ADMIN)
**Caching**: Redis for cart (7-day), products, search results
**Stock Management**: Real-time validation, audit trails, batch operations
**Plugin System**:
  - Admin: Plugin marketplace, installation lifecycle, subscription management with historical usage tracking
  - Super Admin: Plugin-centric API design, custom pricing, feature overrides, usage limits, tenant-specific customizations
**Subscriptions**: Full billing cycle, MRR/churn analytics, trial periods, plan management, status tracking, subscription history with usage data per subscription
**Payment Processing**:
  - Unified Payment Gateway: Plugin-based architecture with automatic routing, silent filtering, usage tracking
  - Silent Filtering: Payment methods automatically hidden when usage limits reached (no error messages to end users)
  - Stripe integration with 3-tier pricing (Free/Business/Enterprise), usage-based limits, proration upgrades
  - Multi-payment support: Extensible architecture for Stripe, PayPal, Alipay, WeChat Pay
**Email Service**:
  - Resend Email Plugin: Dual-mode support (Platform-Provided/BYOK), unified email gateway with smart routing
  - 3-tier pricing: Free (100 emails/month), Business (10K emails/month), Enterprise (unlimited)
  - Usage tracking: emails_sent, api_calls metrics with automatic period reset
  - Webhook support: Email status tracking (delivered, opened, clicked, bounced) with Svix signature verification
  - Self-service upgrade: Stripe Checkout integration for seamless plan upgrades
**Commercial SaaS**: License validation, usage tracking, automatic period reset, deadlock prevention (upgrade always available)
**Security**: bcrypt passwords, SQL injection protection (Prisma), input validation (Zod), rate limiting, Stripe webhook signature verification

---

## Database Schema

**Core**: User, Tenant, Product, Order, OrderItem, Payment
**Plugin**: Plugin, PluginInstallation, PluginUsage, TenantCustomPricing, TenantFeatureOverride, TenantUsageOverride
**Subscription**: Subscription, SubscriptionPlan, SubscriptionChange, SubscriptionEvent, SubscriptionInvoice
**System**: AuditLog, PriceControl, TenantPricing
**Payment Integration**: Payment table with pluginId field for multi-payment provider support (sessionId, paymentIntentId, stripeSubscriptionId for Stripe)

**Total**: 26+ tables with full relationships and indexes

---

## Notes

- All endpoints return consistent JSON: `{ success: boolean, data?: any, message?: string, error?: string }`
- Pagination format: `{ page, limit, total, totalPages }`
- All amounts in minor currency units (cents for USD, yen for JPY)
- Tenant isolation enforced at middleware level
- Route order matters: `/stats` must be registered before `/:id` to avoid conflicts
- Cart requires authentication (login-only), database + Redis hybrid storage
- All operations logged to AuditLog for compliance
- **Admin Plugin Management**:
  - Marketplace: Browse available plugins with installation status and subscription plans
  - Installation: One-click install with plan selection (free/paid), optional trial period
  - Subscription Management: View current plan, usage limits, subscription history with per-subscription usage data
  - Subscription History: Each historical subscription includes usage data (API calls, transactions) during that subscription period
  - Upgrade Flow: Free→Paid requires Stripe Checkout payment, Paid→Paid immediate with proration
  - Usage Tracking: Period format `subscriptionId:date` for accurate historical usage tracking
- **Unified Payment Gateway**:
  - Architecture: Plugin-based with automatic routing to payment provider endpoints
  - Silent Filtering: Payment methods automatically filtered based on:
    * License validation (plugin installed and active)
    * Usage limits (API calls and transactions per period)
    * Feature access (plan-based feature checks)
  - End-user experience: Payment methods simply don't appear when unavailable (no error messages)
  - Usage tracking: API calls recorded on session creation, transactions recorded on payment success
  - Double verification: Limits checked in both available-methods and create-session endpoints
  - Internal routing: Uses `fastify.inject()` to route requests to plugin endpoints
  - Fixed ordering: Payment methods displayed in consistent order (Stripe > PayPal > Alipay > WeChat)
- **Stripe Plugin**:
  - Free Plan: 1000 API calls/month, 100 transactions/month
  - Business Plan: 10000 API calls/month, 1000 transactions/month, refunds enabled
  - Enterprise Plan: Unlimited API calls/transactions, installment payments enabled
  - Usage resets: Free (monthly), Paid (subscription period), lazy-loaded on API call
  - Proration: Paid→Paid upgrades immediate, Free→Paid requires Checkout
  - Webhook events: `checkout.session.completed`, `customer.subscription.*`, `invoice.payment_*`
  - Upgrade endpoint (`/plan/upgrade`) exempt from usage limits to prevent deadlock
- **Resend Email Plugin**:
  - Free Plan: 100 emails/month, 500 API calls/month
  - Business Plan: 10000 emails/month, 50000 API calls/month, batch email enabled
  - Enterprise Plan: Unlimited emails/API calls, batch email enabled
  - Dual-mode support: Platform-Provided (shared credentials) vs BYOK (tenant-specific API key)
  - Unified email gateway: Smart routing with automatic failover between providers
  - Usage tracking: emails_sent, api_calls metrics with lazy-loaded period reset
  - Upgrade flow: Free→Paid/Paid→Paid both use Stripe Checkout (no proration for simplicity)
  - Downgrade flow: Paid→Free deferred to period end (cancel_at_period_end), Paid→Paid immediate with proration
  - Webhook events: `email.sent`, `email.delivered`, `email.opened`, `email.clicked`, `email.bounced`
  - Webhook signature: Svix-based verification (marked as TODO, optional for MVP)
  - Upgrade/Downgrade endpoints exempt from usage limits to prevent deadlock
  - Integration: Used for registration verification emails (6-digit code, 10min expiry, Redis storage)