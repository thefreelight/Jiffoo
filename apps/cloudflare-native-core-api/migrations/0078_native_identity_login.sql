-- Native identity login: OAuth-based customer sign-in and explicit account
-- linking through configured identity providers (identity v1 semantics ported
-- from the self-hosted line). Additive only:
-- - native_external_identities binds a verified external identity
--   (issuer + subject, unique) to a native_users row. Identical email strings
--   never merge accounts: linking is decided by issuer+subject only.
-- - native_identity_transactions holds one OAuth handshake each: the state is
--   stored hashed, the PKCE verifier/nonce/provider material stays sealed
--   (AES-256-GCM), claims only become queryable after provider verification,
--   and a one-time 60-second handoff hands the verified identity to the
--   original browser for exchange.
-- - native_users.password_set marks identity-only accounts (0 = no known
--   password; the stored hash is random and unusable) so the last-identity
--   guard can protect them. Existing rows keep password_set = 1 and every
--   password path is untouched.
ALTER TABLE native_users ADD COLUMN password_set INTEGER NOT NULL DEFAULT 1
  CHECK (password_set IN (0, 1));

CREATE TABLE IF NOT EXISTS native_external_identities (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider_slug TEXT NOT NULL,
  issuer TEXT NOT NULL,
  subject TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS native_external_identities_issuer_subject_key
  ON native_external_identities (issuer, subject);
CREATE INDEX IF NOT EXISTS native_external_identities_user_idx
  ON native_external_identities (user_id);

CREATE TABLE IF NOT EXISTS native_identity_transactions (
  id TEXT PRIMARY KEY,
  provider_slug TEXT NOT NULL,
  issuer TEXT NOT NULL,
  state_hash TEXT NOT NULL UNIQUE,
  binding_hash TEXT NOT NULL,
  encrypted_payload TEXT,
  intent TEXT NOT NULL CHECK (intent IN ('login', 'link')),
  return_to TEXT NOT NULL,
  locale TEXT NOT NULL,
  finish_origin TEXT NOT NULL,
  user_id TEXT,
  expires_at TEXT NOT NULL,
  claimed_at TEXT,
  verified_identity_json TEXT,
  handoff_hash TEXT UNIQUE,
  handoff_expires_at TEXT,
  consumed_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS native_identity_transactions_expires_idx
  ON native_identity_transactions (expires_at);
CREATE INDEX IF NOT EXISTS native_identity_transactions_user_idx
  ON native_identity_transactions (user_id);

INSERT OR REPLACE INTO runtime_metadata (key, value, updated_at)
VALUES ('core_schema_version', '0078', CURRENT_TIMESTAMP);
