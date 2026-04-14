# Changelog

## v1.0.9-opensource - 2026-04-15

- publishes the April 15 open-source release cut for the self-hosted `1.0.9` core update
- refreshes the canonical public update manifest at `https://get.jiffoo.com/releases/core/manifest.json`
- republishes the self-hosted source archive and checksum for manual Docker Compose upgrades
- keeps `https://api.jiffoo.com/api/upgrade/manifest.json` aligned as the compatibility gateway
- carries forward the latest updater/runtime fixes from the current open-source recovery branch snapshot

## v1.0.5-opensource - 2026-04-11

- publishes the April 11 open-source release cut for the self-hosted `1.0.5` core update
- publishes the canonical public update manifest at `https://get.jiffoo.com/releases/core/manifest.json`
- keeps `https://api.jiffoo.com/api/upgrade/manifest.json` available as a compatible public gateway
- ships the docker-compose updater agent and automatic recovery wiring for self-hosted upgrades
- activates official embedded storefront renderer selection for package-managed theme packs
- improves admin upgrade diagnostics so manifest health and manual fallback state are visible in Settings
- adds a GitHub-release-driven update feed publishing workflow so self-hosted installations can discover new releases from the official manifest automatically
