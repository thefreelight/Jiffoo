# Changelog

## v1.0.8-opensource - 2026-04-13

- publishes the April 13 hotfix release cut for the self-hosted `1.0.8` core update
- fixes official theme package upgrades so `.jtheme` archives with versioned top-level directories such as `modelsfind-0.1.2/` no longer fail extension security validation with an unsupported `.2` file-type error
- keeps the public update manifest and self-hosted release feed aligned with the `v1.0.8-opensource` release tag

## v1.0.7-opensource - 2026-04-13

- publishes the April 13 open-source release cut for the self-hosted `1.0.7` core update
- publishes the canonical public update manifest at `https://get.jiffoo.com/releases/core/manifest.json`
- keeps `https://api.jiffoo.com/api/upgrade/manifest.json` available as a compatible public gateway
- ships the docker-compose updater agent and automatic recovery wiring for self-hosted upgrades
- activates official embedded storefront renderer selection for package-managed theme packs
- improves admin upgrade diagnostics so manifest health and manual fallback state are visible in Settings
- adds a GitHub-release-driven update feed publishing workflow so self-hosted installations can discover new releases from the official manifest automatically
- adds Merchant Admin official theme/plugin update detection so installed official assets can surface `Update available` when the control plane moves to a newer sellable version
