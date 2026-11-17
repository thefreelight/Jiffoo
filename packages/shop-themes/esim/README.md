# eSIM Route Mall (esim) Theme

Bokmoo is an embedded official storefront theme for premium travel connectivity:

- destination eSIM plans
- regional travel passes
- instant QR delivery
- setup-first onboarding
- premium black-and-gold brand presentation

The homepage is 路线通 (Route Planner): pick destinations, tune days and
usage, and the storefront deterministically verifies which single eSIM
covers the whole trip — zero model calls. Deployed as its own worker
(esim.bokmoo.com) pinned to slug `esim` via THEME_SLUG_PIN while sharing
the bokmoo core API, users, orders and payments.
