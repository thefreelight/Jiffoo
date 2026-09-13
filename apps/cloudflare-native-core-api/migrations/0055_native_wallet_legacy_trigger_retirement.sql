-- Converge databases initialized with the legacy 0025 wallet design.
-- Migration 0025 once maintained wallet state with AFTER/BEFORE triggers;
-- the d1-compat rewrite moved all mutations into the application code.
-- Databases created before the rewrite kept the triggers, so every credit,
-- reservation hold, and settlement was applied twice (code + trigger), which
-- inflated total_credited/reserved_balance and made code-computed UPDATEs
-- throw CHECK-constraint aborts inside nativeWalletFinish. The 2026-09-13
-- RemoteRadar production outage (PACK_METERING_FAILED 503 on pack settle)
-- measured this: one 1,500-credit grant wrote total_credited = 3,000 and the
-- settle reservation UPDATE was silently applied by the trigger before the
-- code's own settle batch aborted. Remove the legacy triggers so every
-- instance matches the single-writer semantics in native-wallet.ts.
DROP TRIGGER IF EXISTS native_wallet_ledger_validate;
DROP TRIGGER IF EXISTS native_wallet_ledger_apply;
DROP TRIGGER IF EXISTS native_wallet_reservation_validate;
DROP TRIGGER IF EXISTS native_wallet_reservation_hold;
DROP TRIGGER IF EXISTS native_wallet_reservation_settle;
DROP TRIGGER IF EXISTS native_wallet_reservation_release;

INSERT OR REPLACE INTO runtime_metadata (key, value, updated_at)
VALUES ('core_schema_version', '0055', CURRENT_TIMESTAMP);
