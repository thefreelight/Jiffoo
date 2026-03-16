# Backup and Recovery

This document describes the backup and disaster recovery model for self-hosted Jiffoo deployments.

## Current targets

| Metric | Target |
| --- | --- |
| Recovery Point Objective (RPO) | 24 hours |
| Recovery Time Objective (RTO) | 4 hours |
| Full backup frequency | Daily |
| Retention | 30 days |
| Integrity check | SHA-256 |

## Backup scope

### Database

- PostgreSQL database dump
- encrypted at rest
- checksum generated for every backup artifact

### File storage

- uploaded assets
- generated storefront files
- theme and marketplace download cache when required

## Recommended execution

### Single host

- nightly database dump
- nightly asset archive
- off-host copy to object storage

### Docker Compose

- backup from the database container or a dedicated backup sidecar
- persist uploads and marketplace cache on a mounted volume

### Kubernetes

- CronJob-driven database backup
- object storage for persistent assets
- restore drill against a staging namespace

## Restore workflow

1. Identify the restore point
2. Verify checksum and encryption material
3. Stop or scale down application traffic
4. Restore the database
5. Restore uploaded files and cache if required
6. Run smoke checks
7. Re-enable traffic

## Validation

Every backup strategy should include:

- checksum verification
- periodic restore drills
- application smoke tests after restore

## Notes

- Open-source core upgrades should create a pre-upgrade recovery point
- Automatic update failure handling may restore the last healthy release
- User-facing "roll back to any old version" is not part of the supported UX
