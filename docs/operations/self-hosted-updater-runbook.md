# Self-Hosted Core Update Runbook

Use this runbook when the Admin update center reports that one-click upgrade is unavailable and an operator must guide the self-hosted core update.

## Preconditions

- The target release is not quarantined.
- `get.jiffoo.com` serves the same `latestVersion` and `releaseTag` as the GitHub release.
- The public manifest uses `deliveryMode: image-first`.
- Runtime images for `api`, `admin`, `shop`, and `updater` exist and use the exact target version tag.
- `core-update-manifest.json`, `jiffoo-source.tar.gz`, and `jiffoo-source.tar.gz.sha256` are present on the GitHub release and public feed.
- `requiresManualIntervention` and `minimumAutoUpgradableVersion` have been reviewed in the public manifest.

## Docker Compose

1. Create a backup before changing runtime containers.
2. Pull the target `api`, `admin`, `shop`, and `updater` images from the public manifest.
3. Update compose image tags and `APP_VERSION` to the target version together.
4. Start the updater bridge before replacing app containers.
5. Replace `api`, `shop`, and `admin` containers.
6. Run Prisma migrations from the target API image.
7. Verify `/health`, `/api/upgrade/version`, and the branded storefront runtime all report the target version.
8. Treat source archives as a recovery path only, not the default upgrade path.

## Kubernetes

1. Create a backup and capture the current deployment image set.
2. Update deployment images for `api`, `admin`, `shop`, and updater controller to the exact target version tags.
3. Apply migrations with the target API image before opening traffic to the upgraded API.
4. Roll app deployments and wait for healthy readiness checks.
5. Verify `/health`, `/api/upgrade/version`, and branded storefront runtime output from outside the cluster.
6. If runtime verification fails, roll back images before marking the release complete.

## Completion Criteria

- Admin update center shows the target as the current version.
- Public feed, GitHub release assets, and runtime images all describe the same version.
- Branded storefront HTML references the active installed theme versioned runtime path.
- No local version metadata is advanced before live runtime verification succeeds.
