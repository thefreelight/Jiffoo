-- Admin-owned storefront copy overrides.
-- The Odoo catalog sync keeps flowing into core_api_snapshots; these rows win
-- at read time so each B-end operator edits storefront copy (description first)
-- in the Jiffoo admin instead of the shared Odoo backend. Sync never writes
-- here, and deleting a row falls the product back to the synced copy.
CREATE TABLE IF NOT EXISTS native_product_copy_overrides (
  product_id TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  updated_by TEXT,
  updated_at TEXT NOT NULL
);

INSERT OR REPLACE INTO runtime_metadata (key, value, updated_at)
VALUES ('core_schema_version', '0070', CURRENT_TIMESTAMP);
