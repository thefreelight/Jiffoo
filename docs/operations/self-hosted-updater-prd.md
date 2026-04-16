# Self-Hosted Updater PRD

Status: implemented
Date: 2026-04-17
Owner: OSS core runtime
Linear issue: JIF-112

## Why This Matters

Merchants and operators need the upgrade screen, runtime health, and version metadata to describe the same reality. If the product claims a new version too early, support and recovery both get harder.

The desired model borrows from two proven patterns:

- WordPress: stage first, verify, then commit the version marker last.
- sub2api: keep the upgrade unit small and switch the runtime in clear steps.

## Product Outcomes

- Upgrades feel boring and predictable.
- A partial cutover is recoverable and visible.
- Version reporting follows the runtime, not marketing copy in an env file.
- Rescue tooling exists without polluting the default path.

## Functional Requirements

1. The Docker Compose updater must acquire a durable upgrade lock before changing runtime state.
2. The updater must prefer `image-first` when manifest image refs exist.
3. The updater must pull target images before recreating services.
4. The updater must recreate `api`, `shop`, and `admin` sequentially.
5. The updater must run migrations after the runtime cutover and before final version commit.
6. The updater must verify the live API runtime before persisting the new compose state.
7. The updater must persist `APP_VERSION` only after the live runtime verification succeeds.
8. The updater must mark `source-archive` as recovery-only unless explicitly forced.
9. Failed upgrades must resolve to `failed` or `recovered`, never remain indefinitely in a pseudo-active state.

## Operator Expectations

- If image metadata is missing, the operator gets an explicit recovery-path error.
- If an upgrade is already running, the operator gets a clear lock error.
- Manual guidance in the Admin/API layer matches the runtime behavior.

## Acceptance Signals

- The updater rehearsal proves that the env file keeps the old `APP_VERSION` until the upgrade completes.
- Manual guidance tells operators to verify live runtime before committing the version.
- Release notes and changelog clearly state the new cutover model.
