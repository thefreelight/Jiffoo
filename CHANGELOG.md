# Changelog

## v1.0.14-opensource - 2026-04-17

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
