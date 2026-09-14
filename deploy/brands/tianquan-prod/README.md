# tianquan.org production instance

This directory is the declared Kubernetes source for the independent Tianquan
Jiffoo instance. Application images are pinned by OCI digest to Jiffoo OSS
`v1.0.61-opensource` (`e7bfb53860527a36f505ba72969b22237ea6e8c0`).

Before applying, create `tianquan-secrets` in `tianquan-prod` with
`postgres-user`, `postgres-password`, `database-url`, and `jwt-secret`. Secrets
must never be committed. Apply database and storage first, confirm the new
database is empty, then run the immutable migration Job before starting API,
Shop, and Admin.

The public role map is:

- Shop: `https://tianquan.org`
- API: `https://api.tianquan.org`
- Admin: `https://admin.tianquan.org`

The production extension set is intentionally minimal:
`tianquan@0.0.5` and `smtp-email@0.0.5`. Configure SMTP through the published
plugin contract after installation; do not add mailbox credentials to these
manifests.
