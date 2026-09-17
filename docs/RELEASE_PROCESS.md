# Release Process — 发版流程

This repository ships on a **weekly release train**. Work merges continuously;
publication is batched, reviewed, and cut once per train. 本仓库采用**每周发版班车**制：
变更随时合入，发布按班车批量打包、审核后统一切出。

## Cadence 节奏

- A draft release is assembled automatically every **Monday 01:30 UTC** by the
  [`oss-release-draft`](../.github/workflows/oss-release-draft.yml) workflow, and can be
  triggered manually via `workflow_dispatch` (with an optional `prev_tag` override).
- The draft batches **every merged PR since the previous published release** — features,
  fixes, refactors, and migrations ride the same train.
- Maintainers review the draft, edit wording, then publish. Publishing the draft creates
  the tag and the public release. **A release is never cut per task or per PR.**
- Only **security or data-loss** fixes may leave the train and publish out of cycle.

## Versions 版本

- Increment the last digit of the current released version (for example
  `v1.0.152-opensource` → `v1.0.153-opensource`). Do not jump minor or major versions.
- Release titles use the form `Jiffoo <version>` (for example `Jiffoo 1.0.153`); tags keep
  the `-opensource` suffix.

## Release notes template

The workflow generates notes in this shape; keep it when editing by hand:

```markdown
> Open-source commerce core — storefront / admin / themes / plugins / marketplace-ready architecture.

Weekly release train: N merged change(s) since <prev tag>. …

## Added 新增功能
- (feat) … (#PR)

## Changed 优化改进
- (perf/refactor/chore/docs) … (#PR)

## Fixed Bug 修复
- (fix) … (#PR)

## Migrations 数据库迁移
- `apps/api/prisma/migrations/00XX_…`（如无迁移则省略本节）

## Upgrade 升级
- Self-hosted: `curl -fsSL https://get.jiffoo.com | bash`, or the Docker Compose upgrader.

## Documentation 文档
- README · Digital Commerce · Agentic Commerce · Release Process
```

Classification comes from conventional-commit PR titles (`feat:` → Added, `fix:` → Fixed,
`perf|refactor|chore|docs|test|build|ci:` → Changed, everything else → Other).

## Publication truth chain 发布事实链

1. Publish the GitHub release draft (this creates the tag).
2. Attach/update `core-update-manifest.json`, `jiffoo-source.tar.gz`, and its `.sha256`
   sidecar (the `release:oss:patch --publish` helper and
   `publish-self-hosted-update-feed` workflow own this).
3. **A GitHub Release is not the final publication step.** Self-hosted update detection is
   complete only when the new version appears at
   `https://get.jiffoo.com/releases/core/manifest.json`.
4. Downstream/consumer instances must be explicitly rolled forward; an advanced public feed
   does not mean consumers are updated.

## Branch hygiene 分支卫生

- Task branches follow `codex/<task-slug>`.
- The repository enables **auto-delete of head branches on merge**; merged branches are
  deleted automatically and must not be recreated.
- Branches attached to open PRs are kept until their PR resolves.
- A task branch whose PR was closed **without** merging is a maintainer decision: delete it
  only after confirming the work is abandoned or captured elsewhere (local worktree / GitLab
  mirror).
- `main` and `dev` are permanent. The public mirror never receives task-branch sync pushes.

## Language policy 语言策略

- `README.md` is English; `README.zh-CN.md` is the Chinese mirror; both link to each other
  at the top. Keep them content-equivalent.
- Release notes are English-first with bilingual section headers
  (`Added 新增功能` / `Changed 优化改进` / `Fixed Bug 修复`).
