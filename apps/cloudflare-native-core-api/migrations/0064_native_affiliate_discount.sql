-- Affiliate promo codes: per-partner buyer discount percentage (0 = no
-- discount). Promo codes double as referral attribution at checkout.
ALTER TABLE native_affiliate_partners ADD COLUMN discount_rate REAL NOT NULL DEFAULT 0;
ALTER TABLE native_order_metadata ADD COLUMN affiliate_partner_id TEXT REFERENCES native_affiliate_partners(id);
