CREATE TABLE IF NOT EXISTS remoteradar_resume_documents (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES native_users(id) ON DELETE CASCADE,
  resume_id TEXT NOT NULL REFERENCES native_rr_resumes(id) ON DELETE CASCADE,
  object_key TEXT NOT NULL UNIQUE,
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  extraction_status TEXT NOT NULL DEFAULT 'pending' CHECK (extraction_status IN ('pending', 'processing', 'ready', 'failed')),
  extracted_text TEXT,
  extraction_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_remoteradar_resume_documents_user ON remoteradar_resume_documents(user_id, resume_id, created_at DESC);
INSERT INTO runtime_metadata(key, value) VALUES ('core_schema_version', '0032')
ON CONFLICT(key) DO UPDATE SET value = excluded.value;
