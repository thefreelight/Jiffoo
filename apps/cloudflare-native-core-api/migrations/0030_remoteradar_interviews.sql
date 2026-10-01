CREATE TABLE IF NOT EXISTS remoteradar_interviews (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES native_users(id) ON DELETE CASCADE,
  application_id TEXT NOT NULL REFERENCES native_rr_job_applications(id) ON DELETE CASCADE,
  starts_at TEXT NOT NULL,
  ends_at TEXT,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  meeting_url TEXT,
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled')),
  reminder_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_remoteradar_interviews_user_time ON remoteradar_interviews(user_id, starts_at);
INSERT INTO runtime_metadata(key, value) VALUES ('core_schema_version', '0030')
ON CONFLICT(key) DO UPDATE SET value = excluded.value;
