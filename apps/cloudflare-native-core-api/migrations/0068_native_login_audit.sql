-- 0068_native_login_audit.sql
-- Login audit as a core baseline: security events gain login.success/login.failed,
-- and native_users gains created_at/last_login_at/last_login_ip so the admin
-- console can show account age and recent sign-in provenance without joins.

ALTER TABLE native_users ADD COLUMN created_at TEXT;
UPDATE native_users SET created_at = migrated_at WHERE created_at IS NULL;
ALTER TABLE native_users ADD COLUMN last_login_at TEXT;
ALTER TABLE native_users ADD COLUMN last_login_ip TEXT;

-- SQLite cannot alter a CHECK constraint, so rebuild the events table with the
-- widened action set (keeping the password.* history).
CREATE TABLE native_user_security_events_new (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  email TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN (
    'password.changed',
    'password.reset_requested',
    'password.reset',
    'password.admin_reset',
    'login.success',
    'login.failed'
  )),
  source TEXT NOT NULL DEFAULT 'storefront',
  ip TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO native_user_security_events_new (id, user_id, email, action, source, ip, metadata, created_at)
  SELECT id, user_id, email, action, source, ip, metadata, created_at FROM native_user_security_events;
DROP TABLE native_user_security_events;
ALTER TABLE native_user_security_events_new RENAME TO native_user_security_events;
CREATE INDEX idx_native_user_security_events_user ON native_user_security_events(user_id, created_at);
CREATE INDEX idx_native_user_security_events_email ON native_user_security_events(email, created_at);

INSERT OR REPLACE INTO runtime_metadata (key, value, updated_at)
VALUES ('core_schema_version', '0068', CURRENT_TIMESTAMP);
