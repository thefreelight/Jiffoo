CREATE TABLE IF NOT EXISTS remoteradar_application_pack_charges (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('create', 'regenerate')),
  target_pack_id TEXT,
  grant_id TEXT,
  wallet_reservation_id TEXT,
  attempt INTEGER NOT NULL DEFAULT 0 CHECK (attempt >= 0),
  status TEXT NOT NULL DEFAULT 'initiated' CHECK (status IN ('initiated', 'claiming', 'reserved', 'settled', 'released')),
  result_pack_id TEXT,
  result_version_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES native_users(id) ON DELETE CASCADE,
  FOREIGN KEY (grant_id) REFERENCES remoteradar_credit_grants(id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX IF NOT EXISTS remoteradar_application_pack_charges_idem_unique
  ON remoteradar_application_pack_charges(user_id, idempotency_key);

CREATE INDEX IF NOT EXISTS remoteradar_application_pack_charges_user_idx
  ON remoteradar_application_pack_charges(user_id, created_at DESC);

CREATE TRIGGER IF NOT EXISTS remoteradar_pack_charge_claim_validate
BEFORE UPDATE OF status ON remoteradar_application_pack_charges
WHEN NEW.status = 'claiming' AND OLD.status IN ('initiated', 'released')
BEGIN
  SELECT CASE
    WHEN NEW.grant_id IS NULL THEN RAISE(ABORT, 'REMOTERADAR_GRANT_REQUIRED')
    WHEN NOT EXISTS (
      SELECT 1 FROM remoteradar_credit_grants
      WHERE id = NEW.grant_id AND user_id = NEW.user_id
        AND credits_remaining > 0 AND expires_at > NEW.updated_at
    ) THEN RAISE(ABORT, 'REMOTERADAR_CREDITS_EXHAUSTED')
  END;
END;

CREATE TRIGGER IF NOT EXISTS remoteradar_pack_charge_claim_apply
AFTER UPDATE OF status ON remoteradar_application_pack_charges
WHEN NEW.status = 'claiming' AND OLD.status IN ('initiated', 'released')
BEGIN
  UPDATE remoteradar_credit_grants
  SET credits_remaining = credits_remaining - 1, updated_at = NEW.updated_at
  WHERE id = NEW.grant_id AND user_id = NEW.user_id;
END;

CREATE TRIGGER IF NOT EXISTS remoteradar_pack_charge_release_apply
AFTER UPDATE OF status ON remoteradar_application_pack_charges
WHEN NEW.status = 'released' AND OLD.status IN ('claiming', 'reserved')
BEGIN
  UPDATE remoteradar_credit_grants
  SET credits_remaining = credits_remaining + 1, updated_at = NEW.updated_at
  WHERE id = OLD.grant_id AND user_id = OLD.user_id;
END;

INSERT OR REPLACE INTO runtime_metadata (key, value, updated_at)
VALUES ('core_schema_version', '0027', CURRENT_TIMESTAMP);
