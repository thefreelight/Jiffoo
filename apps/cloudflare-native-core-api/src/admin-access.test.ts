import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

// Admin access resolution against a real membership row (migration 0058): the
// grants and revocations the Staff page stores must be the ones the gate
// enforces. The two lists are JSON text columns, so these tests pin the parse.
import { adminHasPermission, resolveNativeAdminAccess } from './admin-access';
import { ADMIN_PERMISSIONS } from './native-rbac';

const migrations = resolve(import.meta.dirname, '../migrations');
const SCHEMA = ['0001_native_platform.sql', '0002_native_core.sql', '0003_native_auth.sql', '0058_native_admin_staff.sql'];

function openDatabase() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys = ON;');
  for (const file of SCHEMA) sqlite.exec(readFileSync(resolve(migrations, file), 'utf8'));
  return sqlite;
}

/** The D1 surface resolveNativeAdminAccess uses, over node:sqlite. */
function envFor(sqlite: DatabaseSync) {
  const first = async <T,>(sql: string, args: unknown[]) => (sqlite.prepare(sql).get(...args) ?? null) as T | null;
  return {
    DB: { prepare: (sql: string) => ({ bind: (...args: unknown[]) => ({ first: () => first(sql, args) }) }) },
  } as never;
}

function addMember(sqlite: DatabaseSync, role: string, extra: string, revoked: string, status = 'ACTIVE') {
  sqlite.prepare(`INSERT INTO native_users (id, email, username, role, password_salt, password_hash, updated_at)
    VALUES ('u1', 'u1@example.com', 'u1', 'ADMIN', 'salt', 'hash', '2026-11-24T00:00:00Z')`).run();
  sqlite.prepare(`INSERT INTO native_admin_memberships
    (id, user_id, role, status, is_owner, extra_permissions, revoked_permissions, created_at, updated_at)
    VALUES ('m1', 'u1', ?1, ?2, 0, ?3, ?4, '2026-11-24T00:00:00Z', '2026-11-24T00:00:00Z')`).run(role, status, extra, revoked);
}

const sorted = (permissions: readonly string[]) => [...permissions].sort();

describe('admin access from a membership row', () => {
  it('applies the grants and revocations stored on the row', async () => {
    const sqlite = openDatabase();
    // A support agent with the inbox revoked and customer reading granted.
    addMember(sqlite, 'SUPPORT_AGENT', '["customers.read"]', '["support.read", "support.write"]');
    const access = await resolveNativeAdminAccess(envFor(sqlite), 'u1', 'ADMIN');
    expect(sorted(access?.permissions ?? [])).toEqual([ADMIN_PERMISSIONS.CUSTOMERS_READ, ADMIN_PERMISSIONS.DASHBOARD_READ]);
    expect(access?.extraPermissions).toEqual([ADMIN_PERMISSIONS.CUSTOMERS_READ]);
    expect(access?.revokedPermissions).toEqual([ADMIN_PERMISSIONS.SUPPORT_READ, ADMIN_PERMISSIONS.SUPPORT_WRITE]);
    expect(adminHasPermission(access, ADMIN_PERMISSIONS.CUSTOMERS_READ)).toBe(true);
    expect(adminHasPermission(access, ADMIN_PERMISSIONS.SUPPORT_READ)).toBe(false);
  });

  it('keeps role defaults when both lists are the stored default', async () => {
    const sqlite = openDatabase();
    addMember(sqlite, 'SUPPORT_AGENT', '[]', '[]');
    const access = await resolveNativeAdminAccess(envFor(sqlite), 'u1', 'ADMIN');
    expect(sorted(access?.permissions ?? [])).toEqual([
      ADMIN_PERMISSIONS.DASHBOARD_READ,
      ADMIN_PERMISSIONS.SUPPORT_READ,
      ADMIN_PERMISSIONS.SUPPORT_WRITE,
    ]);
  });

  it('cannot revoke past nothing or grant names that do not exist', async () => {
    const sqlite = openDatabase();
    addMember(sqlite, 'ANALYST', '["not.a.permission", "orders.read", "orders.read"]', '["not.a.permission", "orders.read"]');
    const access = await resolveNativeAdminAccess(envFor(sqlite), 'u1', 'ADMIN');
    expect(access?.extraPermissions).toEqual([ADMIN_PERMISSIONS.ORDERS_READ]);
    expect(access?.revokedPermissions).toEqual([ADMIN_PERMISSIONS.ORDERS_READ]);
    expect(access?.permissions).not.toContain(ADMIN_PERMISSIONS.ORDERS_READ);
  });

  it('treats unreadable lists as empty and keeps the role usable', async () => {
    const sqlite = openDatabase();
    addMember(sqlite, 'SUPPORT_AGENT', '{broken', 'null');
    const access = await resolveNativeAdminAccess(envFor(sqlite), 'u1', 'ADMIN');
    expect(sorted(access?.permissions ?? [])).toEqual([
      ADMIN_PERMISSIONS.DASHBOARD_READ,
      ADMIN_PERMISSIONS.SUPPORT_READ,
      ADMIN_PERMISSIONS.SUPPORT_WRITE,
    ]);
  });

  it('reports a suspended membership as suspended and falls back to the legacy role without a row', async () => {
    const sqlite = openDatabase();
    addMember(sqlite, 'ADMIN', '[]', '[]', 'SUSPENDED');
    const suspended = await resolveNativeAdminAccess(envFor(sqlite), 'u1', 'ADMIN');
    expect(suspended?.status).toBe('SUSPENDED');
    expect(adminHasPermission(suspended, ADMIN_PERMISSIONS.DASHBOARD_READ)).toBe(false);

    const legacy = await resolveNativeAdminAccess(envFor(openDatabase()), 'u-missing', 'ANALYST');
    expect(legacy?.role).toBe('ANALYST');
    expect(adminHasPermission(legacy, ADMIN_PERMISSIONS.DASHBOARD_READ)).toBe(true);
    expect(await resolveNativeAdminAccess(envFor(openDatabase()), 'u-missing', 'USER')).toBeNull();
  });
});
