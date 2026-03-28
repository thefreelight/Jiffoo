# Requirements Document

## Introduction

Jiffoo now spans a private-development + OSS-sync repository topology:

- `jiffoo`
- `jiffoo-mall-core`
- `jiffoo-extensions-official`
- `jiffoo-mall-desktop-private`
- `jiffoo-mall-mobile-private`
- `jiffoo-mall-desktop`
- `jiffoo-mall-mobile`

The product goal is not “run the same web page code everywhere.” The goal is to make themes, plugins, and solution bundles reusable across Web, Desktop, and Mobile while preserving each surface's native experience and keeping AI-assisted app creation fast and safe.

This spec defines the contract-first multi-surface architecture that all future desktop/mobile work must follow.

## Requirements

### Requirement 1: Shared Contract Layer

**User Story:** As a platform team, we want all surfaces to share the same business contracts, so that themes, plugins, and solution bundles can be reused without duplicating core domain logic.

#### Acceptance Criteria

1. The platform SHALL define a shared contract layer for:
   - API DTOs and SDKs
   - theme metadata and design tokens
   - plugin capability contracts
   - content/block schemas
   - navigation/deep-link intents
   - solution package manifests
2. Web, Desktop, and Mobile SHALL consume the same contract layer for domain behavior, versioning, and compatibility checks.
3. Shared contracts SHALL be versioned independently from any single renderer implementation.
4. Shared contracts SHALL be reusable across `jiffoo`, `jiffoo-mall-core`, `jiffoo-extensions-official`, `jiffoo-mall-desktop-private`, and `jiffoo-mall-mobile-private`.

### Requirement 1.1: Runtime Snapshot Contract

**User Story:** As a runtime team, we want every surface to read the same product-shape snapshot, so that Web, Desktop, and Mobile render the same business state even when their renderers differ.

#### Acceptance Criteria

1. The platform SHALL define a `RuntimeSnapshot` contract that includes at least:
   - `store`
   - `solution`
   - `theme`
   - `plugins`
   - `branding`
   - `platformBranding`
   - `surfaces`
2. All three surfaces SHALL treat `RuntimeSnapshot` as the primary read model for:
   - current branding
   - active theme
   - enabled capabilities
   - surface-specific availability
3. Clients SHALL NOT invent independent theme/plugin state that bypasses the snapshot.
4. `Admin` SHALL remain the primary write/control surface that changes the underlying snapshot inputs.

### Requirement 2: Surface Adapters Instead of Shared Page Trees

**User Story:** As a product and engineering team, we want each surface to render through an adapter suited to that surface, so that reuse does not degrade user experience.

#### Acceptance Criteria

1. Jiffoo SHALL NOT assume that one DOM/page implementation can run unchanged on Web, Desktop, and Mobile.
2. The supported surface adapter families SHALL be:
   - `shop-web`
   - `admin-web`
   - `desktop-web`
   - `shop-native`
   - `mobile-native`
3. Desktop SHALL prefer a web-heavy renderer inside an Electron shell.
4. Mobile SHALL prefer React Native / Expo native renderers instead of trying to execute Web DOM theme pages directly.
5. Surface adapters SHALL be allowed to differ in layout, navigation, and interaction patterns while still honoring the same underlying contracts.
6. Desktop SHALL be allowed to support executable theme/plugin surfaces when shell-level capabilities justify it.
7. Mobile SHALL treat declarative themes/plugins as the default extension path and SHALL NOT assume arbitrary downloaded runtime code is executable by default.

### Requirement 3: Theme Reuse Model

**User Story:** As a theme author, I want a theme to be reusable across multiple surfaces without forcing every surface to share one page implementation.

#### Acceptance Criteria

1. A theme SHALL be modeled as:
   - theme manifest
   - brand/design tokens
   - assets
   - content/block schema
   - optional surface adapters
2. Theme reuse SHALL prioritize shared tokens, assets, schema, and intent models over shared page source.
3. A theme MAY provide:
   - `theme-pack`
   - `shop-web`
   - `desktop-web`
   - `shop-native`
   adapters independently.
4. Desktop MAY consume a theme's web-oriented adapter when that is the best fit for the Electron shell.
5. Mobile SHALL be allowed to consume the same theme manifest/tokens while rendering through a dedicated native adapter.
6. `Theme Pack` SHALL be the preferred cross-surface path for Web, Desktop, and Mobile.

### Requirement 3.1: Theme Pack Minimum Contract

**User Story:** As a platform and theme-authoring team, we want a strict minimum `Theme Pack` contract, so that themes can move across Web, Desktop, and Mobile without requiring executable code by default.

#### Acceptance Criteria

1. A valid `Theme Pack` SHALL include at minimum:
   - `theme.json`
   - `tokens.css` or equivalent token payload
   - declared template/block resources
   - declared asset directory or asset references
2. `theme.json` SHALL include at minimum:
   - `slug`
   - `name`
   - `version`
   - `target`
   - `entry`
   - compatibility metadata
3. A `Theme Pack` MAY declare optional surface adapters, but SHALL remain valid without executable surface code.
4. The same `Theme Pack` SHALL be allowed to drive:
   - Web storefront presentation
   - Desktop storefront presentation
   - Mobile presentation through native adapters
5. `Theme Pack` SHALL be the default fast-update vehicle for client-side product-shape changes.

### Requirement 4: Plugin Reuse Model

