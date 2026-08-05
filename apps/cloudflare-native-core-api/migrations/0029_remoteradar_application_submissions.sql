CREATE TABLE IF NOT EXISTS remoteradar_application_submissions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES native_users(id) ON DELETE CASCADE,
  application_id TEXT NOT NULL REFERENCES native_rr_job_applications(id) ON DELETE CASCADE,
  pack_version_id TEXT NOT NULL REFERENCES native_rr_application_pack_versions(id) ON DELETE RESTRICT,
  idempotency_key TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email')),
  transport TEXT NOT NULL CHECK (transport IN ('user_smtp', 'site_smtp')),
  recipient TEXT NOT NULL,
  subject TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'failed')),
  error_code TEXT,
  sent_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (user_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_remoteradar_submissions_application ON remoteradar_application_submissions(user_id, application_id, created_at DESC);
INSERT INTO runtime_metadata(key, value) VALUES ('core_schema_version', '0029')
ON CONFLICT(key) DO UPDATE SET value = excluded.value;
