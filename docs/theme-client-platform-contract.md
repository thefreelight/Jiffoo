# Cross-Platform Theme Client Contract

Status: Draft  
Last updated: 2026-04-20

## Why This Document Exists

Jiffoo already has three separate but related layers:

- the core commerce API and storefront runtime in this repository
- the open-source mobile foundation in `jiffoo-mall-mobile`
- the open-source desktop foundation in `jiffoo-mall-desktop`

Today, web storefronts can switch themes, and some themes already carry their own renderer or theme-facing API helpers. That is useful, but it creates a risk: mobile, desktop, and future custom clients may each interpret "theme support" differently and drift away from the core contract.

This document defines the contract boundary we want all storefront clients to follow so theme changes stay understandable, testable, and upgradeable across repositories.

## Current Source Of Truth

This repository already owns the canonical public storefront contract.

Existing building blocks:

- core storefront APIs are published from the Fastify API and OpenAPI surface
- store identity and active theme are resolved through `GET /api/store/context` and `GET /api/themes/active`
- installed theme resources are served from `/extensions/themes/{target}/{slug}`
- executable theme apps are proxied through `/theme-app/{target}/{slug}/...`
- theme packs may declare embedded renderer hints through `x-jiffoo-renderer-mode` and `x-jiffoo-renderer-slug`
- theme-facing consumers can already use `@jiffoo/theme-api-sdk`

Relevant implementation references in this repo:

- `apps/shop/lib/store-context.ts`
- `apps/shop/lib/theme-pack/loader.ts`
- `apps/shop/lib/theme-pack/rendering-mode.ts`
- `packages/theme-api-sdk/src/client.ts`
- `apps/api/src/core/admin/theme-management/routes.ts`
- `apps/api/src/core/admin/theme-app-runtime/gateway.ts`

Related architecture docs:

- `docs/operations/official-storefront-runtime-source-of-truth-spec.md`
- `docs/operations/official-storefront-runtime-source-of-truth-prd.md`
- `docs/operations/official-storefront-runtime-source-of-truth-prd-executable.md`
- `docs/adr/ADR-0002-official-storefront-runtime-single-source.md`

## Decision Summary

### 1. A theme switch must not fork the commerce API surface

Changing theme may change:

- visual tokens
- templates
- renderer selection
- active extensions
- client adapter selection

Changing theme must not silently redefine:

- product API semantics
- cart API semantics
- order API semantics
- payment API semantics
- auth API semantics

If a new business capability is required, it must be added to the core contract or exposed through the existing extension/plugin gateway model, not hidden inside one client.

### 1A. Official storefront runtime must resolve from one versioned source

For official themes, the storefront runtime must resolve from the installed active theme package version whenever that package ships a runtime.

Implications:

- `slug + version` is the runtime lookup key for official theme behavior
- builtin host copies are migration-only compatibility bridges
- a successful official theme update must not depend on a separate host-side embedded copy being manually kept in sync
- branded live HTML is the final verification surface, not just Admin version cards

### 2. Themes are not clients

A theme describes how a storefront should look and how theme-owned presentation resources should be loaded.

A client is the runtime that consumes the storefront contract. Current client families are:

- web shop
- mobile
- desktop
- downstream custom apps or shells

The same theme slug may be rendered differently by different client families, but those clients should still resolve the same store and commerce state from the same core contract.

### 2A. Host auth layout must stay neutral when the theme owns auth

When a theme provides `LoginPage` / `RegisterPage`, the host runtime must not wrap those pages with extra host branding, footer chrome, or duplicate navigation. Theme-owned auth surfaces are part of the storefront presentation contract.

### 3. Mobile and desktop should follow a profile/capability model, not ad hoc theme forks

The mobile repository already has a strong pattern around:

- public API catalog
- stability tiers
- compatibility lab

The desktop repository already has a strong pattern around:

- profile schema
- capability-gated runtime
- source-of-truth contract ownership in core

We should reuse those patterns instead of inventing a separate theme integration story for every new client.

## Contract Layers

### Layer A: Stable Commerce Contract

This is the baseline that every storefront client consumes.

Minimum cross-client surface:

- `GET /api/store/context`
- `GET /api/themes/active`
- `GET /api/themes/installed`
- `GET /api/products`
- `GET /api/products/:id`
- `GET /api/products/categories`
- `GET /api/cart`
- cart mutation endpoints
- order endpoints
- payment session endpoints
- auth/profile endpoints when the client supports authenticated flows
- plugin gateway endpoints when the theme or client uses plugin-backed features

