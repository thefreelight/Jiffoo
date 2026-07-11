# Store Localization Plugin

Official localization plugin for Jiffoo Mall.

## Runtime

- `runtimeType`: `internal-fastify`
- `entryModule`: `src/index.js`
- `adminUi.entryPath`: `/admin`

## What It Does

- Shows the current default storefront locale and supported locales.
- Lets merchants update storefront language settings from the plugin admin console.
- Reuses the platform store-management API rather than starting a separate service.

## Packaging

```bash
npm run validate
npm run pack
```
