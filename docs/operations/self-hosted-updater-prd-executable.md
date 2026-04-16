# Self-Hosted Updater PRD Executable

Status: implemented
Date: 2026-04-17
Owner: OSS core runtime
Linear issue: JIF-112

## Scope

- Harden the Docker Compose updater path.
- Keep the public release model aligned with `image-first`.
- Make the documentation chain explicit for future release work.

## Execution Log

- Implemented upgrade lock acquisition in `scripts/jiffoo-updater.mjs`.
- Converted `image-first` cutover to a staged runtime env plus final compose-state commit.
- Added live runtime verification so package version and `APP_VERSION` must both match the target before commit.
- Disabled implicit `source-archive` fallback unless `--force-source-archive` is set.
- Updated rehearsal coverage to assert that `APP_VERSION` remains old until completion.
- Updated Admin/API guidance so operator messaging matches the runtime model.

## Verification

- Command: `pnpm test:updater:docker-compose`
- Expected evidence:
- the rehearsal sees an in-flight state before completion
- the env file still contains the previous `APP_VERSION` while the upgrade is running
- the final env file contains the target version and image refs

## Follow-Up Work

- Add a Kubernetes-side equivalent of live runtime version verification.
- Consider a Docker Compose maintenance switch if storefront traffic needs a stronger cutover guarantee.
- Consider publishing a dedicated operator runbook for rescue-mode `source-archive` usage.
