CREATE TABLE IF NOT EXISTS remoteradar_user_smtp_configs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES native_users(id) ON DELETE CASCADE,
  host TEXT NOT NULL,
  port INTEGER NOT NULL CHECK (port BETWEEN 1 AND 65535),
  secure INTEGER NOT NULL DEFAULT 0 CHECK (secure IN (0, 1)),
  username TEXT NOT NULL,
  encrypted_password TEXT NOT NULL,
  from_email TEXT NOT NULL,
  from_name TEXT,
  reply_to TEXT,
  enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_remoteradar_user_smtp_enabled ON remoteradar_user_smtp_configs(user_id, enabled);
CREATE TABLE IF NOT EXISTS remoteradar_email_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES native_users(id) ON DELETE CASCADE,
  application_id TEXT,
  recipient TEXT NOT NULL,
  subject TEXT NOT NULL,
  transport TEXT NOT NULL DEFAULT 'smtp',
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed')),
  error_code TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_remoteradar_email_events_user ON remoteradar_email_events(user_id, created_at DESC);
INSERT INTO runtime_metadata(key, value) VALUES ('core_schema_version', '0028')
ON CONFLICT(key) DO UPDATE SET value = excluded.value;
