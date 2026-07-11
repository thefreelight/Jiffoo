# Theme Client Compatibility Matrix

Status: Draft  
Last updated: 2026-04-12

This matrix is the human-readable companion to:

- `docs/theme-client-platform-contract.md`
- `docs/theme-client-api-catalog.json`
- `docs/theme-client-adapter-registry.json`

The goal is to answer one practical question for official and downstream teams:

What happens on web, mobile, and desktop when the active theme changes?

## Reading Rules

- `Implemented` means the support path exists in the current official client.
- `Planned` means the contract and target profile are defined, but the official client adapter is not finished.
- `Experimental` means the mode exists, but downstream teams should expect integration work and explicit validation.
- `Limited` means partial support only and the gaps must be documented before shipping.

## Initial Official Matrix

| Theme Or Mode | Web | Mobile | Desktop | Notes |
| --- | --- | --- | --- | --- |
| `builtin-default` | Implemented | Planned | Planned | Baseline OSS-safe theme. This should become the first official cross-client adapter target. |
| `quiet-curator` | Implemented | Planned | Planned | Official downloadable theme-pack with a clean presentation-first story and lower coupling risk. |
| `stellar-midnight` | Implemented | Planned | Planned | Official downloadable theme-pack and a strong early SaaS-style adapter target. |
| Downloaded theme pack | Implemented | Planned | Planned | Mobile and desktop should not claim support until an adapter or fallback policy is declared. |
| Embedded renderer hint in `theme.json` | Implemented | Planned | Planned | Useful when clients can map a known renderer slug to a local adapter. |
| Executable `theme-app` via gateway | Experimental | Experimental | Experimental | Non-web clients need explicit shell or webview strategy and capability checks. |
| Plugin-backed `app_block` / `app_embed` storefront extensions | Implemented | Experimental | Experimental | Reuse the same extension contract; do not invent client-private plugin APIs. |

## Contract Rules Behind The Matrix

### What may change with a theme

- tokens
- templates
- layout
- embedded renderer selection
- active extension set
- client adapter selection

### What must not change with a theme

- catalog semantics
- cart semantics
- order semantics
- payment semantics
- auth semantics

If a theme appears to need a new business endpoint, that contract must be reviewed in core first.

## Rollout Order

1. Ship the baseline `builtin-default` adapter path across official web, mobile, and desktop.
2. Publish a theme-to-client adapter entry before claiming support for any additional official theme.
3. Mark plugin-heavy themes as `Limited` or `Experimental` until their capability gaps are documented.
4. Require compatibility-lab verification before moving a mode from `Experimental` or `Planned` to `Implemented`.

## Guidance For Downstream Teams

- If your custom app consumes only the stable commerce contract, you can stay largely theme-agnostic.
- If your custom app wants to expose theme-specific UX, create a client adapter layer instead of forking core endpoints.
- If your custom app wraps a `theme-app`, declare the shell strategy explicitly and test auth, navigation, and extension rendering paths separately.
