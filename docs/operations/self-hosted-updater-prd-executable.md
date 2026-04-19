# Self-Hosted Updater PRD Executable

Status: implemented
Date: 2026-04-17
Owner: OSS core runtime
Linear issue: JIF-112

## Scope

- Harden the Docker Compose updater path.
- Keep the public release model aligned with `image-first`.
- Make the documentation chain explicit for future release work.
- Decouple official theme/plugin package publication from `platform-api` rollout dependencies.

## Execution Log

- Implemented upgrade lock acquisition in `scripts/jiffoo-updater.mjs`.
- Converted `image-first` cutover to a staged runtime env plus final compose-state commit.
- Added live runtime verification so package version and `APP_VERSION` must both match the target before commit.
- Disabled implicit `source-archive` fallback unless `--force-source-archive` is set.
- Updated rehearsal coverage to assert that `APP_VERSION` remains old until completion.
- Updated Admin/API guidance so operator messaging matches the runtime model.
- Investigated a real downstream failure on RackNerd and confirmed the consumer host was still on `1.0.11` with the older updater path while `get.jiffoo.com` still served `1.0.13` despite newer GitHub releases existing.
- Documented that formal release publication is anchored in the Singapore cluster path and only becomes visible to self-hosted consumers after the public manifest is synced.
- Investigated a real official theme regression where `modelsfind` catalog metadata advanced ahead of a usable packaged runtime bundle.
- Confirmed the previous official publication chain could fail in three independent places:
  - the theme source repo could contain the runtime bundle only as an untracked local artifact
  - the official artifact builder could omit `entry.runtimeJS` from the packaged `.jtheme`
  - metadata promotion into production `platform-api` could fail on an unrelated catalog row and block the whole batch
- Updated the core artifact builder so packaged official theme zips include the declared runtime bundle path.
- Updated official theme release automation so package-level `build:theme-pack` scripts run before official artifacts are assembled.
- Documented that future official package binaries must publish to a standalone artifact origin and that `platform-api` promotion is a follow-on metadata step.

## Verification

- Command: `pnpm test:updater:docker-compose`
- Expected evidence:
- the rehearsal sees an in-flight state before completion
- the env file still contains the previous `APP_VERSION` while the upgrade is running
- the final env file contains the target version and image refs
- Operational evidence from production debugging:
- GitHub Release can advance ahead of `get.jiffoo.com`
- downstream consumer instances can still run an older updater and older runtime until explicitly rolled forward
- Additional operational evidence from official theme debugging:
- an official theme can report a newer `currentVersion`/`sellableVersion` while the package binary is still missing its runtime bundle
- `platform-api` catalog promotion can fail on an unrelated entry and still leave the rebuilt package artifact available for single-item recovery
- `platform-api` package URL generation can point at an embedded artifact route even when the actual artifact file is absent in the running pod

## Follow-Up Work

- Add a Kubernetes-side equivalent of live runtime version verification.
- Consider a Docker Compose maintenance switch if storefront traffic needs a stronger cutover guarantee.
- Consider publishing a dedicated operator runbook for rescue-mode `source-archive` usage.
- Add an explicit release-publication checklist that ends with Singapore publication plus `get.jiffoo.com` verification.
- Add a downstream rollout checklist for consumer hosts such as RackNerd-branded deployments.
- Split official extension publication into:
  - canonical artifact publication
  - metadata promotion
  - downstream consumer rollout verification
- Move official package URLs away from `market.jiffoo.com` / `platform-api` coupling and toward a stable artifact origin that can be validated independently.
