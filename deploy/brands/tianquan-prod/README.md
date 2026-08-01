# tianquan.org production instance

This directory is the declared Kubernetes source for the independent Tianquan
Jiffoo instance. Application images are pinned by OCI digest to OSS commit
`07b3881542d1f504fe1f981c7c641527cbe511f3`.

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
`tianquan@0.0.2` and `smtp-email@0.0.1`. Configure SMTP through the published
plugin contract after installation; do not add mailbox credentials to these
manifests.
