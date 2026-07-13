# Admin RBAC Design for OSS

## Summary

The current admin authorization model is binary:

- storefront users use `User.role = 'USER'`
- admin users use `User.role = 'ADMIN'`
- API admin routes gate on `requireAdmin`
- admin frontend gates on `user.role === 'ADMIN'`

That works for a single super-admin, but it does not scale to a real back-office team.

This document defines a role-based access control model for the open-source, single-merchant version of Jiffoo that:

- keeps the OSS deployment model simple
- does not reintroduce multi-tenant complexity
- separates customer identity from admin access
- supports route-level authorization in the API
- supports menu/page/action gating in the admin frontend

## Current State

### What exists today

- `apps/api/src/core/auth/middleware.ts`
  `authMiddleware()` populates `request.user`, but permissions are effectively `['*']` for `ADMIN` and `[]` for everyone else.
- `apps/api/src/core/auth/middleware.ts`
  `requireAdmin()` checks only `request.user.role !== 'ADMIN'`.
- `apps/api/src/core/admin/**/routes.ts`
  Admin route modules use `authMiddleware + requireAdmin` as a blanket check.
- `apps/admin/components/auth/ProtectedRoute.tsx`
  Admin UI access is gated by `user.role === 'ADMIN'`.
- `apps/admin/app/[locale]/customers/page.tsx`
  Customer listing logic assumes storefront customers are the users whose role is `USER`.

### Why the current model will break

If we add more admin roles directly into `User.role`, we immediately create ambiguity:

- is `User.role` describing storefront identity or admin access?
- should a support user still appear as a customer in customer management?
- how do we support users who are both customers and back-office staff?
- how do we grant one-off permissions without inventing many ad hoc roles?

## Goals

- Support multiple admin roles in OSS without multi-store complexity.
- Keep storefront customer accounts and admin staff access logically separate.
- Allow route-level and action-level permissions.
- Keep the first rollout small enough to ship safely.
- Preserve backward compatibility during migration.

## Non-Goals

- No return to tenant-level RBAC for OSS.
- No per-store membership matrix in phase 1.
- No policy language or external authorization service.
- No field-level permission engine in phase 1.

## Recommended Data Model

### Recommendation

Do not overload `User.role` with all admin semantics.

Keep `User` as the canonical account record, and add a dedicated admin-access record for users who can enter the admin workspace.

### Proposed Prisma model

```prisma
model AdminMembership {
  id                String   @id @default(cuid())
  userId            String   @unique
  role              String
  status            String   @default("ACTIVE")
  isOwner           Boolean  @default(false)
  customPermissions Json?
  createdByUserId   String?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([role])
  @@index([status])
  @@map("admin_memberships")
  @@schema("public")
}
```

### Why this is better than adding `adminRole` directly to `User`

- A user can be a storefront customer and an admin staff member at the same time.
- Customer listing can continue to reason about customers without mixing in staff roles.
- Admin access can be disabled without mutating the core customer identity model.
- The migration path is cleaner: existing `ADMIN` users become `AdminMembership` rows.

### Transition compatibility

During rollout, we can keep `User.role` unchanged and interpret it like this:

- `USER` means a storefront account
- legacy `ADMIN` means a storefront account that must be migrated to `AdminMembership`

After migration, API and frontend authorization should stop using `User.role` for admin gating.

## Permission Model

### Permission naming

Permissions should be resource-action strings:

- `dashboard.read`
- `customers.read`
- `customers.write`
- `customers.credentials.reset`
- `staff.read`
- `staff.write`
- `products.read`
- `products.write`
- `products.source.ack`
- `orders.read`
- `orders.write`
- `orders.refund`
- `inventory.read`
- `inventory.write`
- `inventory.forecast`
- `themes.read`
- `themes.write`
- `plugins.read`
- `plugins.write`
- `market.read`
- `market.install`
- `platformConnection.read`
- `platformConnection.write`
- `store.read`
- `store.write`
- `settings.read`
- `settings.write`
- `health.read`
- `webhooks.read`
- `webhooks.write`
- `catalogImport.run`

### Default OSS admin roles

Recommended default roles for OSS:

1. `OWNER`
   Full access. This is the bootstrap role and the only role that can manage other staff permissions.

2. `ADMIN`
   Broad back-office access, but not owner-only governance actions.

3. `CATALOG_MANAGER`
   Products, inventory read, themes read, promotions-oriented content work.

4. `OPERATIONS_MANAGER`
   Orders, inventory, fulfillment, customer service workflows.

5. `SUPPORT_AGENT`
   Customer and order visibility with limited write capabilities.

6. `ANALYST`
   Read-only access to dashboards, orders, customers, products, and health.

### Default role matrix

`OWNER`

- all permissions

`ADMIN`

- all operational permissions except owner-only staff governance

`CATALOG_MANAGER`

- `dashboard.read`
- `products.read`
- `products.write`
- `products.source.ack`
- `inventory.read`
- `themes.read`
- `themes.write`
- `market.read`

`OPERATIONS_MANAGER`

- `dashboard.read`
- `customers.read`
- `customers.write`
- `orders.read`
- `orders.write`
- `orders.refund`
- `inventory.read`
- `inventory.write`
- `inventory.forecast`
- `health.read`

`SUPPORT_AGENT`

- `dashboard.read`
- `customers.read`
- `customers.write`
- `customers.credentials.reset`
- `orders.read`
- `orders.write`

`ANALYST`

- `dashboard.read`
- `customers.read`
- `products.read`
- `orders.read`
- `inventory.read`
- `themes.read`
- `plugins.read`
- `market.read`
- `health.read`

