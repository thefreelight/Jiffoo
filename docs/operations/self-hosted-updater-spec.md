# Self-Hosted Updater Spec

Status: accepted
Date: 2026-04-17
Owner: OSS core runtime
Linear issue: JIF-112

## Problem

Jiffoo self-hosted upgrades used to be vulnerable to split-brain outcomes:

- `APP_VERSION` could move before the live runtime had really switched
- the updater could silently fall back from `image-first` to `source-archive`
- operators could see "update in progress" even after the runtime was already unhealthy
- concurrent upgrade attempts were blocked only by soft status checks

That made it possible for the UI to announce a new version while the real containers, workspace, or health state had not fully converged.

Official theme and plugin delivery also remained coupled to `platform-api` in a way that turned routine package publication into a control-plane deployment dependency:

- official artifact publication could succeed while the production catalog still pointed at an older sellable version
- `platform-api` metadata sync failures could block downstream consumers from seeing a new official theme or plugin
- artifact URLs could drift toward non-canonical or unavailable domains such as `market.jiffoo.com`
- downstream recovery logic could fetch a catalog record for a new version but still fail to restore the packaged runtime because the published artifact itself was incomplete or unreachable

That coupling made official extension release publication heavier than the runtime it was trying to deliver.

## Goals

- Keep `updater` as a bootstrap layer that can upgrade the business runtime instead of being trapped by it.
- Make `image-first` the normal Docker Compose path.
- Commit the version only after the live runtime has switched and passed verification.
- Treat `source-archive` as an explicit recovery tool instead of an invisible fallback.
- Record terminal states as `completed`, `failed`, or `recovered`.
- Prevent overlapping upgrades with a durable lock.
- Keep release publication truth anchored to the Singapore cluster publication path instead of assuming GitHub Release alone updates the public feed.
- Decouple official theme/plugin artifact publication from `platform-api` so package builds can be published without requiring a platform deployment.
- Make official package download URLs stable, canonical, and directly downloadable even when `platform-api` metadata promotion lags behind.

## Non-Goals

- Replacing the existing Kubernetes updater flow in this change set.
- Rebuilding the whole release publication pipeline.
- Introducing a maintenance-mode surface for Docker Compose storefront traffic.
- Making `platform-api` the mandatory runtime artifact host for official theme/plugin binaries.

## Required Invariants

- `updater` stays logically above `api`, `shop`, and `admin`.
- `APP_VERSION` is not persisted before the runtime cutover is verified.
- Runtime containers switch sequentially, not via one-shot force recreation.
- Database migrations run after the new runtime is in place and before final commit.
- Final truth comes from the live runtime, not just the env file.
- `source-archive` requires explicit rescue intent.
- Only one upgrade may hold the lock at a time.
- Formal OSS release publication is complete only after the Singapore cluster path updates `get.jiffoo.com/releases/core/manifest.json`.
- Consumer installations such as RackNerd or branded domains are update consumers, not release authorities.
- Official theme/plugin package binaries are published to a standalone artifact origin before or alongside any metadata promotion.
- `platform-api` may promote `currentVersion`, `sellableVersion`, and installability metadata, but it must not be the only place from which the official package binary can be downloaded.
- Official package publication failure modes are split into `artifact publication` and `metadata promotion`, and one must not silently masquerade as the other.

## Success Criteria

- During an in-flight upgrade, `.env.production.local` still shows the previous `APP_VERSION`.
- After a successful upgrade, the live API container reports both package version and `APP_VERSION` equal to the target release.
- Failed image-first upgrades restore the previous runtime and land in `recovered`.
- Missing image metadata no longer triggers an automatic `source-archive` fallback.
- A newly created GitHub Release does not count as "published" for self-hosted detection until `get.jiffoo.com` serves the same version.
- Official theme/plugin releases can publish a valid package artifact without waiting for a `platform-api` deployment.
- Downstream theme/plugin installation or recovery can fetch the package binary from its canonical artifact URL even if metadata promotion is delayed.
