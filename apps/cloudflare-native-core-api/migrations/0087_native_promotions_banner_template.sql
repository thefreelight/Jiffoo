-- A promotion's banner on the storefront is drawn by a template. Rows written before templates existed
-- keep the plain announcement bar ("default"); "campaign" is the bar with a badge, the offer in gold, the
-- window and a countdown. The words of the banner stay in banner_json, which gains optional fields per language.
ALTER TABLE native_promotions ADD COLUMN banner_template TEXT NOT NULL DEFAULT 'default';

INSERT OR REPLACE INTO runtime_metadata (key, value, updated_at)
VALUES ('core_schema_version', '0087', CURRENT_TIMESTAMP);
