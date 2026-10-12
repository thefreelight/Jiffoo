# Jiffoo Core operator guide

Jiffoo Core V1 runs on one Linux host with Docker Engine and Docker Compose v2
(2.24.4 or newer). Docker must support Linux amd64 images and Compose's `!reset`
tag. Windows is supported only by the separate local trial harness.

## First deployment

Choose a release built from the exact commit with successful full verification.
Obtain its release directory, including `release.json`, `bin`, and `deploy`.
The production verifier accepts only the pinned official GHCR images in that
manifest. Do not edit its recorded deployment files or its image references.

Set up real shop and Admin domains and DNS. Supply a certificate covering both
names and a private key in regular files readable by UID 1000. Configure your
host's TLS ingress to reach the Compose edge on loopback; the stack publishes
only the edge port on `127.0.0.1`. Do not expose PostgreSQL, Redis or S3 directly.

Copy `deploy/compose/.env.example` to `deploy/compose/.env` inside the release
directory. Replace every placeholder. Generate separate cryptographically
random URL-safe secrets for JWT, database password, S3 root credentials and S3
application credentials. Generate the plugin encryption key as exactly 32 random
bytes encoded as base64. Keep the S3 application credentials separate from root
credentials: the configured bucket grants only ListBucket, GetObject and
PutObject. Use absolute TLS file paths, HTTPS origins in `STOREFRONT_URL` and
`ADMIN_URL`, the full source commit in `REVISION`, a unique project name, and an
unused edge port. Protect `.env` and the TLS private key from other host users.
Keep the fixed Compose subnet free. Secrets must never enter Git or terminal logs.

In the command examples replace the uppercase placeholders with your actual
values. `RELEASE_DIRECTORY` and all backup, target and state directories must be
absolute Linux paths. The directory containing each new destination must exist.

```sh
sh RELEASE_DIRECTORY/bin/jiffoo-host verify RELEASE_DIRECTORY SOURCE_COMMIT
docker compose --project-name PROJECT --env-file RELEASE_DIRECTORY/deploy/compose/.env -f RELEASE_DIRECTORY/deploy/compose/compose.yml -f RELEASE_DIRECTORY/deploy/compose/compose.release.yml up -d --no-build --wait --wait-timeout 600 edge
```

Open Admin and finish the first-install wizard to create your administrator.
The Admin system health page displays the image's version and short source
commit. Its version is build identity; it is not an operator setting.

## Backup

Schedule a maintenance window. Stop every stack container except PostgreSQL;
the backup command proves this state instead of assuming traffic has drained.
Run it while the full installed stack's stopped containers still exist.

```sh
docker compose --project-name PROJECT --env-file RELEASE_DIRECTORY/deploy/compose/.env -f RELEASE_DIRECTORY/deploy/compose/compose.yml -f RELEASE_DIRECTORY/deploy/compose/compose.release.yml stop -t 45 edge shop admin api-lb worker-1 worker-2 api-1 api-2 redis silo
sh RELEASE_DIRECTORY/bin/jiffoo-host backup RELEASE_DIRECTORY PROJECT BACKUP_DIRECTORY
docker compose --project-name PROJECT --env-file RELEASE_DIRECTORY/deploy/compose/.env -f RELEASE_DIRECTORY/deploy/compose/compose.yml -f RELEASE_DIRECTORY/deploy/compose/compose.release.yml up -d --no-build --wait --wait-timeout 600 edge
```

After an update or restore, use its printed Compose configuration with `-f`
instead of the original pair of files for subsequent stop/start commands.

The backup includes the PostgreSQL logical dump (including roles), S3 object
archive, resolved deployment configuration, `.env`, TLS files, release manifest
and release deployment files. It does not contain Docker images: keep the
recorded immutable images available. Redis is deliberately excluded and is empty
after restore. The backup holds secrets and customer data. Protect an off-host
copy, restrict access and rehearse restoration. Keep `backup.sha256`; the command
prints the manifest SHA-256 needed to confirm restore. Do not edit backup files.

## Update

Prepare and verify the new release first. Copy the current `.env` into the target
release's `deploy/compose` directory, preserving credentials and store URLs.
Select new, distinct state and backup directories outside either release.
Supply installed plugin packages with `--plugin-packages` when their updates
are part of the plan. The current release must match the running deployment.

```sh
sh CURRENT_RELEASE/bin/jiffoo-host update --project PROJECT --current-release CURRENT_RELEASE --target-release TARGET_RELEASE --target-commit TARGET_COMMIT --state-dir STATE_DIRECTORY --backup-dir BACKUP_DIRECTORY --actor OPERATOR --plan
sh CURRENT_RELEASE/bin/jiffoo-host update --project PROJECT --current-release CURRENT_RELEASE --target-release TARGET_RELEASE --target-commit TARGET_COMMIT --state-dir STATE_DIRECTORY --backup-dir BACKUP_DIRECTORY --actor OPERATOR --confirm PLAN_SHA256
```

Read the plan, including Core and plugin migrations, release identities and
backup location. Use the exact printed plan digest as `PLAN_SHA256`; migrations
require this confirmation. The helper stops applications, proves maintenance,
creates and verifies a backup, audits Core and plugin histories before migration
writes, applies transactional Core migrations and fenced plugin migrations,
recreates the stack and waits for health.

Before any migration commits, an update failure can automatically restore the
previous application. Once any migration committed or its outcome is unknown,
application rollback is forbidden. Use the exact printed restore command and
the pre-update backup. Do not manually restart old applications over migrated
data. The durable journal records each phase; `--resume` judges interrupted state
only and does not silently repeat writes. `--restore-prior` requires proof that
no migration committed. Keep update state and backup directories for recovery.

## Restore

Stop every target stack container, including PostgreSQL. Restore requires a new
directory and the exact backup manifest SHA-256. It verifies checksums, release
identity and disk space before creating fresh named data volumes. Old volumes
are retained. Existing stopped containers are recreated against the restored
configuration, and the recorded release must become healthy.

```sh
docker compose --project-name PROJECT -f ACTIVE_CONFIG stop -t 45
sh RELEASE_DIRECTORY/bin/jiffoo-host restore BACKUP_DIRECTORY PROJECT RESTORE_DIRECTORY BACKUP_SHA256
docker compose --project-name PROJECT -f RESTORE_DIRECTORY/compose.restore.json ps -a
```

Use the printed restored release directory and `compose.restore.json` for future
operations. Do not reuse the old Compose configuration: it targets old volumes.
Redis starts empty. The restore directory contains secrets and customer data too.
Keep old volumes until you have independently validated the restored store.

## Troubleshooting and limits

Inspect `docker compose --project-name PROJECT -f ACTIVE_CONFIG ps -a` and service
logs. Check TLS file permissions, free disk space, occupied ports/subnets, image
availability and health output. On schema/history drift, stop: do not edit a
migration or force a schema push. On update failure preserve the journal, backup
and logs, then follow the printed recovery command. Do not delete retained old
volumes while investigating. Host locks prevent concurrent backup/update/restore.

V1 uses single-host PostgreSQL, Redis and S3-compatible data services. Multiple
API and worker instances do not provide data-service HA. There is no automatic
off-host backup, rolling zero-downtime update, Kubernetes delivery or Admin update
UI. Production host commands are Linux-only; the Windows trial is a local harness,
not a production hosting recommendation.
