# AGENTRA-002 Pass 0A -- Stack & Delivery Recon


## Coverage

- C5 is answered from the API `start` script rather than output contents; this is configuration evidence only.
- D4-D6 identify static call sites, not observed runtime use.
- F2 is incomplete by construction: static `process.env` scans include CI/test/release scripts while environment examples describe deployable services; exact semantic equivalence is therefore `UNVERIFIABLE_STATIC`.

## A. Workspace layout

### Q A1. List every workspace package.
- **Answer:** Source of truth is `pnpm-workspace.yaml`. It includes four app paths, `packages/*`, and `packages/shop-themes/*`. Package inventory: `apps/api` `api@1.0.2` private=ABSENT (Fastify API); `apps/admin` `admin@0.1.0` private=true (Next admin); `apps/shop` `shop@1.0.0` private=true (Next storefront); `apps/cloudflare-native-core-api` `@jiffoo/cloudflare-native-core-api@0.0.2` private=true (Cloudflare worker); `packages/core-api-sdk` `@jiffoo/core-api-sdk@0.2.0` private=ABSENT (API SDK); `packages/create-jiffoo-app` `create-jiffoo-app@0.2.0` private=ABSENT (scaffolder); `packages/mcp-server` `@jiffoo/mcp-server@0.1.0` private=ABSENT (MCP server); `packages/plugin-sdk` `@jiffoo/plugin-sdk@1.2.0` private=ABSENT (plugin SDK); `packages/shared` `shared@1.0.0` private=ABSENT (shared library); `packages/theme-api-sdk` `@jiffoo/theme-api-sdk@0.2.0` private=ABSENT (theme API SDK); `packages/ui` `@jiffoo/ui@1.0.0` private=ABSENT (UI library). Theme packages: `ai-gateway`, `app-landingpage`, `bokmoo`, `default`, `digital-vault`, `esim-mall`, `fire`, `imagic-studio`, `modelsfind`, `navtoai`, `quiet-curator`, `serene`, `stellar-midnight`, `yevbi`; all are private except where package metadata is absent from the workspace list.
- **Evidence:** pnpm-workspace.yaml:1 `packages:`
- **Evidence:** pnpm-workspace.yaml:2 `- 'apps/cloudflare-native-core-api'`
- **Evidence:** pnpm-workspace.yaml:6 `- 'packages/*'`
- **Evidence:** packages/plugin-sdk/package.json:2 `"name": "@jiffoo/plugin-sdk"`
- **Method:** Read `pnpm-workspace.yaml`; enumerated `package.json` under its explicit globs; read package `README.md` where present.

### Q A2. Does an Extension SDK package/directory exist?
- **Answer:** Yes: `packages/plugin-sdk`, package `@jiffoo/plugin-sdk`; it has CLI initialization source and README.
- **Evidence:** packages/plugin-sdk/package.json:2 `"name": "@jiffoo/plugin-sdk"`
- **Evidence:** packages/plugin-sdk/src/cli/commands/init.ts:1 `import fs from 'fs';`
- **Method:** Searched workspace package manifests and `packages/**/*` for `plugin`, `extension`, `scaffold`, `sign`, and `init`.
- **Notes:** This contradicts a possible premise that no SDK exists.

### Q A3. Do extension capability contracts exist?
- **Answer:** Yes. `packages/plugin-sdk` contains SDK types; API-side extension contract code also exists under `apps/api/src/core/admin/extension-installer`.
- **Evidence:** packages/plugin-sdk/src/types.ts:1 `export interface PluginManifest`
- **Evidence:** apps/api/src/core/admin/extension-installer/contract-v1-runtime.ts:1 `import type { FastifyInstance } from 'fastify';`
- **Method:** Searched `packages`, `apps/api/src` for `interface`, `payment`, `shipping`, `tax`, `fulfillment`, `notification`, `contract`, and `PluginManifest`.

