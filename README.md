# Jiffoo

[![License: GPL v2+](https://img.shields.io/badge/License-GPL%20v2+-blue.svg)](https://www.gnu.org/licenses/gpl-2.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-black.svg)](https://nextjs.org/)
[![Fastify](https://img.shields.io/badge/Fastify-5-green.svg)](https://www.fastify.io/)

A self-hosted commerce core for a single merchant and a single storefront.

Deploy once with Docker Compose, own your data and your environment, and manage
products, orders, extensions, themes and Core updates from the Admin application.
Installing an extension does not require SSH access, a plugin-specific deployment,
or a Core restart.

## What it is

- Commerce kernel: catalog, customers, inventory, cart, checkout, orders, payment state
- One Extension Center: marketplace index or local package upload, one installation path
- Extensions run in-process and become usable without restarting Core
- Themes are declarative data; Core ships the components that render them
- Docker Compose is the reference delivery form, including backup, migration and
  update flows

Jiffoo is not a hosted marketplace platform. It has no multi-tenant, super-admin,
platform-account or subscription layer.

## Status

Core V1 is under active development against the acceptance scenarios in the
[execution plan](docs/agentra-002-v1-execution-plan.md). The scenarios are not all
met yet; the plan records which are.

## Quick start

```bash
git clone https://github.com/thefreelight/Jiffoo.git
cd Jiffoo
pnpm install
cp apps/api/.env.example apps/api/.env
pnpm --filter api db:migrate
pnpm dev
```

Requires Node 20+, PostgreSQL 14+, Redis 6+, pnpm 9+.
Admin runs on 3002, API on 3001.

## Repository layout

```text
apps/        api, admin
packages/    plugin-sdk, shared, ui
```

## Documentation

- [Core V1 Product Charter](docs/agentra-001-core-v1-product-charter.md) — what Core V1 is
- [V1 Execution Plan](docs/agentra-002-v1-execution-plan.md) — acceptance status
- [Contributing](CONTRIBUTING.md)

## Licence
