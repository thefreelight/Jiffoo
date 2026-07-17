# Jiffoo OSS Repository Rules

## Repository Role

- `Jiffoo` is the public open-source repository.
- It should contain only the approved open-source scope.
- It must not expose internal/private repository topology.

## Public Scope Rule

This repository must not expose:

- private repository names or URLs
- internal Git hosting topology
- closed-source platform applications
- internal deployment credentials or internal-only environment details

## What Belongs Here

- the self-hosted open-source runtime
- public-facing documentation
- OSS-safe build, test, and release metadata

## What Does Not Belong Here

- official marketplace theme source trees
- official marketplace plugin source trees or package contents
- platform-only services
- desktop/mobile private host applications
- internal repository address matrices

## Default Workflow

- Use this repository for OSS-safe work only.
- Do not start private feature authoring here.
- If a feature depends on closed-source systems, do not document private implementation details in this repo.

## Database Safety

- Stop immediately if any database drift is detected.

## Official Plugin Initial Version

- Every newly introduced official plugin slug must start at version `0.0.1`.
- Its first shared-catalog entry and artifact URL must both use `0.0.1`; do not use `0.1.0`, `1.0.0`, or another milestone version as the initial release.
- A different initial version is allowed only when the user explicitly approves an exception for a plugin that was already released or imported externally.
