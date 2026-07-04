# OSS Release Publication Checklist

Use this checklist before any OSS release is marked stable or self-hosted-detectable.

## Required Truth Chain

The release is complete only when all facts converge in this order:

1. GitHub Release exists for `v<version>-opensource` and is not quarantined.
2. Runtime images for `api`, `admin`, `shop`, and `updater` exist and use the exact `<version>` tag.
3. GitHub release assets include `core-update-manifest.json`, `jiffoo-source.tar.gz`, and `jiffoo-source.tar.gz.sha256`.
4. The public feed at `https://get.jiffoo.com/releases/core/manifest.json` serves the same `latestVersion`, `releaseTag`, `deliveryMode: image-first`, runtime images, source archive URL, and checksum URL.
5. Self-hosted detection through `/api/upgrade/version` reports the same public manifest facts.
6. Live runtime verification passes for API `APP_VERSION`, API `package_version`, and branded storefront active runtime HTML.

## Candidate Before Stable

- Candidate publication may validate the exact same images and assets before merchant-visible stable promotion.
- Stable promotion must reuse verified images and assets; do not rebuild runtime images between candidate validation and stable publication.
- A GitHub Release alone is never enough evidence for self-hosted availability.

## Required Commands

Run these gates before stable promotion:

```sh
node scripts/run-release-quality-gates.mjs
node scripts/verify-release-history-availability.mjs --verify-images
node scripts/verify-public-release-convergence.mjs
node scripts/verify-live-runtime-version.mjs
node scripts/verify-branded-storefront-runtime.mjs
```

## Failure Handling

- If images, assets, public feed, self-hosted detection, or live runtime verification do not converge, keep or mark the release as quarantined.
- Quarantine notes must say the release must not be treated as self-hosted-detectable.
- Repair existing releases with `docs/operations/oss-release-publication-repair-runbook.md`.

## Completion Evidence

- The release is stable only after release history availability, public convergence, live runtime, and branded storefront runtime checks pass.
- `get.jiffoo.com` is the public self-hosted detection source of truth.
- Downstream branded hosts are consumers; they do not define OSS release publication completion.
