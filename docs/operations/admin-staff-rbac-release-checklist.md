# Admin Staff RBAC Release Checklist

## Scope

This release introduces formal staff access control for the Admin workspace:

- `AdminMembership` as the source of truth for back-office access
- per-staff permission overrides
- staff management API and Admin UI
- staff audit trail
- staff invitation resend flow

## Database

Apply these migrations before rolling out application code:

1. `20260423000000_admin_memberships`
2. `20260423010000_admin_staff_audit_logs`

Expected outcome:

- existing legacy admin users are backfilled into `admin_memberships`
- new `admin_staff_audit_logs` table exists

Verification queries:

```sql
SELECT COUNT(*) FROM public.admin_memberships;
SELECT COUNT(*) FROM public.admin_staff_audit_logs;
SELECT id, email, role FROM public.users WHERE role IN ('ADMIN', 'SUPER_ADMIN', 'TENANT_ADMIN');
```

## Release Smoke

Run these checks in a staging or production-like environment:

1. Login to Admin with an owner/admin account.
2. Open `/staff` and confirm the list renders.
3. Open a staff detail page and confirm audit history renders.
4. Create a new staff account with a low-privilege role such as `ANALYST`.
5. Confirm the new staff member can login and only sees allowed navigation items.
6. Change that staff member to another role and confirm the audit log records the update.
7. Resend a pending invite and confirm a success response plus a new audit row.
8. Confirm a non-staff user cannot access `/staff` or `/api/admin/staff`.
9. Confirm the last active owner cannot be removed or demoted.
10. On a paid/package storefront theme, toggle the footer attribution setting and confirm `Powered by Jiffoo` appears/disappears as expected.
11. On a builtin/free storefront theme, confirm the `Powered by Jiffoo` footer link still remains visible even if the setting is disabled.

## API Verification

Expected protected endpoints:

- `GET /api/admin/staff`
- `GET /api/admin/staff/:userId`
- `GET /api/admin/staff/:userId/audit`
- `GET /api/admin/staff/roles`
- `GET /api/admin/staff/permissions`
- `POST /api/admin/staff`
- `PATCH /api/admin/staff/:userId`
- `DELETE /api/admin/staff/:userId`
- `POST /api/admin/staff/:userId/invite`

Expected auth payload additions from `GET /api/auth/me`:

- `admin`
- `adminRole`
- `permissions`
- `isOwner`
- `adminStatus`

## Rollback Notes

If application rollback is required:

- application code can fall back to legacy `User.role` auth semantics
- do not drop the new tables during immediate rollback
- preserve `admin_memberships` and `admin_staff_audit_logs` so forward re-deploy is safe

## Completed Validation In This Workspace

The following checks were already run locally against this branch:

- `pnpm --filter shared build`
- `pnpm --filter api exec prisma generate`
- `pnpm --filter api type-check`
- `pnpm --filter admin type-check`
- `pnpm --filter admin build`
- `pnpm --filter api exec dotenv -e tests/.env.test -- node scripts/run-test-migrate.js`
- `pnpm --filter api exec vitest run tests/routes/admin-staff.test.ts tests/core/auth-middleware.test.ts tests/routes/admin-dashboard.test.ts tests/routes/admin-users.test.ts`
