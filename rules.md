# Jiffoo OSS Repository Rules

## Repository Role

- `Jiffoo` is the canonical public open-source core repository.
- OSS-scope feature authoring belongs here by default.
- `jiffoo-mall-core` is the closed commercial overlay repository.
- `jiffoo-extensions-official` is the canonical official extension repository.

## Canonical Local Paths

- `Jiffoo`: `/Users/jordan/Projects/jiffoo`
- `jiffoo-mall-core`: `/Users/jordan/Projects/jiffoo-mall-core`
- `jiffoo-extensions-official`: `/Users/jordan/Projects/jiffoo-extensions-official`

## Repository Address Matrix

Canonical repos:

- `jiffoo`
  - local: `/Users/jordan/Projects/jiffoo`
  - GitHub: `https://github.com/thefreelight/Jiffoo`
  - GitLab: `https://git.lafdru.local/lafdru/Jiffoo.git`
- `jiffoo-mall-core`
  - local: `/Users/jordan/Projects/jiffoo-mall-core`
  - GitHub: `https://github.com/thefreelight/jiffoo-mall-core.git`
  - GitLab: `https://git.lafdru.local/lafdru/jiffoo-mall-core.git`
- `jiffoo-extensions-official`
  - local: `/Users/jordan/Projects/jiffoo-extensions-official`
  - GitHub: `https://github.com/thefreelight/jiffoo-extensions-official.git`
  - GitLab: `https://git.lafdru.local/lafdru/jiffoo-extensions-official.git`

## What Belongs Here Canonically

- `apps/api`
- `apps/admin`
- `apps/shop`
- shared packages and SDKs
- default open-source theme
- open-source docs, examples, and release artifacts

## What Does Not Belong Here Canonically

- `apps/platform-api`
- `apps/super-admin`
- `apps/developer-portal`
- closed commercial operator features
- official extension source trees
- desktop/mobile private hosts

## Default Workflow

- Start OSS-scope feature authoring in `Jiffoo` by default.
- If a feature belongs to closed commercial overlay work, move it to `jiffoo-mall-core`.
- If a feature belongs to official theme/plugin authoring, move it to `jiffoo-extensions-official`.
- Do not treat `Jiffoo` as a passive sync mirror.

## Cross-Repo Boundary

- `jiffoo-mall-core` may temporarily contain overlapping OSS files during migration, but `Jiffoo` remains canonical for OSS scope.
- `apps/api` and `apps/platform-api` must not share one Prisma migration history table; even on one Postgres server they should use separate logical databases.

## Theme Client Contract Rules

When implementing official storefront support for web, mobile, desktop, or future custom clients, treat the following files as the only source of truth:

- `docs/theme-client-platform-contract.md`
- `docs/theme-client-api-catalog.json`
- `docs/theme-client-adapter-registry.json`
- `docs/theme-client-compatibility-matrix.md`
- `docs/theme-client-official-theme-support.md`
- `docs/theme-client-first-wave-rollout.md`

If you are changing client-specific storefront support in another repository, that repository must point back here instead of redefining the contract locally.

### Hard Invariants

- `切主题 != 切核心 commerce API`
- Theme switches may change presentation, renderer selection, and adapter selection only.
- Theme switches must not fork product, cart, order, payment, or auth semantics.
- Clients must resolve store and active theme through `/api/store/context` and `/api/themes/active`.
- Do not add client-private commerce endpoints. If a new storefront contract is required, propose it in core first.
- Plugin-backed features must continue to go through the existing extension/plugin gateway model.
- `builtin-default` is the first official priority. `quiet-curator` and `stellar-midnight` remain first-wave targets until implementation and verification upgrade their support state.
- Limited, experimental, and unsupported themes must have explicit fallback behavior; do not allow silent failure.

### Required Verification

- Run `node scripts/verify-theme-client-contracts.mjs --strict-cross-repo` after changing the cross-platform storefront contract or official support metadata.

### Database Safety

- Stop immediately if any database drift is detected.

## Temporary Agile Deployment Path

- Until the formal release docs are updated, the current rapid production iteration path for OSS runtime work is the Singapore cluster path below.
- This temporary path is the operational reality for fast rollout and validation, even if older docs still emphasize other release systems.

### Target Cluster

- The current agile production target for OSS runtime rollout is the Singapore cluster.
- Do not assume the local/Qujing cluster is the production target.
- When checking the Singapore cluster from its master host, prefer `sudo` with `KUBECONFIG=/etc/kubernetes/admin.conf`.

### Namespace And Registry

- OSS production namespace: `jiffoo-oss-prod`
- Current agile registry namespace:
  `crpi-si4hvlqhabu9zjq7.ap-southeast-1.personal.cr.aliyuncs.com/jiffoo-oss/*`
- Do not silently swap the target registry to Harbor unless the user explicitly asks for a rollback or workaround.

### Service And Domain Mapping

- The OSS production surface in this repo is:
  - `shop`
  - `api`
  - `admin`
- Public domains for this temporary path:
  - `jiffoo.com`
  - `www.jiffoo.com`
  - `shop.jiffoo.com`
  - `api.jiffoo.com`
  - `admin.jiffoo.com`
- The `jiffoo.com` landing experience is expected to come from OSS `shop` plus the built-in default theme.
- There is no separate production landing-page service in this temporary path.

### Temporary Rollout Sequence

- Build from the canonical OSS repo (`Jiffoo`).
- Push the image to the Singapore ACR namespace above.
- Update the live Singapore deployment directly for fast validation when required.
- Backfill `deploymentrepo` so desired state matches the validated live rollout.
- Treat this as a temporary agile rollout path, not a replacement for the long-term formal release model.

### Verification Rules

- Verify the actual Singapore production routes, not just local builds:
  - `api.jiffoo.com`
  - `admin.jiffoo.com`
  - `jiffoo.com`
  - `shop.jiffoo.com`
- If routing or ingress ownership is ambiguous, inspect the Singapore cluster before declaring success.

### Database Safety

- Before changing the live OSS API deployment, check for drift first.
- If migration history is missing and live schema differs from Prisma schema, stop immediately.
