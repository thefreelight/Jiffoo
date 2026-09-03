CREATE INDEX IF NOT EXISTS idx_native_bokmoo_claim_sessions_user ON native_bokmoo_card_claim_sessions(user_id, status, created_at DESC)
