CREATE TABLE IF NOT EXISTS native_rr_resumes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES native_users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS native_rr_resumes_user_idx ON native_rr_resumes(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS native_rr_resume_facts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  resume_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  label TEXT NOT NULL,
  value TEXT NOT NULL,
  confirmed_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (user_id, resume_id, kind, label),
  FOREIGN KEY (user_id) REFERENCES native_users(id) ON DELETE CASCADE,
  FOREIGN KEY (resume_id) REFERENCES native_rr_resumes(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS native_rr_resume_facts_user_idx ON native_rr_resume_facts(user_id, resume_id, created_at ASC);

CREATE TABLE IF NOT EXISTS native_rr_saved_jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  job_key TEXT NOT NULL,
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  location TEXT,
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (user_id, job_key),
  FOREIGN KEY (user_id) REFERENCES native_users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS native_rr_saved_jobs_user_idx ON native_rr_saved_jobs(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS native_rr_application_packs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  saved_job_id TEXT NOT NULL,
  resume_id TEXT NOT NULL,
  approved_version_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES native_users(id) ON DELETE CASCADE,
  FOREIGN KEY (saved_job_id) REFERENCES native_rr_saved_jobs(id) ON DELETE CASCADE,
  FOREIGN KEY (resume_id) REFERENCES native_rr_resumes(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS native_rr_application_packs_user_idx ON native_rr_application_packs(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS native_rr_application_pack_versions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  pack_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  resume_snapshot TEXT NOT NULL,
  cover_letter TEXT NOT NULL,
  answers TEXT NOT NULL DEFAULT '{}',
  approved_at TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (pack_id, version),
  FOREIGN KEY (user_id) REFERENCES native_users(id) ON DELETE CASCADE,
  FOREIGN KEY (pack_id) REFERENCES native_rr_application_packs(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS native_rr_application_pack_versions_user_idx ON native_rr_application_pack_versions(user_id, pack_id, version ASC);

CREATE TABLE IF NOT EXISTS native_rr_job_applications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  saved_job_id TEXT NOT NULL,
  pack_id TEXT NOT NULL,
  pack_version_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('saved', 'planned', 'applied', 'screening', 'interview', 'offer', 'rejected', 'archived')),
  applied_at TEXT,
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES native_users(id) ON DELETE CASCADE,
  FOREIGN KEY (saved_job_id) REFERENCES native_rr_saved_jobs(id) ON DELETE CASCADE,
  FOREIGN KEY (pack_id) REFERENCES native_rr_application_packs(id) ON DELETE CASCADE,
  FOREIGN KEY (pack_version_id) REFERENCES native_rr_application_pack_versions(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS native_rr_job_applications_user_idx ON native_rr_job_applications(user_id, updated_at DESC);

INSERT OR REPLACE INTO runtime_metadata (key, value, updated_at)
VALUES ('core_schema_version', '0024', CURRENT_TIMESTAMP);
