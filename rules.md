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
