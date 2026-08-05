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

CREATE TRIGGER IF NOT EXISTS native_wallet_ledger_validate
BEFORE INSERT ON native_wallet_ledger
WHEN NEW.operation IN ('credit', 'debit')
BEGIN
  SELECT CASE
    WHEN NOT EXISTS (SELECT 1 FROM native_wallet_accounts WHERE user_id = NEW.user_id)
      THEN RAISE(ABORT, 'WALLET_ACCOUNT_NOT_FOUND')
    WHEN NEW.operation = 'debit' AND NOT EXISTS (
      SELECT 1 FROM native_wallet_accounts
      WHERE user_id = NEW.user_id AND balance - reserved_balance >= NEW.amount
    ) THEN RAISE(ABORT, 'INSUFFICIENT_BALANCE')
  END;
END;

CREATE TRIGGER IF NOT EXISTS native_wallet_ledger_apply
AFTER INSERT ON native_wallet_ledger
WHEN NEW.operation IN ('credit', 'debit')
BEGIN
  UPDATE native_wallet_accounts SET
    balance = balance + CASE WHEN NEW.operation = 'credit' THEN NEW.amount ELSE -NEW.amount END,
    total_credited = total_credited + CASE WHEN NEW.operation = 'credit' THEN NEW.amount ELSE 0 END,
    total_debited = total_debited + CASE WHEN NEW.operation = 'debit' THEN NEW.amount ELSE 0 END,
    updated_at = NEW.created_at
  WHERE user_id = NEW.user_id;
  UPDATE native_wallet_ledger SET
    balance_after = (SELECT balance FROM native_wallet_accounts WHERE user_id = NEW.user_id)
  WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS native_wallet_reservation_validate
BEFORE INSERT ON native_wallet_reservations
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM native_wallet_accounts
    WHERE user_id = NEW.user_id AND balance - reserved_balance >= NEW.amount
  ) THEN RAISE(ABORT, 'INSUFFICIENT_AVAILABLE_BALANCE') END;
END;

CREATE TRIGGER IF NOT EXISTS native_wallet_reservation_hold
AFTER INSERT ON native_wallet_reservations
BEGIN
  UPDATE native_wallet_accounts
  SET reserved_balance = reserved_balance + NEW.amount, updated_at = NEW.created_at
  WHERE user_id = NEW.user_id;
END;

CREATE TRIGGER IF NOT EXISTS native_wallet_reservation_settle
BEFORE UPDATE OF status ON native_wallet_reservations
WHEN OLD.status = 'reserved' AND NEW.status = 'settled'
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM native_wallet_accounts
    WHERE user_id = OLD.user_id AND reserved_balance >= OLD.amount
  ) THEN RAISE(ABORT, 'WALLET_RESERVATION_INVARIANT') END;
  UPDATE native_wallet_accounts SET
    balance = balance - OLD.amount,
    reserved_balance = reserved_balance - OLD.amount,
    total_debited = total_debited + OLD.amount,
    updated_at = COALESCE(NEW.settled_at, CURRENT_TIMESTAMP)
  WHERE user_id = OLD.user_id;
  INSERT INTO native_wallet_ledger
    (id, user_id, operation, amount, balance_after, type, description, source_plugin, reference_id, metadata, created_at)
  SELECT
    'wallet_tx_' || lower(hex(randomblob(16))), OLD.user_id, 'settlement', OLD.amount, balance,
    'settlement', 'Wallet reservation settled', OLD.source_plugin, OLD.reference_id, '{}',
    COALESCE(NEW.settled_at, CURRENT_TIMESTAMP)
  FROM native_wallet_accounts WHERE user_id = OLD.user_id;
END;

CREATE TRIGGER IF NOT EXISTS native_wallet_reservation_release
BEFORE UPDATE OF status ON native_wallet_reservations
WHEN OLD.status = 'reserved' AND NEW.status IN ('released', 'expired')
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM native_wallet_accounts
    WHERE user_id = OLD.user_id AND reserved_balance >= OLD.amount
  ) THEN RAISE(ABORT, 'WALLET_RESERVATION_INVARIANT') END;
  UPDATE native_wallet_accounts SET
    reserved_balance = reserved_balance - OLD.amount,
    updated_at = COALESCE(NEW.released_at, CURRENT_TIMESTAMP)
  WHERE user_id = OLD.user_id;
END;

INSERT OR REPLACE INTO runtime_metadata (key, value, updated_at)
VALUES ('core_schema_version', '0025', CURRENT_TIMESTAMP);
