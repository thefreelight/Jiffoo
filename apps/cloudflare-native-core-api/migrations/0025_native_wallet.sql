CREATE TABLE IF NOT EXISTS native_wallet_accounts (
  user_id TEXT PRIMARY KEY,
  balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  reserved_balance INTEGER NOT NULL DEFAULT 0 CHECK (reserved_balance >= 0 AND reserved_balance <= balance),
  total_credited INTEGER NOT NULL DEFAULT 0,
  total_debited INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES native_users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS native_wallet_ledger (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('credit', 'debit', 'settlement')),
  amount INTEGER NOT NULL CHECK (amount > 0),
  balance_after INTEGER NOT NULL DEFAULT 0,
  type TEXT NOT NULL,
  description TEXT NOT NULL,
  source_plugin TEXT,
  idempotency_key TEXT UNIQUE,
  reference_id TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES native_wallet_accounts(user_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS native_wallet_ledger_user_idx ON native_wallet_ledger(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS native_wallet_reservations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL CHECK (status IN ('reserved', 'settled', 'released', 'expired')),
  expires_at TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  completion_idempotency_key TEXT UNIQUE,
  completion_action TEXT CHECK (completion_action IS NULL OR completion_action IN ('settle', 'release')),
  reference_id TEXT,
  source_plugin TEXT,
  created_at TEXT NOT NULL,
  settled_at TEXT,
  released_at TEXT,
  FOREIGN KEY (user_id) REFERENCES native_wallet_accounts(user_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS native_wallet_reservations_active_idx ON native_wallet_reservations(user_id, status, expires_at);

INSERT OR REPLACE INTO runtime_metadata (key, value, updated_at)
VALUES ('core_schema_version', '0025', CURRENT_TIMESTAMP);
