CREATE TABLE IF NOT EXISTS native_auth_rate_limits (
  action TEXT NOT NULL,
  subject_key TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER NOT NULL,
  PRIMARY KEY (action, subject_key, window_start)
);

CREATE INDEX IF NOT EXISTS native_auth_rate_limits_expiry_idx
  ON native_auth_rate_limits(expires_at);

INSERT OR REPLACE INTO runtime_metadata (key, value, updated_at)
VALUES ('core_schema_version', '0017', CURRENT_TIMESTAMP);
