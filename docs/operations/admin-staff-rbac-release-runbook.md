# Admin Staff RBAC Release Runbook

## Purpose

This runbook covers the release path for the Admin staff RBAC feature set:

- `AdminMembership` rollout
- staff management API
- staff audit trail
- invite resend flow
- Admin staff list and detail screens

Use this together with [admin-staff-rbac-release-checklist.md](/Users/jordan/Projects/Jiffoo/docs/operations/admin-staff-rbac-release-checklist.md).

## 1. Pre-Release Build Validation

Run these from the repo root:

```bash
pnpm --filter shared build
pnpm --filter api exec prisma generate
pnpm --filter api type-check
pnpm --filter admin type-check
pnpm --filter admin build
```

## 2. Staging Database Migration

Run the new migrations against staging before deploying app code:

```bash
pnpm --filter api exec prisma migrate deploy
```

Expected new migrations:

- `20260423000000_admin_memberships`
- `20260423010000_admin_staff_audit_logs`

## 3. Staging Smoke

Obtain an owner token for staging, then run:

```bash
node scripts/smoke-admin-staff-rbac.mjs \
  --base-url https://<staging-api>/api \
  --owner-token <owner-jwt>
```

The script verifies:

- `/auth/me`
- `/admin/staff`
- `/admin/staff/roles`
- `/admin/staff/permissions`
- create temp staff
- update temp staff
- resend invite
- audit history
- remove temp staff

## 4. Production Rollout

Deploy app code after staging is green, then apply production migrations:

```bash
pnpm --filter api exec prisma migrate deploy
```

Recommended order:

1. deploy API
2. deploy Admin
3. verify `/auth/me`
4. verify `/staff`
5. run smoke script against production

## 5. Post-Deploy Manual Checks

Run these checks with a real owner account:

1. Login to Admin.
2. Open `/staff`.
3. Open an existing staff detail page.
4. Create a temporary analyst/support account.
5. Change the role and confirm the audit log updates.
6. Resend invite for an unverified account.
7. Remove the temporary account.
8. Confirm the last owner cannot be removed.
9. On a paid/package storefront theme, disable and re-enable the Powered by Jiffoo footer link from Settings and verify storefront output.
10. On a builtin/free storefront theme, verify the footer attribution still remains visible.

## 6. Rollback Guidance

If you need to rollback application code:

- keep the database migrations in place
- redeploy the previous API/Admin image set
- legacy `User.role` compatibility remains available during rollout

Do not drop:

- `public.admin_memberships`
- `public.admin_staff_audit_logs`

## 7. Release Notes Summary

Suggested release summary:

- formal Admin staff access moved to `AdminMembership`
- staff role overrides are now first-class
- staff audit trail is visible in Admin
- invite resend is available for pending staff accounts
