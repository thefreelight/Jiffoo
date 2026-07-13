# Plugin Runtime Inventory

> Generated: 2026-07-05
> Task: 2.1.1 — Inventory of all registered internal-fastify and external-http plugins

## 1. Extension Plugins (`extensions/plugins/`)

These are application-level plugins installed via the extension installer and
served through the plugin gateway (`/api/extensions/plugin/{slug}/api/*`).

| # | Slug | Runtime Type | Source | Target Trust Level | Notes |
|---|------|-------------|--------|-------------------|-------|
| 1 | `affiliate` | internal-fastify | local-zip | `builtin` or `official` | Affiliate marketing plugin |
| 2 | `ai-api-hub` | internal-fastify | local-zip | `builtin` or `official` | AI API aggregation |
| 3 | `apple-auth` | internal-fastify | local-zip | `builtin` or `official` | Apple Sign-In provider |
| 4 | `google-auth` | internal-fastify | local-zip | `builtin` or `official` | Google Sign-In provider |
| 5 | `imager-ai` | internal-fastify | local-zip | `builtin` or `official` | AI image processing |
| 6 | `smtp-email` | internal-fastify | local-zip | `builtin` or `official` | SMTP email provider |
| 7 | `wallet` | internal-fastify | local-zip | `builtin` or `official` | Customer wallet system |

**None** of these plugins currently declare a `trustLevel` in their manifest.
After task 2.3 enforcement lands, they will need `trustLevel: "builtin"` (or
`"official"` if signed) to continue running as `internal-fastify`.

## 2. Official Catalog Plugins (`packages/shared/.../official-catalog.ts`)

These are plugins listed in the official marketplace catalog. Those with
`deliveryMode: 'package-managed'` are built via `build:official-artifacts` and
distributed as signed ZIP packages.

| # | Slug | Kind | Delivery Mode | Target Trust Level | Notes |
|---|------|------|---------------|-------------------|-------|
| 1 | `imagic-core` | plugin | package-managed | `official` | AI image core |
| 2 | `quiet-curator-cms` | plugin | package-managed | `official` | CMS plugin |
| 3 | `ai-gateway-core` | plugin | package-managed | `official` | AI gateway |
| 4 | `stripe` | plugin | package-managed | `official` | Payment processor |
| 5 | `i18n` | plugin | package-managed | `official` | Internationalization |
| 6 | `odoo` | plugin | package-managed | `official` | Odoo ERP integration |
| 7 | `admin-security` | plugin | package-managed | `official` | Admin security hardening |
| 8 | `partner-network` | plugin | package-managed | `official` | Partner network |
| 9 | `support-hub` | plugin | package-managed | `official` | Support ticket hub |

All official catalog plugins are expected to run as `internal-fastify` with
`trustLevel: "official"` (signature verified via Ed25519).

## 3. Framework-Level Built-in Plugins (`apps/api/src/plugins/`)

These are Fastify framework plugins registered directly in the server setup,
**not** served through the plugin gateway. They are part of the core API process
and are not subject to the two-tier trust model.

| File | Purpose | Trust Level |
|------|---------|-------------|
| `cache-control.ts` | HTTP cache-control headers | N/A (framework) |
| `compression.ts` | Response compression | N/A (framework) |
| `rate-limiter.ts` | API rate limiting | N/A (framework) |
| `security-headers.ts` | Security headers | N/A (framework) |
| `email-providers/resend-provider.ts` | Resend email provider | N/A (framework) |

## 4. Summary

| Category | Count | Runtime Type | Trust Model Impact |
|----------|-------|-------------|-------------------|
| Extension plugins (local) | 7 | All internal-fastify | Need `trustLevel` field added to manifests |
| Official catalog plugins | 9 | Expected internal-fastify | Signed packages → `official` trust level |
| Framework built-in | 5 | N/A (not gateway-served) | No change needed |
| **Total** | **21** | | |

## 5. Grace Mode Impact

Per task 2.3.3, currently installed plugins without `trustLevel` will enter
**grace mode** on upgrade:
- Startup `warn` log for each untrusted internal-fastify plugin
- Admin plugin center shows yellow warning banner
- Plugins continue to function (not disabled)
- `INTERNAL_PLUGIN_ENFORCEMENT_VERSION` constant tracks the target enforcement version

The 7 local extension plugins will all enter grace mode until their manifests
are updated with `trustLevel: "builtin"`.