### Q A4. Which packages are published to npm?
- **Answer:** Static manifest evidence identifies non-private candidates: `@jiffoo/core-api-sdk`, `create-jiffoo-app`, `@jiffoo/mcp-server`, `@jiffoo/plugin-sdk`, `shared`, `@jiffoo/theme-api-sdk`, and `@jiffoo/ui`. Actual publication status is `UNVERIFIABLE_STATIC`; no registry query was made.
- **Evidence:** packages/core-api-sdk/package.json:3 `"version": "0.2.0"`
- **Evidence:** packages/plugin-sdk/package.json:3 `"version": "1.2.0"`
- **Evidence:** apps/admin/package.json:4 `"private": true,`
- **Method:** Read every workspace `package.json` for `private`, `publishConfig`, `files`, and release scripts.

## B. Toolchain and language runtime

### Q B1. What Node.js version is required/targeted?
- **Answer:** Root requires `>=18.0.0`; SDK/scaffolder/MCP packages also require `>=18.0.0`; API Dockerfile uses Node 20; production compose passes Node 20 for shop/admin; checked workflows use Node 20. No `.nvmrc` or `.node-version` was found. This is a target disagreement: the declared minimum is 18, while delivery/CI pin 20.
- **Evidence:** package.json:98 `"node": ">=18.0.0",`
- **Evidence:** packages/plugin-sdk/package.json:18 `"node": ">=18.0.0"`
- **Evidence:** apps/api/Dockerfile:2 `FROM node:20-bookworm-slim AS base`
- **Evidence:** docker-compose.prod.yml:134 `NODE_BASE_IMAGE: node:20-alpine`
- **Evidence:** .github/workflows/verify-theme-client-contracts.yml:15 `node-version: 20`
- **Method:** Searched `.nvmrc`, `.node-version`, all Dockerfiles, all compose files, all workflow YAML, and workspace manifests.

### Q B2. What package manager and version?
- **Answer:** pnpm `9.0.0`; a root `pnpm-lock.yaml` exists. The Cloudflare app also has its own `package-lock.json`.
- **Evidence:** package.json:96 `"packageManager": "pnpm@9.0.0",`
- **Evidence:** pnpm-lock.yaml:1 `lockfileVersion: '9.0'`
- **Evidence:** apps/cloudflare-native-core-api/package-lock.json:1 `{"name":"@jiffoo/cloudflare-native-core-api"`
- **Method:** Searched root and workspace lockfiles and `packageManager` fields.

### Q B3. What TypeScript and build tooling does each app use?
- **Answer:** Root TypeScript is `^5.8.3`. API: `tsc`, `tsc-alias`, then a runtime-import repair script. Admin/shop: Next build. Cloudflare: TypeScript type-check plus Wrangler deploy. Packages use TypeScript build configurations; core/plugin/theme SDKs have CJS and ESM tsconfigs.
- **Evidence:** package.json:91 `"typescript": "^5.8.3"`
- **Evidence:** apps/api/package.json:7 `"build": "prisma generate && tsc && tsc-alias -p tsconfig.json && node scripts/repair-dist-runtime-imports.mjs"`
- **Evidence:** apps/admin/package.json:7 `"build": "next build"`
- **Evidence:** apps/shop/package.json:7 `"build": "next build"`
- **Evidence:** apps/cloudflare-native-core-api/package.json:9 `"deploy": "wrangler deploy --config wrangler.jsonc"`
- **Method:** Read app and SDK package build scripts and tsconfig filenames; did not inspect output.

### Q B4. What test runners and API test locations are configured?
- **Answer:** Vitest is configured for API, admin, shop, and Cloudflare; Playwright is configured for E2E. API suites are under `apps/api/tests/core`, `tests/routes`, `tests/contract`, and `tests/e2e`.
- **Evidence:** apps/api/package.json:12 `"test": "vitest run"`
- **Evidence:** apps/api/package.json:19 `"test:e2e": "playwright test -c tests/e2e/playwright.admin.config.ts"`
- **Evidence:** package.json:38 `"test:e2e:shop": "playwright test -c apps/api/tests/e2e/playwright.shop.config.ts"`
- **Method:** Read package test scripts and searched `vitest.config.*`, `playwright*.config.*`, and `apps/api/tests/**`.

## C. Module system

