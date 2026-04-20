# Official Storefront Runtime Source-of-Truth Spec

Status: draft
Date: 2026-04-20
Owner: OSS storefront runtime
Linear issues: JIF-143, JIF-144, JIF-145

## Problem

Official theme updates currently span multiple layers that can drift apart:

- official source and artifact publication in `jiffoo-extensions-official`
- Marketplace/Admin installed-version state in `Jiffoo`
- storefront renderer code embedded in the host image
- production deployment image tags and rollout timing

This creates a split-brain update outcome:

1. Merchant Admin can show a new installed version.
2. The production host can run a newer container tag.
3. The live storefront can still render stale host-owned theme code or stale host chrome.

That breaks the expected WordPress/Shopify mental model where "theme updated" means the live storefront immediately reflects the new theme behavior.

## Goal

Define one canonical storefront runtime source of truth for official themes and the invariants required to keep live rendering aligned with installed version state.

## Scope

This spec covers:

- official shop theme runtime loading in `apps/shop`
- ownership boundaries between host chrome and theme-owned auth/storefront surfaces
- same-slug official theme upgrades
- rollout validation from published artifact to live branded domain

This spec does not redefine:

- plugin runtime ownership
- core commerce API semantics
- self-hosted updater publication semantics already defined in the updater docs

## Required Invariants

### Runtime truth

- The active storefront renderer for an installed official theme must resolve by `slug + version`, not by stale builtin host code.
- Builtin renderer copies may exist only as explicit migration bridges and must never silently override an installed official theme version.
- Embedded compatibility bridges must be explicitly allowlisted in `apps/shop`; the presence of a same-slug builtin theme copy is not enough to qualify.
- If the host cannot load the active theme package runtime, it must fall back explicitly and observably.

### Auth shell ownership

- Theme-owned auth pages must not receive extra host branding, navigation, or footer chrome.
- Host auth layout must stay neutral when the active theme provides `LoginPage` / `RegisterPage`.
- Theme header/footer must suppress themselves on auth routes unless explicitly designed otherwise.

### Commerce semantics

- Theme updates may change presentation and theme-owned navigation only.
- Theme updates must not fork cart, order, payment, or auth semantics.
- If a theme needs new behavior, it must go through the core storefront contract or the plugin gateway model.

### Upgrade propagation

- A successful same-slug theme upgrade must be visible on the next fresh storefront request.
- Theme activation and rollback must be version-scoped, not slug-only.
- Storefront cache invalidation must happen when theme version or activation state changes.

### Deployment validation

- Publishing an official `.jtheme` is not enough to claim live rollout completion.
- Releasing a new `shop` image is not enough to claim live rollout completion.
- Completion requires all of the following to agree:
  - official artifact catalog version
  - Admin installed/active version
  - host image/runtime version
  - branded live page output on the target domain

## Canonical Sources

| Question | Canonical source |
| --- | --- |
| What is the official theme source version? | `jiffoo-extensions-official` version pair |
| What is the installable artifact version? | published official artifact catalog |
| What version does Merchant Admin believe is installed? | `Jiffoo` official catalog + installed theme state |
| What code is actually rendering live? | active `shop` runtime loading path plus live branded HTML |

## Decision

We standardize the storefront runtime source of truth as:

1. `jiffoo-extensions-official` publishes the versioned official theme artifact.
2. `Jiffoo` records installed and active version state.
3. `apps/shop` must load the active official storefront runtime from the installed theme package version whenever that runtime exists.
4. Host-owned embedded theme code becomes migration-only compatibility fallback, not the long-term runtime truth.
5. Embedded compatibility fallback is allowed only for an explicit allowlist of legacy bridge themes until each one ships a packaged runtime.

## Acceptance Criteria

- Updating `modelsfind` from Merchant Admin causes the next fresh storefront request to reflect the upgraded runtime without requiring a host-specific theme copy to be updated manually.
- `girlsfind.vip/en/auth/login` no longer shows host `Jiffoo` branding or theme footer chrome when the active theme owns the auth surface.
- `girlsfind.vip/en/products` renders the active theme's intended runtime path instead of stale builtin behavior.
- The rollout checklist records container tag, artifact version, installed version, and live HTML verification in one place.

## References

- `docs/operations/official-storefront-runtime-source-of-truth-prd.md`
- `docs/operations/official-storefront-runtime-source-of-truth-prd-executable.md`
- `docs/adr/ADR-0002-official-storefront-runtime-single-source.md`
- `docs/theme-client-platform-contract.md`
- `docs/theme-client-first-wave-rollout.md`
