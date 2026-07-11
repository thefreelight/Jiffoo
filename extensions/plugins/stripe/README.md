# Stripe Payments Plugin

Official Stripe payment wrapper for Jiffoo Mall.

## Runtime

- `runtimeType`: `internal-fastify`
- `entryModule`: `dist/index.js`
- `category`: `payment`

## What It Does

- Registers Stripe as an official payment plugin so it can be installed and enabled from Admin.
- Exposes an admin console showing whether the current deployment has the required Stripe environment variables.
- Reuses the core platform Stripe payment routes and service implementation.

## Required Environment

- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

Production deployments should also configure:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

## Packaging

```bash
npm run validate
npm run pack
```
