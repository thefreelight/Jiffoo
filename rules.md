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
