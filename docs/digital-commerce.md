# Digital Commerce — Virtual Goods Fulfillment in Jiffoo

> Jiffoo provides first-class support for selling digital products: eSIM data plans, gift cards, redemption codes, software licenses, and downloadable assets — with automated fulfillment that delivers credentials to customers instantly after payment.

## Overview

Unlike traditional e-commerce platforms that treat digital products as a variant of physical goods (with "shipping" replaced by a download link), Jiffoo models digital fulfillment as a **distinct commerce path** with its own product types, delivery mechanisms, and storefront templates.

### Supported Digital Product Types

| Product Type | Fulfillment Method | Delivery Channel | Example |
|---|---|---|---|
| `esim` | QR code / activation code | Email + Dashboard | Travel eSIM data plan |
| `card` | Redemption code / license key | Email + Dashboard | Gift card, game code, software license |
| `data` | Download link (time-limited) | Email + Dashboard | E-book, digital art, software download |
| `physical` | Shipping (standard) | Logistics | Traditional physical goods |

### End-to-End Fulfillment Flow

```
1. Customer places order (Cart → Checkout)
     └─ Order created with PENDING status

2. Payment processed (Stripe / plugin gateway)
     └─ Payment webhook → order marked PAID

3. Automated fulfillment triggered
     ├─ External order service calls supplier plugin (for supplier-connected products)
     ├─ Polls for fulfillment data (QR code, card UID, plan ID, download link)
     └─ Updates OrderItem.fulfillmentData

4. Delivery to customer
     ├─ Order success page displays credentials (QR code, redemption code, download link)
     ├─ Order detail page (account dashboard) shows persistent access
     └─ Digital delivery email sent with credentials
```

## Vertical Templates

Jiffoo's `create-jiffoo-app` CLI includes purpose-built templates for digital commerce:

### Digital Goods Store (`--template digital-goods`)

```bash
npx create-jiffoo-app my-store --template digital-goods
```

- **Theme**: Digital Vault — optimized for card-code, account, and download commerce flows
- **Seed data**: Sample gift cards, game codes, software licenses, e-books
- **Configuration**: Enables digital fulfillment, sets `digital-vault` as active theme
- **Use case**: Selling gift cards, software licenses, game codes, digital downloads

### eSIM Mall (`--template esim`)

```bash
npx create-jiffoo-app my-esim-shop --template esim
```

- **Theme**: eSIM Mall — travel-focused design for eSIM data plan sales
- **Seed data**: Sample global, regional, and country-specific eSIM plans
- **Configuration**: Enables digital fulfillment, sets `esim-mall` as active theme
- **Use case**: Telecom / travel-tech companies selling eSIM data plans with QR code delivery

## How Jiffoo Differs from Medusa and Saleor

### Fulfillment Model Comparison

| Aspect | Jiffoo | Medusa | Saleor |
|---|---|---|---|
| Digital product types | Explicit (`esim`, `card`, `data`) | Generic "digital" flag | Generic digital product variant |
| Fulfillment data model | `OrderItem.fulfillmentData` (structured JSON: QR codes, card UIDs, plan IDs, download links) | Custom field on fulfillment | Custom metadata on fulfillment |
| Automated fulfillment | Built-in: payment → auto-fulfill → delivery (no manual step) | Requires custom subscriber or plugin | Requires webhook/app integration |
| Supplier integration | Plugin gateway with external order polling (supplier plugins return fulfillment data) | Custom fulfillment module | App-based integration |
| Delivery channels | Email + order success page + account dashboard (all built-in) | Custom email template needed | Custom notification needed |
| eSIM-specific support | First-class: QR code delivery, plan activation, regional coverage modeling | Not available out-of-box | Not available out-of-box |
| Vertical templates | `--template digital-goods`, `--template esim` with pre-configured themes + seed data | No vertical templates | No vertical templates |

### Key Differentiators

1. **eSIM as a first-class use case**: Jiffoo is the only open-source e-commerce platform with a dedicated eSIM template and theme. The `esim-mall` theme includes QR code display, plan coverage visualization, and regional filtering — purpose-built for telecom/travel businesses.

2. **Structured fulfillment data**: Rather than stuffing digital delivery info into a generic "notes" or "custom field" on a fulfillment record, Jiffoo's `OrderItem.fulfillmentData` is a typed JSON structure that themes can render intelligently:
   - `qrCode` — base64 image or data URL for eSIM activation
   - `redemptionCode` — alphanumeric code for gift cards / licenses
   - `downloadUrl` — time-limited download link for digital assets
   - `planId` / `activationUrl` — for subscription / account-based products

3. **Supplier plugin ecosystem**: For merchants who source digital products from upstream suppliers (eSIM carriers, game code distributors), Jiffoo's plugin gateway handles the full supplier integration loop: create external order → poll for fulfillment status → sync fulfillment data back to the customer's order.

4. **Instant delivery across all surfaces**: When payment succeeds, credentials appear simultaneously on:
   - The order success page (immediate, post-checkout)
   - The order detail page in the customer's account (persistent access)
   - The digital delivery email (for customers who close the browser)

## Configuration

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `JIFFOO_DIGITAL_FULFILLMENT_ENABLED` | `false` | Enables digital fulfillment processing |
| `JIFFOO_ACTIVE_THEME_SLUG` | `builtin-default` | Theme to activate for the storefront |
| `JIFFOO_SEED_PROFILE` | `default` | Seed data profile (determines which sample products are inserted) |

### Theme Activation

Digital commerce themes (`digital-vault`, `esim-mall`) are activated via:

1. **Template CLI** (recommended): `create-jiffoo-app --template digital-goods` sets `JIFFOO_ACTIVE_THEME_SLUG` automatically
2. **Admin UI**: Navigate to Admin → Settings → Themes and activate the desired theme
3. **Environment variable**: Set `JIFFOO_ACTIVE_THEME_SLUG=digital-vault` in `.env`

## Developer Resources

- [Create App CLI README](../packages/create-jiffoo-app/README.md) — Template usage and custom template creation
- [Digital Vault Theme](../packages/shop-themes/digital-vault/) — Digital goods storefront theme
- [eSIM Mall Theme](../packages/shop-themes/esim-mall/) — eSIM marketplace theme
- [Digital Fulfillment Audit](../.kiro/specs/platform-evolution-2026h2/digital-fulfillment-audit.md) — End-to-end flow audit and gap analysis
- [Plugin Development Guide](../EXTERNAL_PLUGIN_DEVELOPMENT_GUIDE.md) — Building supplier plugins for digital fulfillment

## Roadmap

- **B2B × Digital Goods**: Batch redemption code procurement, bulk license management, and corporate eSIM provisioning (see `b2b-digital-goods-proposal.md`)
- **Download expiry & revocation**: Time-limited download links with server-side revocation
- **License key management**: Pool-based license key allocation with deactivation support
