-- 0067_native_user_security_events.sql
-- Security-relevant account events (password changes and resets) in their own
-- audit table. Password-reset codes themselves reuse the verification-code
-- columns (see email-verification.ts) and need no schema of their own.

CREATE TABLE native_user_security_events (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  email TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN (
    'password.changed',
    'password.reset_requested',
    'password.reset',
    'password.admin_reset'
  )),
  source TEXT NOT NULL DEFAULT 'storefront',
  ip TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_native_user_security_events_user ON native_user_security_events(user_id, created_at);

INSERT OR REPLACE INTO runtime_metadata (key, value, updated_at)
VALUES ('core_schema_version', '0067', CURRENT_TIMESTAMP);
