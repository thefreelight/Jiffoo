-- Password reset codes for Cloudflare-native instances.
-- Mirrors the email-verification lifecycle (0013) with its own columns so a
-- reset request never disturbs a pending email verification, and vice versa.
ALTER TABLE native_users ADD COLUMN reset_code_hash TEXT;
ALTER TABLE native_users ADD COLUMN reset_expires_at TEXT;
ALTER TABLE native_users ADD COLUMN reset_attempts INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS native_users_reset_expiry_idx
  ON native_users(reset_expires_at);

INSERT OR REPLACE INTO runtime_metadata (key, value, updated_at)
VALUES ('core_schema_version', '0062', CURRENT_TIMESTAMP);
