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

## Goals

- Keep `updater` as a bootstrap layer that can upgrade the business runtime instead of being trapped by it.
- Make `image-first` the normal Docker Compose path.
- Commit the version only after the live runtime has switched and passed verification.
- Treat `source-archive` as an explicit recovery tool instead of an invisible fallback.
- Record terminal states as `completed`, `failed`, or `recovered`.
- Prevent overlapping upgrades with a durable lock.
- Keep release publication truth anchored to the Singapore cluster publication path instead of assuming GitHub Release alone updates the public feed.

## Non-Goals

- Replacing the existing Kubernetes updater flow in this change set.
- Rebuilding the whole release publication pipeline.
- Introducing a maintenance-mode surface for Docker Compose storefront traffic.

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

## Success Criteria

- During an in-flight upgrade, `.env.production.local` still shows the previous `APP_VERSION`.
- After a successful upgrade, the live API container reports both package version and `APP_VERSION` equal to the target release.
- Failed image-first upgrades restore the previous runtime and land in `recovered`.
- Missing image metadata no longer triggers an automatic `source-archive` fallback.
- A newly created GitHub Release does not count as "published" for self-hosted detection until `get.jiffoo.com` serves the same version.
