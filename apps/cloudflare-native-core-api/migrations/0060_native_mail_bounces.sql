-- Native mail bounce/DSN ingestion for Cloudflare-native instances.
-- Transactional mail is sent through the SMTP relay in mail-outbox.ts, so
-- permanent delivery failures that arrive AFTER the DATA acceptance boundary
-- (post-DATA bounces, DSN reports) were previously invisible: rows stayed
-- SENT forever and complaint feedback had nowhere to land. This table stores
-- every relay notification event (idempotent via event_key) and correlates it
-- back to the outbox row through the persisted Message-ID or, failing that,
-- the recipient address of the most recent accepted send.
ALTER TABLE native_email_outbox ADD COLUMN message_id TEXT;

CREATE TABLE IF NOT EXISTS native_mail_bounces (
  id TEXT PRIMARY KEY,
  event_key TEXT NOT NULL UNIQUE,
  outbox_id TEXT,
  recipient TEXT NOT NULL,
  sender TEXT,
  message_id TEXT,
  queue_id TEXT,
  action TEXT NOT NULL,
  status_code TEXT,
  diagnostic TEXT,
  classification TEXT NOT NULL CHECK (classification IN ('hard', 'soft', 'info')),
  occurred_at TEXT NOT NULL,
  matched INTEGER NOT NULL DEFAULT 0 CHECK (matched IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS native_mail_bounces_recipient_idx ON native_mail_bounces(recipient);
CREATE INDEX IF NOT EXISTS native_mail_bounces_outbox_idx ON native_mail_bounces(outbox_id);
CREATE INDEX IF NOT EXISTS native_mail_bounces_occurred_idx ON native_mail_bounces(occurred_at DESC);
CREATE INDEX IF NOT EXISTS native_mail_bounces_classification_idx ON native_mail_bounces(classification);

INSERT OR REPLACE INTO runtime_metadata (key, value, updated_at)
VALUES ('core_schema_version', '0060', CURRENT_TIMESTAMP);
