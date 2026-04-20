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
- Investigated a real downstream failure on RackNerd and confirmed the consumer host was still on `1.0.11` with the older updater path while `get.jiffoo.com` still served `1.0.13` despite newer GitHub releases existing.
- Documented that formal release publication is anchored in the Singapore cluster path and only becomes visible to self-hosted consumers after the public manifest is synced.
- Confirmed a `1.0.29` release-line regression where GHCR images were tagged as `1.0.29` but still embedded `APP_VERSION=1.0.0` and `package.json=1.0.3-opensource`, causing updater convergence rollback.
- Confirmed a `1.0.30` release-line regression where the self-hosted API carried an outdated `OFFICIAL_LAUNCH_EXTENSIONS` seed and only exposed two official themes in Admin despite the live platform catalog containing the full set.
- Added runtime-version reconciliation so self-hosted Admin follows the live runtime version instead of stale persisted `system_settings.version`.
- Added release-line follow-up to restore the complete official catalog aggregation path (artifact index + platform catalog + installed state) on self-hosted Admin.
- Added a self-hosted release guardrail script and workflow gate that fails publication when root version metadata drifts, required runtime assets are missing, password-based deploy secrets are reintroduced, or the official theme seed regresses below the minimum supported catalog set.

## Verification

- Command: `pnpm test:updater:docker-compose`
- Expected evidence:
- the rehearsal sees an in-flight state before completion
- the env file still contains the previous `APP_VERSION` while the upgrade is running
- the final env file contains the target version and image refs
- Operational evidence from production debugging:
- GitHub Release can advance ahead of `get.jiffoo.com`
- downstream consumer instances can still run an older updater and older runtime until explicitly rolled forward
- release branches can regress self-hosted runtime metadata or catalog completeness if they are cut from stale bases without a candidate validation pass

## Follow-Up Work

- Add a Kubernetes-side equivalent of live runtime version verification.
- Consider a Docker Compose maintenance switch if storefront traffic needs a stronger cutover guarantee.
- Consider publishing a dedicated operator runbook for rescue-mode `source-archive` usage.
- Add an explicit release-publication checklist that ends with Singapore publication plus `get.jiffoo.com` verification.
- Add a downstream rollout checklist for consumer hosts such as RackNerd-branded deployments.
- Add a candidate-to-stable promotion flow so runtime/catalog fixes can be validated without creating a new stable release for every failed rehearsal.
