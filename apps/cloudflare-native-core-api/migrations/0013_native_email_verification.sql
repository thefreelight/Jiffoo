ALTER TABLE native_users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0;
ALTER TABLE native_users ADD COLUMN verification_code_hash TEXT;
ALTER TABLE native_users ADD COLUMN verification_expires_at TEXT;
ALTER TABLE native_users ADD COLUMN verification_attempts INTEGER NOT NULL DEFAULT 0;

UPDATE native_users
SET email_verified = 1
WHERE role IN ('ADMIN', 'SUPER_ADMIN') OR migrated_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS native_users_verification_expiry_idx
  ON native_users(email_verified, verification_expires_at);

INSERT OR REPLACE INTO runtime_metadata (key, value, updated_at)
VALUES ('core_schema_version', '0013', CURRENT_TIMESTAMP);