This layer should be versioned and documented as a client-facing surface, with stability tiers similar to the mobile foundation:

- `stable`
- `experimental`
- `internal`

Recommendation:

- treat `store/context`, `themes/active`, core catalog/cart/order/payment endpoints, and the theme app gateway path shape as explicit storefront-client contracts
- keep the stable public surface intentionally small

### Layer B: Theme Presentation Contract

This is the theme-owned presentation layer.

Today it already includes:

- `theme.json`
- tokens CSS
- page templates
- assets
- settings schema
- embedded renderer hints

This layer decides presentation strategy:

- builtin embedded renderer
- downloaded theme pack resources
- executable theme app via gateway

This layer should remain presentation-oriented. It should not become the place where native or desktop app business rules are invented.

### Layer C: Storefront Client Contract

This should become the canonical machine-readable contract for non-web storefront clients.

Recommended fields:

```json
{
  "schemaVersion": 1,
  "id": "reference-mobile",
  "family": "mobile",
  "displayName": "Jiffoo Mall Mobile",
  "supportedThemeModes": ["embedded", "pack", "theme-app"],
  "supportedExtensions": ["app_block", "app_embed"],
  "capabilities": [
    "auth",
    "catalog",
    "cart",
    "checkout",
    "orders",
    "payments",
    "deep-link",
    "offline-cache"
  ],
  "commerceApiTier": "stable",
  "themePresentationTier": "experimental",
  "minimumCoreVersion": "0.1.0"
}
```

Notes:

- mobile can store this as a profile or public API catalog entry
- desktop can extend its existing profile schema or reference a sibling storefront profile document
- downstream custom apps should be able to adopt the same format

### Layer D: Theme-To-Client Adapter Registry

This is the missing piece today.

We need one source of truth that answers:

- for theme `X`, which official mobile adapter exists
- for theme `X`, which official desktop adapter exists
- what renderer mode each client should use
- what minimum client version is required
- which capabilities or extensions are required

Recommended shape:

```json
{
  "schemaVersion": 1,
  "themeSlug": "builtin-default",
  "targets": {
    "web": {
      "clientId": "shop-web",
      "rendererMode": "embedded"
    },
    "mobile": {
      "clientId": "reference-mobile",
      "profileId": "default-mobile",
      "rendererMode": "native",
      "minimumClientVersion": "0.1.0"
    },
    "desktop": {
      "clientId": "reference-desktop",
      "profileId": "reference-desktop",
      "rendererMode": "native",
      "minimumClientVersion": "0.1.0"
    }
  }
}
```

Recommended ownership:

- canonical registry lives in core or `jiffoo-extensions-official`
- mobile and desktop consume it
- clients may add private overlays downstream, but should not redefine the core contract

## Recommended Rule Set

### Hard rules

- core owns storefront commerce semantics
- themes own presentation semantics
- clients own runtime and device capability semantics
- theme switches must not imply private endpoint forks
- plugin-backed features must go through the existing extension/plugin gateway model
- if mobile or desktop needs a new storefront contract, the change starts in core

### Preferred rules

- avoid native-client-specific fields inside `theme.json` unless they are purely descriptive
- prefer a separate theme-to-client adapter registry over stuffing repo or release metadata into theme manifests
- keep official mobile and desktop adapters documented as profiles, not hidden conventions
- require migration notes for breaking changes to any `stable` storefront-client contract

## Documentation Set We Should Maintain

To keep three repositories aligned, one document is not enough. We should keep a small documentation set with clear ownership.

### In `Jiffoo` (this repo)

- `docs/theme-client-platform-contract.md`
  - this document
- `docs/theme-client-api-catalog.json`
  - machine-readable catalog of storefront-client-facing contracts with stability tiers
- `docs/theme-client-adapter-registry.json`
  - machine-readable map of theme-to-client adapter ownership and rollout status
- `docs/theme-client-compatibility-matrix.md`
  - which official clients support which theme modes and extensions
- `docs/theme-client-official-theme-support.json`
  - machine-readable theme-by-theme support inventory for official clients
- `docs/theme-client-official-theme-support.md`
  - human-readable inventory and label semantics
- `docs/theme-client-first-wave-rollout.md`
  - phased implementation plan for the first official cross-client theme wave
- `docs/theme-client-first-wave-backlog.json`
  - machine-readable backlog for the first official cross-client theme wave

