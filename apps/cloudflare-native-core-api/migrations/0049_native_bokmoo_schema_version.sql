INSERT INTO runtime_metadata(key, value) VALUES ('core_schema_version', '0049') ON CONFLICT(key) DO UPDATE SET value = excluded.value
