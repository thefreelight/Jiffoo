CREATE TABLE IF NOT EXISTS native_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'USER',
  avatar TEXT,
  password_salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  password_iterations INTEGER NOT NULL DEFAULT 100000,
  is_active INTEGER NOT NULL DEFAULT 1,
  migrated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS native_users_email_idx ON native_users(email);

INSERT OR REPLACE INTO runtime_metadata (key, value, updated_at)
VALUES ('auth_schema_version', '0003', CURRENT_TIMESTAMP);