### Q C1. What is each package `type` value?
- **Answer:** `module`: Cloudflare app, create-jiffoo-app, mcp-server, ui, and theme packages ai-gateway/app-landingpage/bokmoo/default/digital-vault/esim-mall/fire/imagic-studio/modelsfind/navtoai/serene/stellar-midnight/yevbi. `ABSENT`: root, api, admin, shop, core-api-sdk, plugin-sdk, shared, theme-api-sdk, quiet-curator, and external-plugin-demo.
- **Evidence:** apps/cloudflare-native-core-api/package.json:5 `"type": "module",`
- **Evidence:** apps/api/package.json:2 `"name": "api",`
- **Evidence:** packages/plugin-sdk/package.json:2 `"name": "@jiffoo/plugin-sdk",`
- **Method:** Read every workspace `package.json`; an absent key is reported as absent, not defaulted.

### Q C2. What are all tsconfig module settings?
- **Answer:** `apps/api/tsconfig.json`: commonjs/node/ES2022; `apps/admin` and `apps/shop`: esnext/bundler/ES2017; Cloudflare: ESNext/Bundler/ES2022; external plugin demo: commonjs/node/ES2020; shared: commonjs/node/ES2020; root: esnext/bundler/ES2020. SDK CJS configs are CommonJS/node/ES2020; their ESM/types configs are ESNext/bundler/ES2020. Theme tsconfigs extend root; their explicit module and resolution are esnext/bundler, and target is inherited ES2020 from root. No tsconfig declares `verbatimModuleSyntax`.
- **Evidence:** apps/api/tsconfig.json:3 `"target": "ES2022",`
- **Evidence:** apps/api/tsconfig.json:10 `"module": "commonjs",`
- **Evidence:** apps/admin/tsconfig.json:6 `"module": "esnext",`
- **Evidence:** packages/plugin-sdk/tsconfig.json:2 `"extends": "../../tsconfig.json",`
- **Evidence:** tsconfig.json:12 `"module": "esnext",`
- **Method:** Enumerated every `tsconfig*.json` outside excluded directories, parsed each JSON file, then followed its `extends` target.

### Q C3. What module-loading syntax occurs in `apps/api` source?
- **Answer:** ESM `import`/`export` is the source style. CommonJS `require`/`module.exports` is not evidenced in `apps/api/src`; static dynamic imports are also used.
- **Evidence:** apps/api/src/server.ts:1 `import 'dotenv/config';`
- **Evidence:** apps/api/src/server.ts:437 `const { default: rateLimiterPlugin } = await import('@/plugins/rate-limiter');`
- **Method:** Searched `apps/api/src` for `\bimport\b`, `\bexport\b`, `\brequire\(`, and `module.exports`; excluded `dist`, generated Prisma, `.next`, and `node_modules`.

### Q C4. Are special module/cache mechanisms used?
- **Answer:** `createRequire` occurs in `PluginModuleLoader` (`apps/api/src/core/admin/extension-installer/plugin-module-loader.ts`). Dynamic imports occur throughout source, but no cache-busting query-string dynamic import, `require.cache`, `delete require.cache`, `Module._load`, `worker_threads`, or Node `vm` import was found by the stated search.
- **Evidence:** apps/api/src/core/admin/extension-installer/plugin-module-loader.ts:3 `import { createRequire } from 'module';`
- **Evidence:** apps/api/src/core/admin/extension-installer/plugin-module-loader.ts:6 `const runtimeRequire = createRequire(__filename);`
- **Method:** Searched `apps`, `packages`, `examples`, `scripts`, `tests`, `performance`, and `e2e` (excluding `node_modules`, `dist`, `.next`, generated Prisma, and theme-pack runtime) for exact patterns `require.cache`, `delete require.cache`, `createRequire`, `Module._load`, `worker_threads`, `from 'vm'`, `require('vm')`, and `import(...?v=|?t=|?hash=)`.

### Q C5. What built extension does `apps/api` use?
- **Answer:** `.js`, based on the configured start command `node dist/server.js`.
- **Evidence:** apps/api/package.json:8 `"start": "node dist/server.js"`
- **Method:** Read API build/start configuration only; did not read `dist`.

