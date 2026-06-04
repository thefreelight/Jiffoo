# Specs Changelog

This changelog records high-signal product, architecture, and delivery changes that affect the specifications under `.kiro/specs/`.

## Unreleased

### Added
- Added marketplace domain modeling for `app_marketplace`, `goods_marketplace`, and `merchant_store`.
- Added formal binding concepts for self-hosted deployments:
  - `instance binding`
  - `tenant binding`
- Added a documented platform-auth UX target:
  - default `Hosted Auth Popup + PKCE`
  - fallback `Device Flow / User Code Flow`
- Added architecture decision records under `.kiro/specs/architecture-decisions/`.
- Added a dedicated ADR for the open-source core self-update model:
  - unified Admin upgrade UX
  - local `Jiffoo Updater`
  - deployment-mode executors for single-host, Docker Compose, and Kubernetes
- Added a documented OSS core release-version policy:
  - strict semver for stable releases
  - explicit prerelease suffixes (`alpha`, `beta`, `rc`)
  - `stable` / `prerelease` update channels
  - manifest fields for `upgradeType`, `minimumAutoUpgradableVersion`, and `requiresManualIntervention`
- Added official extension launch specification coverage for:
  - marketplace control-plane catalog
  - package-managed theme/plugin delivery
  - resumable artifact download
  - official Stripe, i18n, and Odoo plugin wrappers
  - repository-native official Theme Pack source trees
- Added a dedicated ADR for the official-extensions development workflow covering `jiffoo`, `jiffoo-mall-core`, and `jiffoo-extensions-official`.
- Added a dedicated ADR for built-in storefront theme archetypes so the default theme can serve `storefront`, `landing-commerce`, and `product-site` roles.
- Added a dedicated multi-surface architecture spec covering:
  - shared contracts
  - surface adapters
  - repo ownership across `core`, `official`, `desktop`, and `mobile`
  - solution package composition
- Added a dedicated ADR for the cross-platform surface-adapter model.
- Added a dedicated ADR for the solution-package model used for rapid AI-era app launch.
- Added explicit documentation that `Theme Pack` is the preferred cross-surface extension path for Web, Desktop, and Mobile, while Desktop and Mobile diverge on executable extension support.
- Added a formal `RuntimeSnapshot` read-model definition so Web, Desktop, and Mobile share one product-shape contract.
- Added minimum-contract definitions for:
  - `Theme Pack`
  - `Plugin Capability`
- Added a documented Desktop/Mobile phase-1 capability matrix for extension-parity planning.
- Added a dedicated ADR for Admin bootstrap/demo credential display state.

### Changed
- Changed the marketplace taxonomy so `Extensions` now means only installable app capabilities:
  - `Themes`
  - `Plugins`
- Changed Merchant Admin marketplace IA so merchants now navigate `Themes` and `Plugins` directly, see a compact platform-connection strip, and manage installed plugins from a dedicated plugin center instead of a generic `Extensions` tab.
- Changed the `super-admin` shell and login experience to use a tighter control-console layout with a right-aligned workspace switcher and a redesigned operator sign-in screen.
- Changed the self-hosted core update model from an implicit in-process hot-swap assumption to a unified Admin UX with environment-aware execution adapters.
- Changed the self-hosted core update UX to emphasize automatic recovery on failure instead of exposing a user-triggered version rollback button.
- Changed the documented OSS release flow so private snapshot publishing, public `Jiffoo` tags, Admin update metadata, and update manifests all align on the same semver/version-channel policy.
- Changed the developer-experience upgrade plan so placeholder `/api/upgrade/*` routes and version cards are no longer treated as “completed one-click upgrade support”.
- Changed official launch positioning so v1 ships only under `listing_domain=app_marketplace`.
- Changed settlement language to distinguish:
  - `developer` for apps
  - `vendor` for goods
  - `merchant` for merchant-store transactions
