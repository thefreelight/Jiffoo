---
"jiffoo-api": minor
---

## Platform Evolution 2026 H2 — M4 Release

### Added

#### Agentic Commerce — API Token System
- **Scoped API tokens**: Lightweight token system (`jiffoo_` prefix) stored in SystemSettings with SHA-256 hashing, supporting scopes: `catalog:read`, `cart:write`, `checkout:create`, `orders:read`, `*`
- **Admin API**: CRUD routes at `/api/v1/admin/api-tokens` (create, list, revoke)
- **`dualAuthMiddleware`**: Unified auth middleware supporting both JWT and API tokens, mounted on cart (`cart:write`) and order (`checkout:create`) routes
- **9 integration tests** covering token lifecycle, scope enforcement, and JWT fallback

#### Platform Offers (Hosted Funnel Mount Point)
- **`PlatformOffersService`**: Reads display-only offer cards from SystemSettings (default empty)
- **`JIFFOO_DISABLE_PLATFORM_OFFERS=true`**: Forces empty array (complete opt-out)
- **Public endpoint**: `GET /api/v1/platform-offers`
- **Admin dashboard**: `PlatformOffersCards` component renders offers as cards with CTA links; renders nothing when empty
- **7 unit tests** covering disabled state, validation, and error handling

#### Shop Onboarding
- **`/setup` page**: Static client-side onboarding page shown when no API URL is configured
  - Input field to connect a self-hosted API instance (saved to localStorage)
  - External link to Jiffoo Cloud managed hosting
  - Cloudflare deploy documentation link
- **`docs/cloudflare-pages.md`**: Complete Cloudflare Pages deployment guide (dashboard + Wrangler CLI, env vars, troubleshooting)

#### Admin Dashboard Enhancements
- **`InstanceHealthCard`**: Compact version & health card on the dashboard showing:
  - Current version with update availability badge
  - Deployment mode (single-host / docker-compose / k8s)
  - Release channel (stable / prerelease)
  - Update feed connection status
  - Data from existing `/api/v1/upgrade/version` endpoint (display-only, no upgrade execution)

### License Notice
This release includes MIT-licensed SDK packages (`@jiffoo/mcp-server`, `@jiffoo/theme-api-sdk`, `@jiffoo/core-api-sdk`, `@jiffoo/create-jiffoo-app`) alongside the GPL-licensed core. See `LICENSE` and `LICENSE-EXCEPTIONS.md` for details.
