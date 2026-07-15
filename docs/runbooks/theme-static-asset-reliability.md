# Theme Static Asset Reliability

This runbook defines the public runtime contract for installed theme packs.

## Storage contract

For a shop theme identified by `slug` and `version`, the API must expose both paths:

```text
extensions/themes/shop/<slug>/
extensions/themes/shop/.versions/<slug>/<version>/
```

The first path is the active compatibility view. The second is an immutable snapshot used by version-aware storefront builds and rollback. Both must contain `theme.json` and every file referenced by its `entry` fields.

The installer creates the immutable snapshot only after extraction and manifest validation succeed. Existing snapshots are never overwritten. Uninstall removes the compatibility view and every snapshot for that slug.

## Replica startup contract

Each API replica may have its own local extensions directory. Before registering readiness, it must:

1. Resolve the active shop theme.
2. Restore an active official theme when its compatibility view is missing.
3. Materialize its immutable version snapshot.
4. Verify `theme.json` exists in both views.

If an active official theme cannot be restored or verified, the replica must not become ready. Serving a transient `404` and relying on a later request to repair the replica is prohibited.

## Release verification

Before rollout, confirm database migration status without using production as a shadow database. Stop if any schema drift is reported.

After rollout, verify every replica independently, then verify the service and public edge:

```bash
curl -fsS https://API_HOST/extensions/themes/shop/THEME/theme.json
curl -fsS https://API_HOST/extensions/themes/shop/.versions/THEME/VERSION/theme.json
curl -fsS https://STOREFRONT/extensions/themes/shop/.versions/THEME/VERSION/runtime/theme-runtime.js
```

Also request at least one image or font referenced by the manifest. A health endpoint returning `200` is not evidence that theme assets are healthy.

Static `404` responses must use `Cache-Control: no-store`. After repairing a previously missing URL, purge only the affected edge-cache URLs and repeat all checks.

## Rollback

Keep the previous immutable snapshot. Roll back the active theme pointer and storefront build together, then verify the previous manifest, runtime, and representative assets before restoring traffic.
