-- The plans on a card as the app last read it: one row per card and ICCID.
-- The card itself stays in native_bokmoo_cards; this is what support reads to
-- see which plans a customer keeps on the card and which of them were bought here.
CREATE TABLE IF NOT EXISTS native_bokmoo_card_profiles (
  eid TEXT NOT NULL,
  iccid TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0,
  name TEXT NOT NULL DEFAULT '',
  provider TEXT NOT NULL DEFAULT '',
  source TEXT,
  synced_at TEXT NOT NULL,
  PRIMARY KEY (eid, iccid)
);

CREATE INDEX IF NOT EXISTS idx_native_bokmoo_card_profiles_iccid ON native_bokmoo_card_profiles (iccid);

INSERT OR REPLACE INTO runtime_metadata (key, value, updated_at)
VALUES ('core_schema_version', '0088', CURRENT_TIMESTAMP);
