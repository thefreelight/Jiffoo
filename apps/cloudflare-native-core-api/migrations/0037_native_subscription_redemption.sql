CREATE TABLE IF NOT EXISTS native_subscription_redemption_codes (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  plan_slug TEXT NOT NULL,
  plan_name TEXT NOT NULL,
  duration_days INTEGER NOT NULL CHECK (duration_days > 0),
  expires_at TEXT,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS native_subscription_redemption_claims (
  code_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  claimed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  applied_at TEXT,
  subscription_period_end TEXT,
  FOREIGN KEY (code_id) REFERENCES native_subscription_redemption_codes(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES native_users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS native_subscription_redemption_claims_user_idx
  ON native_subscription_redemption_claims(user_id, claimed_at);

INSERT OR REPLACE INTO runtime_metadata (key, value, updated_at)
VALUES ('core_schema_version', '0037', CURRENT_TIMESTAMP);
