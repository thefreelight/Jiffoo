# OSS Release Publication Repair Runbook

Use this runbook when a GitHub release exists but any part of the self-hosted
publication contract is incomplete:

- runtime images for api/admin/shop/updater
- GitHub release assets: `core-update-manifest.json`, `jiffoo-source.tar.gz`,
  `jiffoo-source.tar.gz.sha256`
- public feed at `https://get.jiffoo.com/releases/core/manifest.json`
- public source archive/checksum URLs
- live runtime verification for API and the branded storefront

Bad stable releases must be repaired or quarantined. They must not remain
stable and self-hosted-detectable while the contract is incomplete.

For the normal release path, use
`docs/operations/oss-release-publication-checklist.md` before marking a release
stable or self-hosted-detectable.

## Detect

Run:

```sh
pnpm verify:release-history-availability
```

For a single release:

```sh
node scripts/verify-release-history-availability.mjs --release-tag v1.0.32-opensource
```

For a single quarantined release:

```sh
node scripts/verify-release-history-availability.mjs --release-tag v1.0.32-opensource --expect-quarantined
```

As of this runbook, the current hard historical failure is:

- `v1.0.32-opensource`: missing `core-update-manifest.json`,
  `jiffoo-source.tar.gz`, and `jiffoo-source.tar.gz.sha256`

Current bounded public metadata audit on 2026-06-08:

- `v1.0.32-opensource` is still a stable-looking GitHub release with no
  required self-hosted assets. Quarantine it before treating release history as
  available.
- `v1.0.33-opensource`, `v1.0.34-opensource`, and `v1.0.35-opensource` are
  currently blocked by transient GitHub release asset fetch failures. Retry the
  audit and check GitHub asset/CDN availability before mutating release state.
- `v1.0.36-opensource` is already `QUARANTINED` and must remain prerelease until
  images, release assets, public feed convergence, self-hosted detection, and
  live runtime verification all pass.
- `v1.0.37-opensource` is already `QUARANTINED` with no release assets and must
  not be treated as self-hosted-detectable.

## Preferred: GitHub Actions

Run the `Repair OSS Release Publication` workflow.

`version` accepts core SemVer only, without `v` or `-opensource`. Use
comma-separated versions only for `action=quarantine`; duplicates are rejected
before any release mutation starts.

To quarantine the current known hard-bad release:

- `action`: `quarantine`
- `version`: `1.0.32`
- `notes`: `Existing stable release failed the self-hosted publication contract and is not self-hosted-detectable.`
- `publication_tooling_ref`: the branch or tag containing the hardened release tooling

The workflow uses `--defer-release-history-availability`, verifies each quarantined tag
with `--expect-quarantined`, then runs
`node scripts/verify-release-history-availability.mjs --verify-images` once
after all requested release mutations.

To repair one existing release instead of quarantining it:

- `action`: `repair`
- `version`: one core version only, for example `1.0.37`
- `publication_tooling_ref`: the branch or tag containing hardened publication tooling

The repair path also requires these GitHub Actions variables or secrets:

- `JIFFOO_RELEASE_LIVE_API_URL`
- `JIFFOO_RELEASE_BRANDED_STOREFRONT_URL`
- `JIFFOO_RELEASE_BRANDED_THEME_SLUG`
- `JIFFOO_RELEASE_BRANDED_THEME_VERSION`

## Local Token Fallback

Use a token only when the workflow cannot be used. Quarantine hard-bad releases
with deferred history verification, then run the final audit once after
transient GitHub asset fetch failures have cleared.
When using a non-default repository or GitHub API mirror, pass the same `--repo`
and `--github-api-url` values to every helper and verifier command below.

Local image-aware audits require Docker Buildx and ACR credentials before any
`--verify-images` command:

```sh
docker buildx version
docker login crpi-si4hvlqhabu9zjq7.ap-southeast-1.personal.cr.aliyuncs.com
```

```sh
GITHUB_TOKEN=... node scripts/release-oss-patch.mjs \
  --version 1.0.32 \
  --publish \
  --quarantine-existing-release \
  --defer-release-history-availability \
  --notes "Existing stable release failed the self-hosted publication contract and is not self-hosted-detectable."

GITHUB_TOKEN=... node scripts/verify-release-history-availability.mjs \
  --release-tag v1.0.32-opensource \
  --expect-quarantined

GITHUB_TOKEN=... node scripts/verify-release-history-availability.mjs --verify-images
```

## Acceptance Evidence

The repair is complete only when:

- before any pending release is marked stable,
  `node scripts/verify-release-history-availability.mjs --exclude-pending-release-tag <release-tag> --verify-images`
  passes and confirms the rest of the release history is available with
  pullable runtime images
- `node scripts/verify-release-history-availability.mjs --verify-images` passes
- `https://get.jiffoo.com/releases/core/manifest.json` points at an
  `image-first` release with exact runtime image tags
- the release is stable only after feed/assets/images/live runtime verification
  have passed
- failed historical releases are visible as `QUARANTINED: <release-tag>`
  prereleases with notes explaining the missing facts
