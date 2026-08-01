CREATE TABLE IF NOT EXISTS native_admin_api_tokens (
  id TEXT PRIMARY KEY,
  admin_user_id TEXT NOT NULL,
  label TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  scopes_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_used_at TEXT,
  revoked_at TEXT,
  FOREIGN KEY (admin_user_id) REFERENCES native_users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS native_admin_api_tokens_admin_idx
  ON native_admin_api_tokens(admin_user_id, revoked_at, created_at);

INSERT OR REPLACE INTO runtime_metadata (key, value, updated_at)
VALUES ('core_schema_version', '0021', CURRENT_TIMESTAMP);
