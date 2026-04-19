# ADR-0002: Official Artifact Host Is Decoupled From Platform-API

Status: proposed
Date: 2026-04-19

## Context

Official themes and plugins currently depend on two separate concerns moving in lockstep:

- package artifact publication
- `platform-api` metadata promotion

In practice, those concerns drifted apart:

- official source repos could contain packaged runtime bundles that were never committed or published
- the official artifact builder could assemble a `.jtheme` without `entry.runtimeJS`
- `platform-api` sync could fail on an unrelated catalog row and block the whole batch
- `packageUrl` could point at a dead or unavailable artifact host such as `market.jiffoo.com`

This made routine theme/plugin releases too heavy. A package could be ready, but downstream consumers still could not install or recover it unless `platform-api` deployment, artifact presence, and metadata promotion all succeeded together.

## Decision

We will split official extension publication into three independent stages:

1. Artifact publication
   - official theme/plugin binaries publish to a standalone canonical artifact origin
   - the binary must be downloadable without requiring a `platform-api` deployment
   - package assembly must fail if required runtime assets such as `entry.runtimeJS` are missing

2. Metadata promotion
   - `platform-api` records `currentVersion`, `sellableVersion`, `publishState`, and `installable`
   - metadata promotion may lag behind artifact publication
   - metadata sync failures must not invalidate or hide the already-published binary

3. Downstream consumer rollout
   - consumer installations fetch the binary from the canonical artifact origin
   - consumer rollout success is verified independently from metadata promotion

`platform-api` remains the control plane for catalog visibility and sellable-state decisions, but it is no longer the mandatory runtime host for official package binaries.

## Consequences

- Official theme/plugin releases become lighter and do not require `platform-api` deployment as a prerequisite for binary availability.
- Operators can debug publication failures in smaller pieces:
  - artifact missing
  - metadata not promoted
  - consumer not rolled forward
- Consumer recovery flows can restore package-managed themes/plugins from a canonical artifact URL even when control-plane sync is delayed.
- `platform-api` routes may still proxy or expose artifact URLs, but they are no longer the single point of failure for package availability.
- Release documentation, runbooks, and Linear tasks must explicitly treat artifact publication and metadata promotion as separate stages.
