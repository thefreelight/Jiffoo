## What's included
- Hardens the Docker Compose self-hosted updater with a durable upgrade lock and live runtime verification before version commit.
- Commits `APP_VERSION` only after the runtime cutover, migrations, and health checks finish successfully.
- Keeps `image-first` as the default upgrade path and requires explicit `--force-source-archive` for rescue-mode source replacement.
- Aligns updater rehearsal coverage, operator guidance, and release docs with the new version-last cutover model.
