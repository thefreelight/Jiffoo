CREATE TABLE IF NOT EXISTS native_bokmoo_card_claim_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  card_id TEXT NOT NULL,
  mid TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  verification_method TEXT,
  challenge_nonce TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  verified_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES native_users(id) ON DELETE CASCADE,
  FOREIGN KEY (card_id) REFERENCES native_bokmoo_cards(id) ON DELETE CASCADE
)
