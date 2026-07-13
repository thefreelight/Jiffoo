# Official Storefront Runtime Source-of-Truth PRD

Status: draft
Date: 2026-04-20
Owner: OSS storefront runtime
Linear issues: JIF-143, JIF-144, JIF-145

## Why This Matters

Merchants expect theme updates to behave like WordPress or Shopify:

- update the theme
- refresh the storefront
- see the new result

Right now Jiffoo can violate that expectation because "theme update" spans too many independently moving layers. A branded domain can show:

- new version in Admin
- new version in the official catalog
- new host container tag
- old storefront output

That makes updates feel untrustworthy and forces repeated manual investigation.

## User Problems

### Merchant / operator

- "Admin says I installed the latest version, but the storefront still looks old."
- "I fixed auth or navigation in the theme, but the live site still shows host chrome."
- "I cannot tell whether I need a theme reinstall, a host redeploy, or both."

### Internal engineering

- theme source, host renderer, and deployment state can each be correct in isolation while the live site is still wrong
- debugging requires checking too many repos and deployment layers
- release completion is easy to overclaim because version numbers move before live rendering converges

## Product Outcomes

- Official theme updates behave like real runtime updates, not metadata-only updates.
- Host chrome stops leaking into theme-owned auth pages.
- Theme version, installed state, and live rendering converge on one observable truth.
- Rollout debugging becomes a checklist instead of a forensic exercise.

## Functional Requirements

1. `shop` must resolve the active official storefront runtime from the installed theme package version whenever the package ships a runtime bundle.
2. Builtin host theme copies must be treated as migration-only fallbacks and never silently win over an installed official version.
3. Compatibility fallback to embedded host renderer code must require an explicit allowlist, not just a matching slug.
4. Theme activation and same-slug upgrade must invalidate storefront runtime caches.
5. Theme-owned auth pages must render without host branding or extra host footer/header chrome.
6. Merchant Admin must distinguish:
   - installed version
   - latest published version
   - live rollout verification status
7. Rollout runbooks must verify live branded HTML, not only Admin version cards.
8. Theme publication docs must distinguish artifact release from host rollout completion.

## Non-Goals

- Replacing the existing theme package format.
- Replacing the official artifact publication workflow.
- Redesigning all official themes in this change set.
- Solving every plugin rollout problem under the same task.

## Acceptance Signals

- Live branded auth routes no longer show `Jiffoo` host chrome when the active theme owns auth.
- A same-slug official theme update no longer depends on a manually synchronized in-repo builtin theme copy.
- Branded storefront verification becomes a required release step for official theme rollout work.
- The docs chain, ADR, changelog, and Linear issues all use the same "single source of truth" language.
