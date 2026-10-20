ALTER TABLE remoteradar_resume_documents ADD COLUMN extraction_attempts INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS remoteradar_resume_fact_drafts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES native_users(id) ON DELETE CASCADE,
  resume_id TEXT NOT NULL REFERENCES native_rr_resumes(id) ON DELETE CASCADE,
  document_id TEXT NOT NULL REFERENCES remoteradar_resume_documents(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  label TEXT NOT NULL,
  value TEXT NOT NULL,
  confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected')),
  confirmed_fact_id TEXT REFERENCES native_rr_resume_facts(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (document_id, kind, label)
);
CREATE INDEX IF NOT EXISTS idx_remoteradar_resume_fact_drafts_user
  ON remoteradar_resume_fact_drafts(user_id, resume_id, status, created_at ASC);

CREATE TABLE IF NOT EXISTS remoteradar_resume_versions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES native_users(id) ON DELETE CASCADE,
  resume_id TEXT NOT NULL REFERENCES native_rr_resumes(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  snapshot_json TEXT NOT NULL,
  source_document_id TEXT REFERENCES remoteradar_resume_documents(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  UNIQUE (resume_id, version)
);
CREATE INDEX IF NOT EXISTS idx_remoteradar_resume_versions_user
  ON remoteradar_resume_versions(user_id, resume_id, version DESC);

INSERT INTO runtime_metadata(key, value) VALUES ('core_schema_version', '0034')
ON CONFLICT(key) DO UPDATE SET value = excluded.value;
