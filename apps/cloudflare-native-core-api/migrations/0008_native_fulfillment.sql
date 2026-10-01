ALTER TABLE native_checkout_outbox ADD COLUMN attempt_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE native_checkout_outbox ADD COLUMN last_error TEXT;
ALTER TABLE native_checkout_outbox ADD COLUMN last_attempted_at TEXT;

CREATE INDEX IF NOT EXISTS native_checkout_outbox_pending_idx
  ON native_checkout_outbox(delivered_at, created_at);

INSERT OR REPLACE INTO runtime_metadata (key, value, updated_at)
VALUES ('core_schema_version', '0008', CURRENT_TIMESTAMP);