- Changed official themes from builtin-only descriptors to downloadable Theme Pack artifacts with embedded renderer contracts.
- Changed official plugins from builtin launch assumptions to package-managed marketplace delivery.
- Changed the default storefront-theme direction so the built-in theme is now specified as a reusable SaaS/product-site base template with explicit `storefront / landing-commerce / product-site` archetypes instead of a fixed catalog-first homepage.
- Changed the repo-boundary docs so they now explicitly name `jiffoo-extensions-official` as the authoritative private source repo for official themes/plugins, recommend a composite local workspace for development, and reject manual dual-write sync from `jiffoo-mall-core` as the default workflow.
- Changed the cross-surface guidance so Web, Desktop, and Mobile now explicitly share contracts instead of pretending to share one page tree.
- Changed the public/open-source repo topology docs so `jiffoo`, `jiffoo-mall-desktop`, and `jiffoo-mall-mobile` are documented as separate OSS repos with distinct host responsibilities.
- Changed the main-repo rules so cross-repo work may still be orchestrated from `jiffoo-mall-core` while implementation routes to `official`, `desktop`, or `mobile` as needed.
- Changed the official-extension workflow rule from a soft recommendation into an explicit migration-first boundary: if official theme/plugin source appears in `jiffoo-mall-core`, the canonical change must be moved back to `jiffoo-extensions-official` before more feature authoring continues.
- Changed the official-extension ownership rule so themes/plugins created through the main core-repo conversation flow now default to official-extension classification unless they are explicitly declared core-owned fallback/runtime work.
- Changed the multi-surface architecture docs so Desktop is treated as Web-like with optional richer executable theme/plugin support, while Mobile defaults to declarative theme/plugin delivery.
- Changed the repository topology docs so `jiffoo-mall-desktop-private` / `jiffoo-mall-mobile-private` are the private development repos and the public desktop/mobile repos are described as OSS sync targets.
- Changed the client-repo topology docs so the public desktop/mobile repos are now explicitly described as frontend-only OSS sync outputs from `jiffoo-mall-desktop-private` / `jiffoo-mall-mobile-private`, while `jiffoo-mall-core` remains the sync source only for public `jiffoo`.
- Changed the storefront attribution rule so the open-source default experience now keeps a visible `Powered by Jiffoo` footer by default, while managed/customized commercial-package mode can hide it through runtime state.
- Changed the official catalog/theme set to include `digital-vault` as an official downloadable storefront theme.
- Changed the multi-surface execution guidance so `Admin` is explicitly the unified extension control plane and clients are runtime consumers of the same snapshot-driven product shape.
- Changed the Admin credential-display guidance so demo/bootstrap credentials are state-driven and automatically hidden after the seeded admin rotates the initial password.

