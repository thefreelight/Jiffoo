# Changelog

## Unreleased

- makes `apps/shop` treat installed official theme runtimes as the canonical renderer source and removes silent fallback to same-slug embedded host copies for remote-only themes such as `modelsfind`
- narrows embedded storefront renderer fallback to an explicit compatibility allowlist and logs fallback usage so rollout drift is observable
- formalizes the single-source-of-truth runtime model across spec, PRD, executable PRD, and ADR docs

## v1.0.28-opensource - 2026-04-20

- removes host-owned auth branding and footer chrome from theme-owned shop auth routes so branded domains no longer inherit the generic `Jiffoo` auth shell
- publishes the `1.0.28` OSS runtime images and self-hosted update feed assets for `api`, `admin`, `shop`, and `updater`
- documents the official storefront runtime single-source-of-truth problem and the need to verify branded live HTML instead of relying only on Admin version state

## v1.0.27-opensource - 2026-04-20

- refreshes official theme install state after marketplace installs so `404` / `409` install races no longer leave Admin stuck on stale theme status
- retries theme activation after cache invalidation when an official theme install succeeds but the active-theme lookup still sees the old installed list
- prevents Admin theme/plugin install clicks from surfacing unhandled promise rejections while the post-install state refresh catches up

## v1.0.25-opensource - 2026-04-18

- auto-clears terminal self-hosted upgrade status so the Settings page can return to a clean idle state after completion or recovery
- adds an authenticated upgrade-status reset path that the Admin UI can use to hide stale success and recovery progress bars without a manual refresh
- expires stale terminal updater status files on the updater agent so old failed runs stop polluting future visits
- makes the self-hosted feed publication workflow wait for `api`, `admin`, `shop`, and `updater` runtime images before publishing a public manifest that references them

## v1.0.15-opensource - 2026-04-17

- hardens the Docker Compose self-hosted upgrader with a durable update lock and explicit runtime-version verification
- commits `APP_VERSION` only after the live runtime cutover succeeds, instead of persisting the target version up front
- keeps `image-first` as the normal path and makes `source-archive` an explicit recovery-only mode
- adds updater architecture docs: spec, PRD, PRD executable, and ADR
- aligns Admin/API operator guidance with the new upgrade model

## v1.0.5-opensource - 2026-04-11

- publishes the April 11 open-source release cut for the self-hosted `1.0.5` core update
- publishes the canonical public update manifest at `https://get.jiffoo.com/releases/core/manifest.json`
- keeps `https://api.jiffoo.com/api/upgrade/manifest.json` available as a compatible public gateway
- ships the docker-compose updater agent and automatic recovery wiring for self-hosted upgrades
- activates official embedded storefront renderer selection for package-managed theme packs
- improves admin upgrade diagnostics so manifest health and manual fallback state are visible in Settings
- adds a GitHub-release-driven update feed publishing workflow so self-hosted installations can discover new releases from the official manifest automatically