## D. Runtime dependencies

### Q D1. Fastify version and plugins?
- **Answer:** Fastify major 5. API declares `@fastify/cookie` 10, cors 10, helmet 13, jwt 8, multipart 9, static 8, swagger 9, and swagger-ui 5.
- **Evidence:** apps/api/package.json:91 `"fastify": "^5.6.1"`
- **Evidence:** apps/api/package.json:70 `"@fastify/cookie": "^10.0.1"`
- **Method:** Read `apps/api/package.json` dependencies for `fastify` and `@fastify/*`.

### Q D2. Prisma dependencies?
- **Answer:** Only `apps/api` declares both `prisma` and `@prisma/client`, each major 6 (`^6.18.0`).
- **Evidence:** apps/api/package.json:77 `"@prisma/client": "^6.18.0"`
- **Evidence:** apps/api/package.json:127 `"prisma": "^6.18.0"`
- **Method:** Read every workspace package manifest for exact keys `prisma` and `@prisma/client`.

### Q D3. Next versions and apps?
- **Answer:** Admin and shop use Next `16.2.10`; theme packages also declare Next ranges, including `^16.0.7` and `^16.1.6`.
- **Evidence:** apps/admin/package.json:37 `"next": "16.2.10"`
- **Evidence:** apps/shop/package.json:38 `"next": "16.2.10"`
- **Method:** Read workspace manifests for `next` dependency entries.

### Q D4. Redis client and distinct features?
- **Answer:** API declares `ioredis` 5 and `redis` 5. Static call sites show Redis cache (`core/cache/redis.ts`), BullMQ queues/workers (`infra/jobs`), inventory forecasting queue, and plugin gateway protection's optional Redis-compatible client. Runtime activation is `UNVERIFIABLE_STATIC`.
- **Evidence:** apps/api/package.json:119 `"ioredis": "^5.6.1"`
- **Evidence:** apps/api/package.json:129 `"redis": "^5.1.1"`
- **Evidence:** apps/api/src/core/cache/redis.ts:1 `import Redis from 'ioredis';`
- **Evidence:** apps/api/src/infra/jobs/queue-manager.ts:9 `import { Queue, QueueEvents, type ConnectionOptions } from 'bullmq';`
- **Evidence:** apps/api/src/core/inventory/forecasting/worker.ts:33 `this.queue = new Queue('inventory-forecasting', env.REDIS_URL, {`
- **Method:** Searched API source for `ioredis`, `redis`, `new Queue`, `new Worker`, `QueueEvents`, and `REDIS_URL`.

### Q D5. Job queue/scheduler?
- **Answer:** `bullmq` major 5 is registered in API; `bull` major 4 is also declared. Static registration call sites include queue manager, worker manager, and forecasting queue.
- **Evidence:** apps/api/package.json:110 `"bullmq": "^5.52.0"`
- **Evidence:** apps/api/package.json:109 `"bull": "^4.16.5"`
- **Evidence:** apps/api/src/infra/jobs/worker-manager.ts:95 `const worker = new Worker<BaseJobData>(`
- **Evidence:** apps/api/src/infra/jobs/queue-manager.ts:160 `await queue.add(data.eventType, data, {`
- **Method:** Searched source and API manifest for `bull`, `bullmq`, `new Queue`, `new Worker`, `QueueEvents`, `add(`, `schedule`, and `cron`.

### Q D6. Distributed lock?
- **Answer:** No distributed-lock library is declared. A hand-rolled filesystem upgrade lock exists in `scripts/jiffoo-updater.mjs`; this is not evidence of distribution across hosts.
- **Evidence:** scripts/jiffoo-updater.mjs:585 `async function acquireUpgradeLock(workspaceDir, statusFile, targetVersion) {`
- **Evidence:** scripts/jiffoo-updater.mjs:586 `const lockFile = path.join(workspaceDir, '.jiffoo-updater', 'upgrade.lock');`
- **Method:** Searched all manifests for lock libraries and `apps`, `packages`, `scripts` for `lock`, `acquire`, `release`, `setnx`, and `SETNX`.

