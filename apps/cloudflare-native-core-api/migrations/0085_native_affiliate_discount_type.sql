-- Affiliate (creator) promo codes: the buyer discount is either a
-- percentage that stacks on a running promotion, or a fixed amount off the
-- order. discount_rate keeps holding the value for both types; every
-- existing row stays a percentage.
ALTER TABLE native_affiliate_partners ADD COLUMN discount_type TEXT NOT NULL DEFAULT 'percentage';

INSERT OR REPLACE INTO runtime_metadata (key, value, updated_at)
VALUES ('core_schema_version', '0085', CURRENT_TIMESTAMP);
