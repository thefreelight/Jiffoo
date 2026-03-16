# Disaster Recovery Drill

This file records the baseline recovery drill pattern for self-hosted Jiffoo environments.

## Drill goal

- validate that backups are restorable
- validate that the application can return to a healthy state
- measure actual RPO and RTO against targets

## Suggested drill cadence

- monthly for staging
- quarterly for production-like environments

## Drill checklist

### Preparation

- confirm the target backup exists
- verify checksum
- prepare a restore target
- notify affected operators

### Restore

- download the backup set
- restore the database
- restore uploaded files if applicable
- restart or roll out the application

### Validation

- health checks pass
- storefront loads
- admin login succeeds
- product and order data are present

## Record template

| Field | Value |
| --- | --- |
| Drill date |  |
| Environment |  |
| Executor |  |
| Backup artifact |  |
| Measured RPO |  |
| Measured RTO |  |
| Result |  |

## Follow-up

Every drill should end with:

- issues found
- remediation plan
- next scheduled drill