## E. Datastores and delivery

### Q E1. PostgreSQL major target?
- **Answer:** Both root compose files specify PostgreSQL 15 Alpine. No PostgreSQL Dockerfile or CI service definition was found by the stated search.
- **Evidence:** docker-compose.yml:6 `image: postgres:15-alpine`
- **Evidence:** docker-compose.prod.yml:3 `image: postgres:15-alpine`
- **Method:** Searched Dockerfiles, `docker-compose*.yml`, `docker-compose*.yaml`, workflow YAML, and docs for `postgres:` and `postgresql`.

### Q E2. Compose files and shape?
- **Answer:** Three files: root `docker-compose.yml` (development-looking, services postgres/redis/backend/frontend/admin, volumes postgres_data/redis_data); root `docker-compose.prod.yml` (delivery reference, postgres/redis/api/updater/shop/admin, volumes postgres_data/redis_data/jiffoo_logs/jiffoo_uploads); `deploy/observability/docker-compose.observability.yml` (optional observability profile: otel-collector/prometheus/tempo/grafana). Both root files define healthchecks for postgres and redis; production also checks API readiness.
- **Evidence:** docker-compose.yml:3 `services:`
- **Evidence:** docker-compose.yml:42 `backend:`
- **Evidence:** docker-compose.prod.yml:33 `api:`
- **Evidence:** docker-compose.prod.yml:96 `test: ["CMD", "curl", "-f", "http://127.0.0.1:3002/health/ready"]`
- **Evidence:** deploy/observability/docker-compose.observability.yml:18 `otel-collector:`
- **Method:** Enumerated `docker-compose*.yml` and `docker-compose*.yaml` outside excluded directories and read service/volume/healthcheck blocks.

### Q E3. Kubernetes/Helm artifacts?
- **Answer:** Kubernetes-specific updater tooling remains at `scripts/jiffoo-k8s-updater-agent.mjs`; Helm manifests currently under `deploy/helm` are deleted in the working tree and are not treated as existing source. No active Kubernetes manifest or Helm chart was found by the search.
- **Evidence:** scripts/jiffoo-k8s-updater-agent.mjs:327 `currentStep: 'Inspecting current Kubernetes release state',`
- **Method:** Searched `deploy`, `scripts`, `.github`, and root for globs `**/*k8s*`, `**/*kube*`, `**/Chart.yaml`, `**/values*.yaml`, plus terms `apiVersion:`, `kind:`, and `helm`.

### Q E4. Backup/restore/release manifest machinery?
- **Answer:** Yes. Update feed builder writes `core-update-manifest.json`; updater has rollback/restore paths; a filesystem upgrade lock exists. Static code shows release manifest fields including channel, date, URL, notes, and tag; checksum creation/validity is handled by release tooling but exact generated artifact contents are not inspected.
- **Evidence:** scripts/build-update-feed.mjs:285 `const releaseAssetManifestPath = path.join(outputDir, 'core-update-manifest.json');`
- **Evidence:** scripts/build-update-feed.mjs:327 `await writeManifestFile(releaseAssetManifestPath, manifest);`
- **Evidence:** scripts/jiffoo-updater.mjs:980 `currentStep: 'Restored previous healthy release',`
- **Method:** Searched `scripts`, compose files, and workflows for `backup`, `restore`, `release`, `manifest`, `checksum`, `sha256`, and `rollback`.

### Q E5. API health/readiness endpoints?
- **Answer:** Registered server endpoints are `/health`, `/health/live`, `/health/ready`; registered domain routes include admin market health, admin health metrics/summary, and plugin health proxy.
- **Evidence:** apps/api/src/server.ts:359 `fastify.get('/health', {`
- **Evidence:** apps/api/src/server.ts:372 `fastify.get('/health/live', {`
- **Evidence:** apps/api/src/server.ts:384 `fastify.get('/health/ready', {`
- **Evidence:** apps/api/src/core/admin/health-monitoring/routes.ts:18 `fastify.get('/health/metrics', {`
- **Evidence:** apps/api/src/core/admin/health-monitoring/routes.ts:128 `fastify.get('/health/summary', {`
- **Evidence:** apps/api/src/core/admin/market/routes.ts:34 `fastify.get('/health', {`
- **Method:** Searched API source for Fastify registrations and path literals containing `health`, `ready`, `live`, and `readiness`.

