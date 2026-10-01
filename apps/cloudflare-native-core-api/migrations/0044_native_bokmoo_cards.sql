CREATE TABLE IF NOT EXISTS native_bokmoo_cards (
  id TEXT PRIMARY KEY,
  mid TEXT NOT NULL UNIQUE,
  eid TEXT UNIQUE,
  iccid TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'unbound',
  verification_status TEXT NOT NULL DEFAULT 'pending',
  user_id TEXT,
  bound_at TEXT,
  verified_at TEXT,
  last_seen_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES native_users(id) ON DELETE SET NULL
);
