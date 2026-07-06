# ADR: Commercial Protection — Server-Side Entitlement over Code Obfuscation

**Date:** 2026-07-05
**Status:** Accepted
**Supersedes:** javascript-obfuscator-based artifact protection (historical)
**Related:** R1.6 (License & Ecosystem Compliance Boundary), `LICENSE-EXCEPTIONS.md`

---

## Context

Jiffoo's open-source core is licensed under GPL-2.0-or-later. Historically, the
`javascript-obfuscator` devDependency was used in the `build:official-artifacts`
pipeline to obfuscate official plugin/theme artifacts as a form of commercial
capability protection — making it harder for unauthorized parties to reverse-
engineer premium features.

With the Platform Evolution 2026 H2 initiative, the project is establishing a
clear three-layer license boundary:

1. **GPL Core** (`apps/api`, `apps/shop`, `apps/admin`, `packages/shared`) — GPL-2.0-or-later
2. **MIT SDK** (`@jiffoo/plugin-sdk`, `@jiffoo/theme-api-sdk`, `@jiffoo/core-api-sdk`, `@jiffoo/ui`) — MIT
3. **External HTTP plugins** — independent works, any license

In this model, code obfuscation is an inadequate and misaligned protection mechanism:

- **Obfuscation is not a legal boundary.** It provides no contractual or
  cryptographic enforcement — a determined actor can deobfuscate.
- **It conflicts with the open-source ethos.** Shipping obfuscated code from an
  open-source repo undermines community trust.
- **It doesn't protect the right thing.** The real commercial value is not in
  source code readability but in **entitlements** — which features a given store
  instance is licensed to use (e.g., B2B quotes, advanced recommendations,
  multi-warehouse).

## Decision

**Deprecate `javascript-obfuscator`-based artifact protection. Migrate
commercial capability protection to server-side Entitlement Service validation.**

### What changes

| Aspect | Before (deprecated) | After (target) |
|--------|---------------------|----------------|
| Protection mechanism | Client-side code obfuscation | Server-side entitlement checks |
| Enforcement point | Build pipeline (`build:official-artifacts`) | Runtime API middleware (closed-source Platform API) |
| Failure mode | Code is harder to read but still runs | Unauthorized features return 403 at API layer |
| Open-source alignment | Obfuscated artifacts shipped from OSS repo | OSS repo ships clean artifacts; entitlements are a platform concern |

### Migration path

1. **Immediate (this PR):** `build:official-artifacts` prints a deprecation
   warning. The `javascript-obfuscator` devDependency remains in
   `package.json` but is flagged for removal.
2. **Short-term (M1 milestone):** No new obfuscation steps are added to the
   build pipeline. Existing signed artifact distribution (`checksums.json` +
   Ed25519 detached signatures) remains the integrity mechanism.
3. **Medium-term (closed-source side):** The Entitlement Service (part of the
   closed-source Platform API) will provide:
   - Feature-gate middleware that checks entitlements on API routes
   - Admin UI for managing store-level entitlements
   - Graceful degradation when Platform API is unreachable (feature defaults
     to "enabled" for self-hosted open-source instances)
4. **Removal:** Once the Entitlement Service is operational, the
   `javascript-obfuscator` devDependency will be removed from the open-source
   repo entirely.

### What stays the same

- **Signed artifact distribution** (Ed25519 detached signatures via
  `OFFICIAL_EXTENSION_SIGNING_KEY`) is **not** deprecated — this is an
  integrity mechanism, not a code-protection mechanism.
- **Two-tier plugin trust model** (R2) uses signature verification to
  distinguish `builtin`/`official` from `third-party` plugins — this is
  orthogonal to commercial protection and remains in the open-source core.

## Consequences

- **Positive:** Clean separation between open-source integrity (signatures) and
  commercial protection (entitlements). No obfuscated code in OSS artifacts.
  Community trust maintained.
- **Positive:** Entitlement checks are enforceable at runtime (403 responses),
  unlike obfuscation which is advisory at best.
- **Negative:** Entitlement Service is in closed-source scope — open-source
  instances that want commercial features need a Platform API connection.
  This is by design (see R9: hosting funnel mounting points).
- **Neutral:** `javascript-obfuscator` devDependency stays as a no-op until
  removal to avoid breaking existing CI pipelines that may reference it.

## References

- [LICENSE-EXCEPTIONS.md](../../../LICENSE-EXCEPTIONS.md) — three-layer license boundary
- [PRD_EXECUTABLE_2026H2.md](../PRD_EXECUTABLE_2026H2.md) — R1.6 deprecation requirement
- [requirements.md](../platform-evolution-2026h2/requirements.md) — Requirement 1, AC 6
- [design.md](../platform-evolution-2026h2/design.md) — R1 design decisions
