CREATE TABLE IF NOT EXISTS native_email_outbox (
  id TEXT PRIMARY KEY,
  dedupe_key TEXT NOT NULL UNIQUE,
  message_type TEXT NOT NULL,
  order_id TEXT,
  recipient TEXT NOT NULL,
  subject TEXT NOT NULL,
  text_body TEXT NOT NULL,
  html_body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT NOT NULL,
  last_attempted_at TEXT,
  sent_at TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS native_email_outbox_pending_idx
  ON native_email_outbox(status, next_attempt_at, created_at);

INSERT OR REPLACE INTO runtime_metadata (key, value, updated_at)
VALUES ('core_schema_version', '0016', CURRENT_TIMESTAMP);
