-- Native mail delivery receipts for Cloudflare-native instances.
-- The outbox (0016) records the outbound queue and the bounces adapter (0060)
-- records failures reported after the DATA acceptance boundary; delivery
-- confirmations themselves (relay "delivered"/"delayed" events) had nowhere
-- to land. This migration adds an additive receipts table plus additive
-- delivery_status columns on the outbox row, projected forward-only from
-- recorded receipts with the priority UNKNOWN < DELAYED < DELIVERED <
-- FAILED = BOUNCED < COMPLAINED. Receipts are deduplicated by event_key
-- (identical replays collapse; the same key with a different payload is a
-- conflict) and never re-trigger or alter a send: status, attempt_count and
-- next_attempt_at stay owned by mail-outbox and mail-bounces.
ALTER TABLE native_email_outbox ADD COLUMN delivery_status TEXT NOT NULL DEFAULT 'UNKNOWN'
  CHECK (delivery_status IN ('UNKNOWN', 'DELAYED', 'DELIVERED', 'FAILED', 'BOUNCED', 'COMPLAINED'));
ALTER TABLE native_email_outbox ADD COLUMN delivery_updated_at TEXT;

CREATE TABLE IF NOT EXISTS native_mail_receipts (
  id TEXT PRIMARY KEY,
  event_key TEXT NOT NULL UNIQUE,
  outbox_id TEXT,
  recipient TEXT NOT NULL,
  message_id TEXT,
  queue_id TEXT,
  type TEXT NOT NULL CHECK (type IN ('delivered', 'delayed', 'bounced', 'complained', 'failed')),
  payload_hash TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  received_at TEXT NOT NULL,
  matched INTEGER NOT NULL DEFAULT 0 CHECK (matched IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS native_mail_receipts_outbox_idx ON native_mail_receipts(outbox_id, occurred_at);
CREATE INDEX IF NOT EXISTS native_mail_receipts_recipient_idx ON native_mail_receipts(recipient);
CREATE INDEX IF NOT EXISTS native_mail_receipts_occurred_idx ON native_mail_receipts(occurred_at DESC);

INSERT OR REPLACE INTO runtime_metadata (key, value, updated_at)
VALUES ('core_schema_version', '0077', CURRENT_TIMESTAMP);
