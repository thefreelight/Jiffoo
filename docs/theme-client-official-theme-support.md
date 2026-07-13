# Official Theme Support Inventory

Status: Draft  
Last updated: 2026-04-12

This inventory is the theme-level companion to:

- `docs/theme-client-platform-contract.md`
- `docs/theme-client-api-catalog.json`
- `docs/theme-client-adapter-registry.json`
- `docs/theme-client-compatibility-matrix.md`

## Why The Labels Matter

The support labels are not cosmetic. They answer four operational questions:

### 1. What are we promising today

If a theme is marked `implemented` for a client, downstream teams can treat that as a real support promise.

If it is marked `planned`, `limited`, `experimental`, or `unsupported`, they know more work or more risk still exists.

### 2. Where should custom app teams spend effort

When a custom mobile or desktop team picks a theme, the label tells them whether they should:

- reuse an official adapter
- build only presentation work
- expect plugin or shell integration work
- avoid the theme for now

### 3. How do we avoid fake alignment

Without labels, every team will say "this theme should probably work" and quietly build a different interpretation.

With labels, the team has one canonical answer for:

- current support state
- known blockers
- rollout priority

### 4. What should CI and release notes enforce

Once a label becomes `implemented`, that theme should enter compatibility-lab coverage for the matching client.

That turns the label into a release-quality rule, not just a planning note.

## Label Semantics

- `implemented`
  - official client path exists and is expected to work without theme-specific contract work
- `planned`
  - we intend to support it officially, but the client adapter is not finished
- `limited`
  - partial support exists or the theme has known coupling that prevents a clean official promise
- `experimental`
  - technically possible, but contract, shell, or extension behavior is still unstable
- `unsupported`
  - no official client path should be assumed

## Current Inventory

| Theme | Web | Mobile | Desktop | Why |
| --- | --- | --- | --- | --- |
| `builtin-default` | Implemented | Planned | Planned | Baseline OSS-safe storefront theme and the best first adapter target across clients. |
| `serene` | Implemented | Planned | Planned | Second built-in base theme (calm indigo design), embedded in the shop registry. |
| `quiet-curator` | Implemented | Planned | Planned | Official downloadable theme-pack with a clear presentation contract and lower coupling risk. |
| `stellar-midnight` | Implemented | Planned | Planned | Official downloadable theme-pack with a clean pack-first story. |
| `bokmoo` | Implemented | Planned | Planned | Official embedded storefront theme with no obvious theme-private API fork. |
| `digital-vault` | Implemented | Planned | Planned | Embedded digital-goods storefront with business logic expected to move to plugins or backend modules. |
| `navtoai` | Implemented | Planned | Planned | Embedded directory storefront with lower current API coupling. |
| `app-landingpage` | Implemented | Limited | Limited | App-download landing page with local auth/cart/API code and brand-specific download assets. |
| `esim-mall` | Implemented | Limited | Limited | Theme owns a local API client today, so non-web clients should not claim clean support yet. |
| `yevbi` | Implemented | Limited | Limited | Theme uses the theme SDK and plugin-backed storefront fetches, which raises adapter complexity. |
| `imagic-studio` | Implemented | Experimental | Experimental | Plugin-heavy creative workflow theme with direct plugin API calls and async generation flows. |
| `fire` | Experimental | Experimental | Experimental | Theme-pack-first finance surface with runtime host block dependencies still being hardened. |
| `ai-gateway` | Experimental | Experimental | Experimental | Solution-oriented theme with companion runtime plugin ownership rather than a simple storefront adapter path. |
| `modelsfind` | Limited | Unsupported | Unsupported | Embedded theme with direct custom booking endpoint coupling and no current official non-web adapter plan. |

## Rollout Guidance

### First wave

- `builtin-default`
- `quiet-curator`
- `stellar-midnight`

These are the best candidates for proving the cross-client adapter model.

### Second wave

- `bokmoo`
- `digital-vault`
- `navtoai`

These are strong candidates once the baseline adapter path is proven.

### Later or capability-heavy wave

- `esim-mall`
- `app-landingpage`
- `yevbi`
- `imagic-studio`
- `fire`
- `ai-gateway`
- `modelsfind`

These should not be treated as routine adapter work. They need explicit capability and extension review first.
