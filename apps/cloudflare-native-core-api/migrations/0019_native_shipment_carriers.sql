ALTER TABLE native_shipments ADD COLUMN carrier_code TEXT;
ALTER TABLE native_shipments ADD COLUMN carrier_name TEXT;

UPDATE native_shipments
SET carrier_name = carrier
WHERE carrier_name IS NULL;

INSERT OR REPLACE INTO runtime_metadata (key, value, updated_at)
VALUES ('core_schema_version', '0019', CURRENT_TIMESTAMP);