### Fixed
- Fixed the open-source sync boundary so the public mirror now prunes closed-source apps, retains the built-in `packages/shop-themes/default` package, excludes official marketplace theme source trees, and keeps runtime extension directories empty except for `.gitkeep`.
- Fixed the open-source preparation docs by restoring the missing `open-source-preparation` spec set and aligning PRD/Execution PRD with the rule that official themes and plugins are downloaded from the official marketplace after deployment rather than synced into the public repository.
- Fixed the open-source mirror definition so public SDK/tooling packages such as `core-api-sdk`, `theme-api-sdk`, and `create-jiffoo-app` are synced into the public repo while the isolation check only scans the actual open-source deliverable scope.
- Fixed the open-source delivery path so the public `Jiffoo` repository now has a dedicated OSS-only `dev` pipeline and `jiffoo-oss/*` GitOps values instead of reusing private-image deployment values under a misleading `oss-dev` label.
- Fixed the OSS delivery path so the public `Jiffoo` GitLab root pipeline now sends dedicated Feishu deploy-success and deploy-failure notifications after evaluating the overall OSS environment outcome instead of leaving OSS deployments silent.
- Fixed the standalone seed inventory model to default to a deterministic mixed-stock profile so storefront and inventory testing always include healthy, low-stock, and out-of-stock products.
- Fixed root child-pipeline trigger rules so unchanged services can keep their existing images more often instead of rebuilding every frontend/backend service whenever any workspace package changes.
- Fixed the official-extension docs so PRD, executable PRD, launch spec, and ADR all describe the same marketplace model.
- Fixed the core update center so it no longer pretends placeholder `/api/upgrade/*` behavior is a completed one-click upgrader; it now reports deployment mode, update source, and operator guidance explicitly.
- Fixed the official theme source-of-truth model so `esim-mall` and `yevbi` are represented as repository-native Theme Pack source trees.
- Fixed the official package artifact pipeline to support integrity validation and resumable installation flows.
- Fixed CI post-deploy E2E jobs to use a current Playwright container tag after the old `v1.57.0-focal` image disappeared from MCR.
- Fixed the production `api` child pipeline to use a `2h` build timeout so large Kaniko image builds do not fail at the project default `1h`.
- Fixed the `docs` Docker build to run `next build` through `pnpm exec`, avoiding pnpm/npm resolution mismatches inside the Linux CI image.
- Fixed the `docs` build path to force `webpack` in both local scripts and Docker so CI no longer depends on the unstable Next.js 16 Turbopack/React resolution path on Alpine.
- Fixed the `docs` workspace to install `react` and `react-dom` from standard semver packages instead of vendored tarballs so Linux/Alpine CI builds no longer fail on `Named export 'Fragment' not found`.
- Fixed the post-split `shop` build path so Next.js 16 no longer fails immediately on the implicit Turbopack/webpack mismatch after the official-extensions repo was moved behind a vendor submodule.
- Fixed the `platform-api` `db-ops` pipeline step so Prisma CLI is available during migration execution instead of failing with `sh: prisma: not found`.
- Fixed Merchant Admin avatar rendering so external profile images no longer depend on Next image proxy behavior for `pravatar`-style URLs.
- Fixed Merchant Admin official marketplace presentation to remove `Open Admin UI` wording, add official verification treatment, and improve theme/plugin card identity with icons.
- Fixed Merchant Admin platform-connection presentation so connected stores render as a compact status strip with inline account/store pills instead of a large summary card.
- Fixed official package recovery so installed package metadata can be rebuilt when `.installed.json` is missing from a recovered plugin/theme directory.
- Fixed default-theme storefront placeholders to use the shipped SVG asset instead of the removed `placeholder-product.jpg` path.
- Fixed Yevbi storefront assets so the package-managed theme renders its original hero/testimonial imagery without relying on external image hosts.
- Fixed fresh `platform-api` Docker builds on arm64 by provisioning Python and native build tools in build-only stages for optional native dependencies such as `msgpackr-extract`.
- Fixed frontend child-pipeline builds to use `2h` timeouts, app-scoped workspace installs, and sane pnpm concurrency so Admin, Super Admin, Docs, and Developer Portal image builds do not spend the full project timeout reinstalling unrelated monorepo dependencies one package at a time.
- Fixed the test-environment rollout path after the `digital-vault` migration by:
  - restoring `scripts/prisma-safe-migrate-deploy.mjs` into the repo for `platform-api` db-ops
  - extending Admin plugin state typing so plugin workspaces with `adminUi` metadata compile again
  - copying vendored official-theme npm tarballs into the Shop Docker build context so workspace installs can resolve official theme package dependencies
- Fixed the `digital-vault` official-theme rollout path so:
  - the official catalog seed includes the theme explicitly
  - self-hosted Admin can activate the embedded `digital-vault` storefront theme from installed themes without waiting on platform binding
  - official artifact packaging resolves canonical theme/plugin sources from the sibling `jiffoo-extensions-official` repo when the vendor directory is not initialized
  - Shop/Admin/Super Admin builds no longer register `digital-vault` twice through both the local core path and the official vendor path
- Fixed the `platform-api` `db-ops` CI bootstrap path to force the npm mirror and retry settings before `pnpm install`, reducing `ECONNRESET` failures during migration jobs.

### Operational
- Added `OFFICIAL_EXTENSIONS_BOOTSTRAP_MODE=launch-ready` as the recommended local/test bootstrap mode so self-hosted instances can auto-establish a default platform connection and tenant binding during launch validation.
- Added local-browser validated acceptance coverage for:
  - `Yevbi` activation from Merchant Admin
  - default-theme fallback activation
  - official `i18n` instance recovery
  - storefront placeholder and service-worker regressions

### Reserved
- Reserved `goods_marketplace` for future physical goods, digital goods, and bundles.
- Reserved `merchant_store` for merchant-owned goods sold through merchant-collected payment flows.
- Reserved `Services`, `Bundles`, and `Credits` as future marketplace categories outside `Extensions`.
