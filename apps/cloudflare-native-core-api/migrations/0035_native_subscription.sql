CREATE TABLE IF NOT EXISTS native_subscription_records (
  user_id TEXT PRIMARY KEY,
  plan_name TEXT NOT NULL DEFAULT 'Free',
  plan_slug TEXT NOT NULL DEFAULT 'free',
  status TEXT NOT NULL DEFAULT 'inactive',
  current_period_end TEXT,
  lifetime_credits_debited INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES native_users(id) ON DELETE CASCADE
);

INSERT OR REPLACE INTO runtime_metadata (key, value, updated_at)
VALUES ('core_schema_version', '0035', CURRENT_TIMESTAMP);
