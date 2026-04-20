# ADR-0001: Self-Hosted Updater Commits Version Last

Status: accepted
Date: 2026-04-17

## Context

Jiffoo self-hosted upgrades span multiple runtime services: `api`, `shop`, `admin`, and `updater`. Earlier flows could publish the target version too early or silently fall back into a heavier `source-archive` path. That increased the chance of reporting a successful upgrade before the real runtime was healthy.

## Decision

We will treat the updater as a bootstrap layer and adopt a two-phase runtime commit model for Docker Compose:

- `image-first` is the default upgrade path.
- runtime images should be built once, validated on a candidate lane, and promoted to stable without rebuild.
- `source-archive` is recovery-only and requires explicit force.
- the updater acquires a durable filesystem lock before starting.
- target images and target `APP_VERSION` are staged in command env only during cutover.
- the live API runtime must report both package version and `APP_VERSION` equal to the target release before the compose state is committed.
- the compose env file is written last.
- formal OSS release publication remains anchored to the Singapore cluster path that updates `get.jiffoo.com`.
- GitHub Release creation is not by itself the self-hosted detection source of truth.
- consumer hosts such as RackNerd-branded sites are rollout targets that may remain on older runtime/updater versions until they are explicitly updated.
- self-hosted Admin official catalog completeness is part of release readiness; stale embedded launch seeds are treated as release regressions.

## Consequences

- UI version reporting and runtime truth stay aligned more often.
- operators get clearer terminal states and fewer ambiguous retries.
- unexpected manifest regressions fail fast instead of silently changing upgrade strategy.
- a crash between cutover and final commit becomes smaller and easier to reason about, because version persistence is isolated as a final step.
- release debugging must distinguish publication state (`Singapore -> get.jiffoo.com`) from consumer rollout state (`RackNerd/brand host -> runtime update`).
- failed candidate validations should not force an immediate new stable release if the same built artifact can be promoted after verification fixes.
