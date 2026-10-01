-- RemoteRadar tiered pricing: widen plan/grant constraints for the
-- Starter/Pro/Power tiers and their quarterly billing cycle.
-- Recreates the two constrained tables preserving all rows. Triggers from
-- 0027 reference these tables, so they are dropped before the swap and
-- re-created after by re-applying their original statements.

DROP TRIGGER IF EXISTS remoteradar_pack_charge_claim_validate;
DROP TRIGGER IF EXISTS remoteradar_pack_charge_claim_apply;
DROP TRIGGER IF EXISTS remoteradar_pack_charge_release_apply;

CREATE TABLE IF NOT EXISTS remoteradar_entitlements_new (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  plan_code TEXT NOT NULL CHECK (plan_code IN ('starter', 'pro_beta', 'power')),
  billing_interval TEXT NOT NULL CHECK (billing_interval IN ('month', 'quarter', 'year')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked')),
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  source_order_id TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES native_users(id) ON DELETE CASCADE,
  FOREIGN KEY (source_order_id) REFERENCES native_order_metadata(order_id) ON DELETE RESTRICT
);

INSERT INTO remoteradar_entitlements_new
  (id, user_id, plan_code, billing_interval, status, starts_at, ends_at, source_order_id, created_at, updated_at)
SELECT id, user_id, 'pro_beta', billing_interval, status, starts_at, ends_at, source_order_id, created_at, updated_at
  FROM remoteradar_entitlements
 WHERE plan_code = 'pro_beta';

DROP TABLE remoteradar_entitlements;
ALTER TABLE remoteradar_entitlements_new RENAME TO remoteradar_entitlements;

CREATE INDEX IF NOT EXISTS remoteradar_entitlements_user_active_idx
  ON remoteradar_entitlements(user_id, status, ends_at DESC);

CREATE TABLE IF NOT EXISTS remoteradar_credit_grants_new (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  grant_type TEXT NOT NULL CHECK (grant_type IN ('free_monthly', 'pro_monthly', 'credit_pack')),
  credits_total INTEGER NOT NULL CHECK (credits_total > 0),
  credits_remaining INTEGER NOT NULL CHECK (credits_remaining >= 0 AND credits_remaining <= credits_total),
  period_key TEXT,
  source_order_id TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES native_users(id) ON DELETE CASCADE,
  FOREIGN KEY (source_order_id) REFERENCES native_order_metadata(order_id) ON DELETE RESTRICT
);

INSERT INTO remoteradar_credit_grants_new
  (id, user_id, grant_type, credits_total, credits_remaining, period_key, source_order_id,
   expires_at, created_at, updated_at)
SELECT id, user_id, grant_type, credits_total, credits_remaining, period_key, source_order_id,
   expires_at, created_at, updated_at
  FROM remoteradar_credit_grants;

DROP TABLE remoteradar_credit_grants;
ALTER TABLE remoteradar_credit_grants_new RENAME TO remoteradar_credit_grants;

CREATE UNIQUE INDEX IF NOT EXISTS remoteradar_credit_grants_period_unique
  ON remoteradar_credit_grants(user_id, grant_type, period_key)
  WHERE period_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS remoteradar_credit_grants_order_unique
  ON remoteradar_credit_grants(source_order_id, grant_type)
  WHERE source_order_id IS NOT NULL AND grant_type = 'credit_pack';

CREATE INDEX IF NOT EXISTS remoteradar_credit_grants_spendable_idx
  ON remoteradar_credit_grants(user_id, expires_at, credits_remaining)
  WHERE credits_remaining > 0;

-- Restore the pack-metering triggers dropped above (bodies identical to 0027).
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
VALUES ('core_schema_version', '0054', CURRENT_TIMESTAMP);