### In `jiffoo-mall-mobile`

- keep the public API catalog and stability tiers
- add a storefront client profile or contract doc that points back to core as source of truth
- document which theme modes are supported by the mobile foundation

### In `jiffoo-mall-desktop`

- keep the profile schema and capability model
- add storefront-theme support notes that point back to core as source of truth
- document how the desktop profile resolves active theme and extensions from core

## Suggested API Catalog Structure

The mobile repo already uses a public API catalog plus stability tiers. We should adopt the same pattern here for storefront-client contracts.

Recommended catalog entries:

```json
{
  "version": 1,
  "tiers": ["stable", "experimental", "internal"],
  "contracts": [
    {
      "id": "store-context",
      "tier": "stable",
      "path": "/api/store/context",
      "owner": "core",
      "consumers": ["web", "mobile", "desktop"]
    },
    {
      "id": "active-theme",
      "tier": "stable",
      "path": "/api/themes/active",
      "owner": "core",
      "consumers": ["web", "mobile", "desktop"]
    },
    {
      "id": "theme-pack-manifest",
      "tier": "experimental",
      "path": "/extensions/themes/{target}/{slug}/theme.json",
      "owner": "core-theme-pack",
      "consumers": ["web", "mobile", "desktop"]
    },
    {
      "id": "theme-app-gateway",
      "tier": "experimental",
      "path": "/theme-app/{target}/{slug}/...",
      "owner": "core-theme-app",
      "consumers": ["web", "mobile", "desktop"]
    }
  ]
}
```

## Compatibility Lab

The mobile repo already has the right mental model: releases should be gated by downstream confidence, not only local compilation.

We should apply the same idea here.

Recommended compatibility lab checks:

- core API contract smoke tests pass
- `shop` web runtime still resolves active theme and store context
- official mobile reference client passes smoke tests against the reference core deployment
- official desktop reference client passes smoke tests against the reference core deployment
- theme pack manifest fixtures still validate
- theme app gateway fixtures still validate
- migration notes exist for every `stable` contract change with downstream impact

## Theme Support Modes

We should document theme support in terms of explicit modes instead of vague statements like "mobile supports the theme".

Recommended support matrix fields:

- theme slug
- mode: `embedded`, `pack`, `theme-app`, `native-adapter`
- official web support
- official mobile support
- official desktop support
- extension support: `app_block`, `app_embed`
- special capabilities required
- minimum client version

Example:

| Theme | Web | Mobile | Desktop | Notes |
| --- | --- | --- | --- | --- |
| `builtin-default` | embedded | native-adapter | native-adapter | baseline OSS-safe theme |
| `yevbi` | pack + embedded renderer | native-adapter | native-adapter | must align on theme-facing SDK usage |
| `imagic-studio` | pack + plugin-backed extensions | limited | limited | plugin-heavy theme, document capability gaps explicitly |

## Recommended Delivery Plan

### Phase 1: Lock the rule set

- approve this source-of-truth model
- explicitly state that theme switches do not fork commerce semantics
- align mobile and desktop maintainers on the same vocabulary

### Phase 2: Publish machine-readable catalogs

- add storefront-client API catalog to core
- add or align client profile documents in mobile and desktop
- define a theme-to-client adapter registry

### Phase 3: Publish official compatibility matrix

- declare which official clients support which official themes
- separate supported, partial, and unsupported states

### Phase 4: Add compatibility automation

- add smoke tests across core + official mobile + official desktop
- require migration notes for stable contract changes

## Guidance For Downstream Custom Apps

Downstream custom apps should be encouraged to follow this model:

1. Consume the core storefront contract first.
2. Resolve store and active theme from core instead of hardcoding theme assumptions.
3. Adopt the official client profile format.
4. Reuse official mobile or desktop adapters when possible.
5. If custom capabilities are needed, add them as client capabilities, not as hidden API forks.
6. If a truly new storefront contract is needed, upstream it to core first.

This keeps private customization possible without destroying upgradeability.

## Recommendation

The best path is not "one more theme document". The best path is:

- one authoritative cross-platform contract document in core
- one machine-readable storefront-client API catalog in core
- one theme-to-client adapter registry
- one compatibility matrix across official themes and official clients
- one compatibility lab process shared by core, mobile, and desktop

That gives the team a single answer to:

- what changes when a theme changes
- what does not change when a theme changes
- which client owns which runtime behavior
- how downstream teams add custom apps without inventing a new contract every time
