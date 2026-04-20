# ADR-0002: Official Storefront Runtime Must Resolve From One Source Of Truth

Status: accepted
Date: 2026-04-20

## Context

Official theme rollout currently crosses multiple independently moving layers:

- official source and artifact release
- Admin installed/active version state
- host image version
- branded live storefront rendering

We observed a concrete failure mode on `girlsfind.vip`:

- Merchant Admin reported the latest installed `modelsfind` version
- the host containers were upgraded
- the branded storefront still served stale auth/layout behavior

This means "theme updated" was not equivalent to "live storefront updated."

## Decision

We treat the installed theme package version as the canonical storefront runtime source of truth for official themes.

Specifically:

- `jiffoo-extensions-official` remains the canonical source and artifact publication repository for official themes.
- `Jiffoo` records installed and active version state.
- `apps/shop` must resolve the active official storefront runtime by `slug + version` when the installed theme package provides one.
- builtin host renderer copies are allowed only as explicit migration fallbacks.
- embedded migration fallbacks must be explicitly allowlisted; a matching same-slug host package does not qualify by default.
- host auth layout must remain neutral when the active theme provides its own auth pages.
- release completion for official theme rollout requires branded live HTML verification, not only container tag or Admin version state.

## Consequences

### Positive

- Theme updates behave more like real runtime updates instead of metadata-only flips.
- Debugging shifts from ambiguous guesswork to a smaller set of explicit checks.
- Host chrome leakage into theme-owned auth pages becomes an architectural violation, not a styling accident.

### Trade-offs

- `apps/shop` runtime resolution becomes more explicit and version-aware.
- Migration fallback paths must stay observable until all official themes are on the new model.
- Release and deployment checklists become stricter because live branded verification is now mandatory.

## Rejected Alternatives

### Keep builtin host theme copies as the long-term runtime truth

Rejected because it allows the live storefront to drift away from the installed official theme package version.

### Treat container tag upgrades as sufficient evidence of storefront rollout

Rejected because a new host image can still serve stale embedded renderer behavior or stale host auth chrome.

### Let host auth layout wrap all auth pages unconditionally

Rejected because it makes theme-owned auth surfaces impossible to reason about and causes cross-brand leakage on branded domains.
