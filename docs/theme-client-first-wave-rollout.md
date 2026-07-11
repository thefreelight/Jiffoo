# Theme Client First-Wave Rollout

Status: Draft  
Last updated: 2026-04-20

This rollout plan defines the first official cross-client adapter wave for storefront themes.

Companion files:

- `docs/theme-client-platform-contract.md`
- `docs/theme-client-adapter-registry.json`
- `docs/theme-client-official-theme-support.json`
- `docs/theme-client-first-wave-backlog.json`
- `docs/operations/official-storefront-runtime-source-of-truth-spec.md`

## Scope

First-wave themes:

- `builtin-default`
- `quiet-curator`
- `stellar-midnight`

Target clients:

- web
- mobile
- desktop

## Why These Three

### `builtin-default`

- baseline OSS-safe storefront
- lowest current coupling risk
- best place to prove the adapter model end to end

### `quiet-curator`

- official theme-pack-first presentation contract
- lower API and plugin coupling than more feature-heavy themes
- good test case for editorial and membership-shaped storefront presentation

### `stellar-midnight`

- official theme-pack-first presentation contract
- strong SaaS/product-site storefront shape
- good test case for a non-generic catalog-first theme

## Shared Rule

First-wave support means:

- clients resolve store and active theme from core
- clients do not fork catalog/cart/order/payment/auth semantics
- clients may implement theme-specific native adapters
- unsupported extension behavior must be declared, not implied
- official theme upgrades must resolve storefront runtime from the active installed version instead of stale builtin host code
- host auth layout must not leak generic host chrome into theme-owned auth pages

## Adapter Strategy

### `builtin-default`

- web strategy: existing embedded renderer
- mobile strategy: first official native adapter
- desktop strategy: first official native adapter

Goals:

- prove the cross-client adapter boundary
- prove the fallback model for unsupported themes
- prove the compatibility-lab contract

### `quiet-curator`

- web strategy: theme-pack consumption
- mobile strategy: pack-derived native adapter
- desktop strategy: pack-derived native adapter

Goals:

- prove that a theme-pack-first official theme can drive native adapters without a contract fork
- prove token, template, and settings-schema consumption patterns

### `stellar-midnight`

- web strategy: theme-pack consumption
- mobile strategy: pack-derived native adapter
- desktop strategy: pack-derived native adapter

Goals:

- prove that a second official theme can reuse the same adapter pipeline
- prove that the first wave is a platform pattern, not a one-off exception

## Workstreams

### Core

- lock the first-wave adapter registry entries
- publish the first-wave support inventory and rollout backlog
- define fixture inputs for `builtin-default`, `quiet-curator`, and `stellar-midnight`
- add compatibility-lab checks for active theme resolution and theme-pack metadata
- document fallback behavior when a client does not implement a theme-specific adapter yet

### Mobile

- implement a baseline `builtin-default` native adapter
- add pack-resource resolution for first-wave themes
- implement `quiet-curator` native adapter
- implement `stellar-midnight` native adapter
- define fallback UX when a planned theme is selected but no adapter has shipped yet

### Desktop

- implement a baseline `builtin-default` desktop adapter
- add pack-resource resolution for first-wave themes
- implement `quiet-curator` desktop adapter
- implement `stellar-midnight` desktop adapter
- define fallback UX when a planned theme is selected but no adapter has shipped yet

## Milestones

### Milestone 1: Baseline Contract Lock

Exit criteria:

- adapter registry entries exist for all first-wave themes
- support inventory and rollout backlog are published
- compatibility matrix and support inventory agree

### Milestone 2: Baseline Native Adapter

Exit criteria:

- `builtin-default` works in mobile and desktop
- fallback behavior is defined and tested
- compatibility lab covers baseline theme selection

### Milestone 3: Theme-Pack Adapter Pipeline

Exit criteria:

- mobile and desktop can consume first-wave theme-pack metadata and resources
- `quiet-curator` and `stellar-midnight` adapters are wired to the same pipeline

### Milestone 4: Cross-Repo Verification

Exit criteria:

- compatibility smoke checks pass for `builtin-default`, `quiet-curator`, and `stellar-midnight`
- release notes and migration guidance exist for any stable-contract change discovered during rollout

## Definition Of Done

The first wave is complete only when all of the following are true:

- the adapter registry marks all three first-wave themes with real client status
- support labels are upgraded intentionally, not informally
- mobile and desktop adapters exist for all first-wave themes
- fallback behavior is documented and tested
- compatibility-lab coverage exists for the official first-wave themes

## Non-Goals

- shipping every official theme in the first wave
- promising plugin-heavy themes before their capability story is clear
- inventing client-private commerce endpoints
- treating `theme-app` support as a prerequisite for baseline cross-client rollout

## Recommended Sequence

1. Finish `builtin-default` adapters and fallback behavior.
2. Build a shared theme-pack adapter pipeline.
3. Ship `quiet-curator`.
4. Ship `stellar-midnight`.
5. Re-evaluate the second wave using the same compatibility criteria.
