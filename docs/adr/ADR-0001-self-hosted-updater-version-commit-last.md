# ADR-0001: Self-Hosted Updater Commits Version Last

Status: accepted
Date: 2026-04-17

## Context

Jiffoo self-hosted upgrades span multiple runtime services: `api`, `shop`, `admin`, and `updater`. Earlier flows could publish the target version too early or silently fall back into a heavier `source-archive` path. That increased the chance of reporting a successful upgrade before the real runtime was healthy.

## Decision

We will treat the updater as a bootstrap layer and adopt a two-phase runtime commit model for Docker Compose:

- `image-first` is the default upgrade path.
- `source-archive` is recovery-only and requires explicit force.
- the updater acquires a durable filesystem lock before starting.
- target images and target `APP_VERSION` are staged in command env only during cutover.
- the live API runtime must report both package version and `APP_VERSION` equal to the target release before the compose state is committed.
- the compose env file is written last.

## Consequences

- UI version reporting and runtime truth stay aligned more often.
- operators get clearer terminal states and fewer ambiguous retries.
- unexpected manifest regressions fail fast instead of silently changing upgrade strategy.
- a crash between cutover and final commit becomes smaller and easier to reason about, because version persistence is isolated as a final step.
