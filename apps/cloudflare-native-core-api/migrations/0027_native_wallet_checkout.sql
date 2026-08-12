CREATE TABLE IF NOT EXISTS native_wallet_checkout_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  package_id TEXT NOT NULL,
  points INTEGER NOT NULL CHECK (points > 0),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  currency TEXT NOT NULL,
  provider_session_id TEXT UNIQUE,
  checkout_url TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'expired', 'cancelled')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  paid_at TEXT,
  FOREIGN KEY (user_id) REFERENCES native_users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS native_wallet_checkout_user_idx
  ON native_wallet_checkout_sessions(user_id, created_at DESC);

INSERT OR REPLACE INTO runtime_metadata (key, value, updated_at)
VALUES ('core_schema_version', '0027', CURRENT_TIMESTAMP);
