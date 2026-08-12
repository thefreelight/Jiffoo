ALTER TABLE remoteradar_external_apply_grants ADD COLUMN job_id TEXT;
ALTER TABLE remoteradar_external_apply_grants ADD COLUMN application_pack_version_id TEXT;
ALTER TABLE remoteradar_external_apply_grants ADD COLUMN target_category TEXT NOT NULL DEFAULT 'external_ats';
ALTER TABLE remoteradar_external_apply_grants ADD COLUMN reason TEXT NOT NULL DEFAULT 'Application must be completed on an external ATS';
ALTER TABLE remoteradar_external_apply_grants ADD COLUMN revoked_at TEXT;

CREATE INDEX IF NOT EXISTS idx_remoteradar_external_grants_application
  ON remoteradar_external_apply_grants(application_id, created_at DESC);

INSERT INTO runtime_metadata(key, value) VALUES ('core_schema_version', '0041')
ON CONFLICT(key) DO UPDATE SET value = excluded.value;