**User Story:** As a plugin author, I want plugin capabilities to remain reusable across surfaces without assuming every surface exposes the same admin page shell.

#### Acceptance Criteria

1. A plugin SHALL be modeled as:
   - plugin manifest
   - capability contract
   - config schema
   - actions/events/hooks
   - optional surface adapters
2. Plugin capability registration SHALL remain surface-agnostic where possible.
3. Admin UI for a plugin SHALL be allowed to differ by surface.
4. Mobile SHALL be allowed to expose companion or lite plugin surfaces instead of full merchant-admin pages.
5. The absence of a mobile adapter SHALL NOT invalidate a plugin's web or desktop capability contract.
6. Desktop MAY support richer executable plugin surfaces than Mobile.
7. Mobile SHALL default to declarative plugin surfaces and remotely-driven capability/config flows.

### Requirement 4.1: Plugin Capability Minimum Contract

**User Story:** As a plugin platform team, we want a strict minimum capability contract, so that plugins can influence all surfaces through one semantic model even when their UIs differ.

#### Acceptance Criteria

1. A plugin capability contract SHALL define at minimum:
   - `slug`
   - `name`
   - `version`
   - `capabilities`
   - `configSchema`
   - supported surface declarations
2. A plugin SHALL be able to expose:
   - business/event capabilities without any UI
   - Web/Desktop admin workspace surfaces
   - Mobile companion/lite surfaces
3. Surface declarations SHALL explicitly mark a surface as:
   - required
   - optional
   - unsupported
4. Mobile plugin behavior SHALL default to capability metadata + config + remote/server orchestration rather than arbitrary runtime code loading.

### Requirement 5: Repository Ownership and Single-Write Sources

**User Story:** As a team using multiple repositories, we want repository ownership to stay explicit, so that AI and human contributors do not accidentally dual-write the same feature in conflicting places.

#### Acceptance Criteria

1. `jiffoo-mall-core` SHALL remain the runtime host and platform integration repository.
2. `jiffoo-extensions-official` SHALL remain the single write source for official themes/plugins.
3. `jiffoo-mall-desktop-private` SHALL own the Electron shell, desktop integrations, and desktop-only adapters.
4. `jiffoo-mall-mobile-private` SHALL own the Expo/React Native shell and mobile-only adapters.
5. The team SHALL be allowed to keep the primary development conversation in `jiffoo-mall-core` while routing implementation to the canonical target repository.
6. Rules and documentation SHALL make “main repo orchestration, target repo implementation” explicit.
7. The default composite workspace layout SHOULD keep these repositories as sibling directories under the same parent path (for example `/Users/jordan/Projects/*`) so cross-repo development remains predictable.

### Requirement 6: Solution Package Model

**User Story:** As a platform team preparing for AI-assisted app generation, we want a higher-level solution package primitive, so that new applications can be composed and launched quickly.

#### Acceptance Criteria

1. The system SHALL define a `solution package` as a composition unit that can include:
   - brand profile
   - theme selection
   - plugin bundle
   - surface profile overrides
   - environment preset
   - operational metadata
2. A solution package SHALL be able to target Web-only, Web + Desktop, Web + Mobile, or all supported surfaces.
3. A solution package SHALL declare which surface adapters are required, optional, or unsupported.
4. The solution package model SHALL be compatible with official managed/commercial packages.
5. The solution package model SHALL be documented as the preferred AI-era “rapid application launch” abstraction instead of treating every launch as a hand-assembled set of repos and pages.

### Requirement 6.1: Desktop and Mobile Phase-1 Capability Matrix

**User Story:** As a product and delivery team, we want an explicit first-phase capability matrix for Desktop and Mobile, so that implementation does not drift into undefined parity expectations.

#### Acceptance Criteria

1. The documentation SHALL explicitly define which of the following are phase-1 supported on Desktop:
   - runtime snapshot consumption
   - theme-pack switching
   - plugin capability reads
   - plugin workspace surfaces
   - optional executable extension surfaces
2. The documentation SHALL explicitly define which of the following are phase-1 supported on Mobile:
   - runtime snapshot consumption
   - theme-pack switching
   - branding/config refresh
   - capability-driven companion surfaces
   - remote/declarative plugin behavior
3. The documentation SHALL explicitly state that Mobile phase-1 does not require full merchant-admin parity.

### Requirement 7: Open-Source Public Topology

**User Story:** As an open-source maintainer, we want the public repo topology to remain clear, so that desktop/mobile repos are not confused with the self-hosted core mirror.

#### Acceptance Criteria

1. The public `jiffoo` repo SHALL remain the self-hosted core mirror.
2. `jiffoo-mall-desktop` and `jiffoo-mall-mobile` SHALL remain separate public client repositories.
3. The open-source sync process for `jiffoo` SHALL NOT attempt to absorb desktop/mobile source trees.
4. Public documentation SHALL describe the multi-repo OSS topology explicitly.
5. Public desktop/mobile repositories SHALL be treated as OSS sync targets, not the default private-development authoring location.
6. Public desktop/mobile repositories SHALL be synced from `jiffoo-mall-desktop-private` and `jiffoo-mall-mobile-private` respectively, not from the `jiffoo-mall-core` sync path.
7. The public desktop/mobile sync outputs SHALL remain limited to client/frontend host code and SHALL NOT be documented as the source of truth for runtime/platform services.