## API Design

### New authenticated admin context

Extend the auth payload and Fastify request shape to include a dedicated admin access object:

```ts
interface AuthenticatedAdminAccess {
  role: AdminRole;
  permissions: AdminPermission[];
  isOwner: boolean;
  status: 'ACTIVE' | 'SUSPENDED';
}
```

`request.user` should eventually look like:

```ts
{
  id,
  email,
  username,
  customerRole,
  admin?: {
    role,
    permissions,
    isOwner,
    status,
  }
}
```

### Middleware changes

Replace blanket `requireAdmin()` usage with layered authorization:

1. `authMiddleware`
   Validates token and loads user.

2. `requireAdminAccess`
   Ensures `request.user.admin` exists and is active.

3. `requirePermission('orders.read')`
   Checks a specific permission.

4. `requireAnyPermission([...])`
   Useful for mixed read-only views.

### Recommended middleware API

```ts
requireAdminAccess()
requirePermission('products.write')
requireAnyPermission(['orders.write', 'orders.refund'])
requireOwner()
```

## Route Mapping

The current admin route groups map naturally to permissions:

`apps/api/src/core/admin/dashboard/routes.ts`

- `dashboard.read`

`apps/api/src/core/admin/user-management/routes.ts`

- list/detail: `customers.read`
- create/update/delete: `customers.write`
- reset password: `customers.credentials.reset`

`apps/api/src/core/admin/product-management/routes.ts`

- list/detail/stats: `products.read`
- create/update/delete/upload: `products.write`
- source acknowledgment: `products.source.ack`

`apps/api/src/core/admin/order-management/routes.ts`

- list/detail/stats: `orders.read`
- status update, ship, cancel: `orders.write`
- refund: `orders.refund`

`apps/api/src/core/inventory/routes.ts`
`apps/api/src/core/warehouse/routes.ts`
`apps/api/src/core/stock-alert/routes.ts`

- read endpoints: `inventory.read`
- mutation endpoints: `inventory.write`

`apps/api/src/core/inventory/forecasting/routes.ts`

- `inventory.forecast`

`apps/api/src/core/admin/theme-management/routes.ts`

- list/read: `themes.read`
- activate/install/update: `themes.write`

`apps/api/src/core/admin/extension-installer/routes.ts`

- list/read: `plugins.read`
- install/config/toggle/uninstall: `plugins.write`

`apps/api/src/core/admin/market/routes.ts`

- catalog browsing: `market.read`
- install/launch actions: `market.install`

`apps/api/src/core/admin/platform-connection/routes.ts`

- read: `platformConnection.read`
- connect/refresh/disconnect: `platformConnection.write`

`apps/api/src/core/admin/store-management/routes.ts`

- read: `store.read`
- write: `store.write`

`apps/api/src/core/admin/system-settings/routes.ts`

- read: `settings.read`
- batch update: `settings.write`

`apps/api/src/core/admin/health-monitoring/routes.ts`

- `health.read`

`apps/api/src/core/webhooks/routes.ts`

- read/list/retry: `webhooks.read`
- create/update/delete/replay: `webhooks.write`

`apps/api/src/core/admin/catalog-import/routes.ts`

- `catalogImport.run`

## Frontend Design

### Auth store

The admin auth store should stop assuming `role === 'ADMIN'`.

Instead, it should hold:

- `admin.role`
- `admin.permissions`
- `admin.isOwner`
- helper selectors like `can(permission)`

### Route protection

Replace:

```tsx
<ProtectedRoute requireAdmin />
```

With:

```tsx
<ProtectedRoute requiredPermissions={['orders.read']} />
```

And for owner-only screens:

```tsx
<ProtectedRoute requireOwner />
```

### Navigation gating

Sidebar items should be hidden based on permission requirements:

- products: `products.read`
- orders: `orders.read`
- customers: `customers.read`
- plugins: `plugins.read`
- themes: `themes.read`
- system health: `health.read`
- settings: `settings.read`

### Action gating

Buttons and mutations should also check permissions:

- create product button: `products.write`
- refund button: `orders.refund`
- reset password button: `customers.credentials.reset`
- plugin install button: `plugins.write` or `market.install`

## Rollout Plan

### Phase 1

- add shared permission catalog
- add `AdminMembership` model
- seed existing admin users into `AdminMembership`
- extend JWT payload and `/auth/me` response
- add `requireAdminAccess` and `requirePermission`

### Phase 2

- migrate admin route modules from `requireAdmin` to permission-based checks
- keep `requireAdmin` as a compatibility wrapper that delegates to `requireAdminAccess`

### Phase 3

- update admin frontend auth store
- gate sidebar and pages by permission
- add staff management UI for admin role assignment

### Phase 4

- stop using `User.role` for admin authorization
- keep `User.role` only for storefront/customer identity until a later customer-role refactor

## Minimum-Change Fallback

If we need a faster but less clean implementation, we can add these fields directly to `User`:

- `adminRole String?`
- `adminPermissions Json?`
- `isOwner Boolean @default(false)`

This is easier to ship, but it keeps customer and admin concepts coupled. The separate `AdminMembership` model remains the better long-term design.

## Recommendation

For this OSS codebase, the recommended path is:

1. keep single-merchant assumptions
2. introduce a dedicated `AdminMembership` model
3. adopt the shared permission catalog from `packages/shared`
4. migrate admin routes to permission-based checks module by module

That gives us a practical RBAC system without reintroducing the complexity we just removed with B2B cleanup.
