CREATE TABLE IF NOT EXISTS remoteradar_job_targets (
  job_key TEXT PRIMARY KEY,
  target_url TEXT NOT NULL,
  updated_by TEXT NOT NULL REFERENCES native_users(id),
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS remoteradar_external_apply_grants (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES native_users(id) ON DELETE CASCADE,
  application_id TEXT NOT NULL REFERENCES native_rr_job_applications(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  target_url TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_remoteradar_external_grants_user ON remoteradar_external_apply_grants(user_id, created_at DESC);
INSERT INTO runtime_metadata(key, value) VALUES ('core_schema_version', '0031')
ON CONFLICT(key) DO UPDATE SET value = excluded.value;
