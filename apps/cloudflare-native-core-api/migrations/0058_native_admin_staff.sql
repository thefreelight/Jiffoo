-- Native back-office staff access control (Merchant Admin Staff panel).
-- Mirrors the Node api Prisma models AdminMembership and AdminStaffAuditLog
-- (schema/system.prisma) so the same frontend contract and role/permission
-- semantics are served on Cloudflare-native D1 instances.
CREATE TABLE IF NOT EXISTS native_admin_memberships (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED')),
  is_owner INTEGER NOT NULL DEFAULT 0 CHECK (is_owner IN (0, 1)),
  extra_permissions TEXT NOT NULL DEFAULT '[]',
  revoked_permissions TEXT NOT NULL DEFAULT '[]',
  created_by_user_id TEXT,
  updated_by_user_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES native_users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS native_admin_memberships_role_idx ON native_admin_memberships(role);
CREATE INDEX IF NOT EXISTS native_admin_memberships_status_idx ON native_admin_memberships(status);

CREATE TABLE IF NOT EXISTS native_admin_staff_audit_logs (
  id TEXT PRIMARY KEY,
  staff_user_id TEXT NOT NULL,
  staff_email TEXT NOT NULL,
  staff_username TEXT,
  actor_user_id TEXT,
  actor_email TEXT,
  actor_username TEXT,
  action TEXT NOT NULL,
  metadata TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS native_admin_staff_audit_logs_staff_idx
  ON native_admin_staff_audit_logs(staff_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS native_admin_staff_audit_logs_action_idx
  ON native_admin_staff_audit_logs(action, created_at DESC);

INSERT OR REPLACE INTO runtime_metadata (key, value, updated_at)
VALUES ('core_schema_version', '0058', CURRENT_TIMESTAMP);
