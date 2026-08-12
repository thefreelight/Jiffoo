ALTER TABLE native_rr_resume_facts
ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1));

INSERT INTO runtime_metadata(key, value) VALUES ('core_schema_version', '0040')
ON CONFLICT(key) DO UPDATE SET value = excluded.value;
