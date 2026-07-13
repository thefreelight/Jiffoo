# Official Storefront Runtime Source-of-Truth PRD Executable

Status: active
Date: 2026-04-20
Owner: OSS storefront runtime
Linear issues: JIF-143, JIF-144, JIF-145

## Current Findings

- `girlsfind.vip` can report the latest installed `modelsfind` version in Admin while still serving stale storefront/auth HTML.
- RackNerd production currently proves that container version alone is not sufficient evidence of live storefront convergence.
- Official theme source, official artifact, host image, and branded live HTML must be checked separately.

## Execution Log

- Confirmed official theme artifacts can publish independently from host rollout.
- Confirmed Admin install/version state can advance ahead of live storefront rendering.
- Confirmed host auth chrome can leak into theme-owned auth pages.
- Confirmed the active `shop` runtime path still allows stale builtin renderer behavior to survive after an official theme upgrade.
- Added release notes and architecture docs so this failure mode is now explicit instead of tribal knowledge.

## Implementation Tracks

### Track A: Runtime single source of truth

- resolve active official storefront renderer by installed package `slug + version`
- keep builtin copies as explicit compatibility fallbacks only
- require compatibility fallback slugs to live on an explicit allowlist instead of matching any same-slug host package
- make fallback observable in logs and operator state

### Track B: Auth shell ownership

- keep host auth layout neutral
- let theme-owned auth pages render their own branded shell
- suppress theme header/footer chrome on auth routes unless explicitly intended

### Track C: Version-scoped rollout verification

- verify published official artifact version
- verify installed/active version in Admin
- verify host image/runtime version
- verify branded live HTML output

## Verification Checklist

1. Merchant Admin shows the intended installed and latest official theme versions.
2. The active `shop` host resolves the expected runtime source for the active theme version.
3. `/<locale>/auth/login` on the branded domain contains no host `Jiffoo` chrome when the theme owns auth.
4. `/<locale>/products` on the branded domain renders the updated runtime path on a fresh request.
5. RackNerd or other downstream consumer verification is recorded as rollout evidence, not inferred from release metadata alone.

## Follow-Up Work

- implement version-scoped runtime loading in `apps/shop`
- remove silent builtin renderer dependence for official themes
- add branded-domain smoke checks to the official theme rollout path
- extend update state UX so merchants can distinguish install success from live rollout success