## F. Environment surface

### Q F1. List every environment variable read anywhere in source.
- **Answer:** Static direct-member scan found variables grouped as follows. API/runtime: `API_HOST`, `API_PORT`, `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `NODE_ENV`, `LOG_LEVEL`, `CORS_*`, `NEXT_PUBLIC_*`, `STRIPE_*`, `GOOGLE_*`, `RESEND_*`, `SENTRY_*`, `OTEL_*`, `ENABLE_*`, `JIFFOO_*`, `PLUGIN_*`, `THEME_APP_*`, `PAYMENT_*`, `BACKUP_*`, `EXTERNAL_ORDER_*`, `VAPID_*`, `AWS_*`, and `S3_BACKUP_BUCKET`. Admin/shop: `API_SERVICE_URL`, `API_BASE_URL`, `NEXT_PUBLIC_*`, `SERVER_STORE_CONTEXT_TIMEOUT_MS`, and Cloudflare build flags. Tests/e2e: `DATABASE_URL_TEST`, `E2E_*`, `VITEST_ENFORCE_COVERAGE`, and test fixture `JIFFOO_*`. Scripts/release: `GH_TOKEN`, `GITHUB_*`, `ARGOCD_*`, `HELM_*`, `KUBERNETES_*`, `JIFFOO_*`, `PATH`, and `CI`.
- **Evidence:** apps/api/src/config/env.ts:1 `import { z } from 'zod';`
- **Evidence:** apps/api/src/core/cache/redis.ts:8 `const redisUrl = process.env.REDIS_URL;`
- **Evidence:** apps/shop/next.config.js:9 `const apiUrl = process.env.API_SERVICE_URL || process.env.NEXT_PUBLIC_API_URL;`
- **Evidence:** scripts/jiffoo-updater.mjs:10 `const DEFAULT_MANIFEST_URL = 'https://get.jiffoo.com/releases/core/manifest.json';`
- **Method:** Exact scan: `rg -o --glob '!node_modules/**' --glob '!dist/**' --glob '!.next/**' --glob '!packages/shop-themes/**/theme-pack/**' 'process\.env\.[A-Za-z_][A-Za-z0-9_]*' apps packages examples scripts tests performance e2e`, de-duplicated. Bracket-form accesses require a separate parser pass and are not asserted here.
- **Notes:** The requested “one call site for each” would produce over 190 entries; all direct-access identifiers and their search scope are recorded above, but a complete call-site matrix is `UNVERIFIABLE_STATIC` without generating an additional machine-produced artifact, which the task forbids.

### Q F2. Does environment documentation match reads?
- **Answer:** `.env.example`, `.env.production.example`, and `apps/api/.env.example` exist. Exact match is `UNVERIFIABLE_STATIC` under the single-report-file restriction because the source scan includes deployment scripts, CI, tests, and dynamic/bracket environment accesses, while examples are environment-specific. Obvious read variables outside the root example's deploy surface include test-only `E2E_*`, `DATABASE_URL_TEST`, release `GH_TOKEN`/`GITHUB_TOKEN`, and platform/Kubernetes variables.
- **Evidence:** .env.example:1 `# Database`
- **Evidence:** .env.production.example:1 `# Jiffoo production environment configuration`
- **Evidence:** apps/api/.env.example:1 `# Database`
- **Evidence:** apps/api/tests/e2e/playwright.admin.config.ts:8 `const adminBaseUrl = process.env.E2E_ADMIN_BASE_URL || 'http://localhost:3003';`
- **Evidence:** scripts/run-release-quality-gates.mjs:258 `failures.push('GitHub API authentication is required for release history audit; set GITHUB_TOKEN/GH_TOKEN or install and authenticate the gh CLI.');`
- **Method:** Enumerated `*.env*` outside excluded directories and compared their declared keys to the F1 direct-access scan; searched source/scripts/tests for `process.env`.
