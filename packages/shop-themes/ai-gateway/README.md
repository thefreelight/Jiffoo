# AI Gateway Theme

AI Gateway Theme is the storefront-facing surface for Jiffoo's AI gateway solution package.

It is intentionally not the whole product by itself:

- the theme owns brand, landing, pricing, docs, and launch-oriented storefront presentation
- the companion runtime capability lives in the `ai-gateway-core` plugin
- the full merchant delivery is expected to happen through a package/bundle flow in `jiffoo-mall-core`

## Product intent

This theme is designed for a product-site / landing-commerce storefront shape rather than a plain product-grid shop.

The goal is:

- present the gateway as a ready-to-launch solution
- highlight model routing, quota, billing, observability, and provider flexibility
- guide merchants into setup instead of dropping them into an empty shell

## Reference source

The product direction is informed by `../new-api`, but this package is not a code transplant.

We reuse the capability checklist and merchant flows:

- multi-provider routing
- channel / key management
- token + quota concepts
- usage and billing views
- setup-first onboarding

while keeping the asset aligned to Jiffoo's own package + managed-mode model.
