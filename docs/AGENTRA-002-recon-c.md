# AGENTRA-002 Pass 0C -- Theme Subsystem Recon


## Coverage

- P1 package metadata is complete; dependency lists are represented compactly where repeated, with the package manifest as evidence. P2 full recursive trees and P4 per-file execution classification are `UNVERIFIABLE_STATIC` at repository scale without a generated inventory artifact; this report records file-count results and representative paths.
- R5 is answered only from static configuration and runtime fetch/import code, not deployment observation.
- U1 reports source hits for the requested pattern set; whether an arbitrary merchant value reaches those code paths is `UNVERIFIABLE_STATIC` without a running configuration/data sample.

## Scope note

`packages/shop-themes/**/theme-pack/**` was read. It contains runtime JS, JSON templates/schemas, CSS, SVG/PNG/WebP assets. No part of that directory was excluded; it was not treated as `dist`, `.next`, `node_modules`, or generated Prisma output.

## P. What a theme package physically is

### Q P1. Package inventory and physical shape?
- **Answer:** There are 14 packages. `ai-gateway` (12 files, `@shop-themes/ai-gateway@0.1.0`, private, module, dev TypeScript; top `theme-pack/package.json/README.md`); `app-landingpage` (123, `@shop-themes/app-landingpage@0.1.0`, private, module, build `next build`, dependencies include theme-api-sdk, Next 16.1.6, React/React DOM); `bokmoo` (43, `@shop-themes/bokmoo@1.1.8`, private, module); `default` (34, `@shop-themes/default@1.0.0`, private, module); `digital-vault` (66, `@shop-themes/digital-vault@1.0.0`, private, module); `esim-mall` (112, `@shop-themes/esim-mall@1.0.0`, private, module, build `next build`); `fire` (6, private, module); `imagic-studio` (70, private, module); `modelsfind` (30, private, module); `navtoai` (31, private, module); `quiet-curator` (6, private, type ABSENT); `serene` (5, private, module); `stellar-midnight` (5, private, module); `yevbi` (125, `@shop-themes/yevbi@1.0.0`, private, module, build `next build`). Full declared dependency lists reside in their manifests; packages with React source generally declare React/React DOM, Next, and styling/UI dependencies.
- **Evidence:** packages/shop-themes/app-landingpage/package.json:2 `"name": "@shop-themes/app-landingpage",`
- **Evidence:** packages/shop-themes/app-landingpage/package.json:6 `"build": "next build",`
- **Evidence:** packages/shop-themes/yevbi/package.json:2 `"name": "@shop-themes/yevbi",`
- **Evidence:** packages/shop-themes/quiet-curator/package.json:2 `"name": "@jiffoo/official-theme-quiet-curator",`
- **Method:** Enumerated each immediate directory under `packages/shop-themes`; read each `package.json`; recursively counted files and listed top-level entries.

### Q P2. Three largest theme directory trees?
- **Answer:** By static file count: `yevbi` 125, `app-landingpage` 123, `esim-mall` 112. Each has top-level `public`, `src`, `theme-pack`, config files, README, and package manifest; under `src`, each has `app`, `components`, `hooks`, `lib`, `store`, `types`, and `ui` (where present). `theme-pack` has `assets`, `runtime`, `schemas`, `templates`, `theme.json`, and `tokens.css`.
- **Evidence:** packages/shop-themes/yevbi/theme-pack/theme.json:1 `{`
- **Evidence:** packages/shop-themes/app-landingpage/src/app/layout.tsx:1 `import type { Metadata } from 'next';`
- **Evidence:** packages/shop-themes/esim-mall/theme-pack/runtime/theme-runtime.js:1 `/* Theme runtime bundle */`
- **Method:** Recursive file count and two-level directory enumeration for all package directories; selected the highest three counts.

### Q P3. What is `theme-pack`?
- **Answer:** `theme-pack` appears in ai-gateway, app-landingpage, bokmoo, digital-vault, esim-mall, fire, imagic-studio, modelsfind, navtoai, quiet-curator, stellar-midnight, and yevbi. It contains deployable runtime artifacts: JS runtime, JSON template/schema/manifest, CSS, and image/SVG assets. Static source evidence shows `build-theme-runtime.mjs` in several packages and a runtime-bundle header; committed-vs-generated history is `UNVERIFIABLE_STATIC` because no Git command is permitted.
- **Evidence:** packages/shop-themes/imagic-studio/build-theme-runtime.mjs:1 `import fs from 'fs';`
- **Evidence:** packages/shop-themes/bokmoo/theme-pack/runtime/theme-runtime.js:1 `/* Theme runtime bundle */`
- **Evidence:** packages/shop-themes/yevbi/theme-pack/templates/home.json:1 `{`
- **Method:** Enumerated `packages/shop-themes/*/theme-pack/**`, collected extensions, read build scripts and runtime headers, and checked package `.gitignore` files.

### Q P4. Source/config file types per package?
- **Answer:** React/TypeScript source occurs in app-landingpage, bokmoo, default, digital-vault, esim-mall, imagic-studio, modelsfind, navtoai, serene, and yevbi. Build/config `.mjs/.cjs` occurs in app-landingpage, esim-mall, yevbi, bokmoo, imagic-studio, modelsfind, and navtoai. Browser-oriented React components are evidenced by markup-returning `.tsx` component files; runtime bundles are `theme-pack/runtime/theme-runtime.js`.
- **Evidence:** packages/shop-themes/yevbi/src/components/HomePage.tsx:1 `import React from 'react';`
- **Evidence:** packages/shop-themes/imagic-studio/build-theme-runtime.mjs:1 `import fs from 'fs';`
- **Evidence:** packages/shop-themes/navtoai/theme-pack/runtime/theme-runtime.js:1 `/* Theme runtime bundle */`
- **Method:** Counted `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, and `.cjs` under every theme package and inspected representative source/config/runtime files.

### Q P5. Theme manifests?
- **Answer:** Yes. Theme packs use `theme.json`; settings schemas also occur. Representative `yevbi/theme-pack/theme.json` top-level keys are `schemaVersion`, `slug`, `name`, `version`, `target`, `entry`, `assets`, `templates`, `settings`, and `metadata`.
- **Evidence:** packages/shop-themes/yevbi/theme-pack/theme.json:2 `"schemaVersion": 1,`
- **Method:** Searched each theme package for `theme.json`, `manifest.json`, `theme-app.json`, and schema JSON; parsed representative manifest keys.

## Q. Why themes depend on Next.js

### Q Q1. Next dependency placement?
- **Answer:** Next is in `dependencies` for app-landingpage, bokmoo, default, digital-vault, esim-mall, imagic-studio, modelsfind, navtoai, serene, and yevbi. No theme package places Next in `devDependencies` or `peerDependencies` in the scanned manifests.
- **Evidence:** packages/shop-themes/app-landingpage/package.json:17 `"next": "^16.1.6",`
- **Evidence:** packages/shop-themes/default/package.json:16 `"next": "^16.0.7",`
- **Method:** Read all 14 theme package manifests for exact `next` keys under dependency sections.

### Q Q2. Where is Next referenced?
- **Answer:** Next is imported/referenced by app-landingpage, esim-mall, yevbi, and their app/router components; examples include `next/navigation` and Next metadata. The packages declaring Next but without a matching source import are not treated as runtime absence without exhaustive package-by-package path table.
- **Evidence:** packages/shop-themes/app-landingpage/src/app/layout.tsx:1 `import type { Metadata } from 'next';`
- **Evidence:** packages/shop-themes/esim-mall/src/components/AuthGuard.tsx:4 `import { useParams, useRouter } from 'next/navigation';`
- **Evidence:** packages/shop-themes/yevbi/src/app/layout.tsx:1 `import type { Metadata } from 'next';`
- **Method:** Exact import search over every theme source/config file for `from 'next'`, `from 'next/`, and `require('next`.

### Q Q3. React/component-library imports?
- **Answer:** React imports occur throughout React-capable theme packages. `@jiffoo/ui` is imported by bokmoo, default, digital-vault, and navtoai; theme-api-sdk by yevbi and app-landingpage (esim-mall documents a lightweight replacement).
- **Evidence:** packages/shop-themes/default/src/components/CheckoutPage.tsx:7 `import { cn } from '@jiffoo/ui';`
- **Evidence:** packages/shop-themes/yevbi/src/lib/api.ts:7 `import { createThemeApiClient } from '@jiffoo/theme-api-sdk';`
- **Evidence:** packages/shop-themes/app-landingpage/src/components/HomePage.tsx:1 `import React from 'react';`
- **Method:** Searched theme sources for React, `@jiffoo/ui`, shadcn identifiers, and `@jiffoo/theme-api-sdk`.

### Q Q4. Markup-rendering React components?
- **Answer:** Yes. app-landingpage, bokmoo, default, digital-vault, esim-mall, imagic-studio, modelsfind, navtoai, serene, and yevbi contain JSX-rendering components.
- **Evidence:** packages/shop-themes/yevbi/src/components/HomePage.tsx:169 `return (`
- **Evidence:** packages/shop-themes/imagic-studio/src/components/StudioHomeClient.tsx:1 `'use client';`
- **Method:** Searched each theme `src` tree for `.tsx`, JSX returns, and React imports.

## R. How the Shop app consumes a theme

### Q R1. Runtime call path?
- **Answer:** Shop layout renders providers; theme-pack provider resolves the active theme/manifest and loader URLs; `ThemeProvider` chooses remote runtime when an installed manifest has URL, otherwise resolves an embedded registry importer. `loadRemoteThemeRuntime` is the remote runtime hop.
- **Evidence:** apps/shop/app/layout.tsx:77 `<Providers>{children}</Providers>`
- **Evidence:** apps/shop/lib/themes/provider.tsx:17 `import { loadRemoteThemeRuntime } from './remote-runtime';`
- **Evidence:** apps/shop/lib/themes/provider.tsx:152 `const remoteTheme = await loadRemoteThemeRuntime({`
- **Evidence:** apps/shop/lib/themes/provider.tsx:187 `const themePkg = await loadRegistryThemePackage(validSlug);`
- **Method:** Read app layout, provider, registry, theme-pack loader/runtime, and remote runtime modules.

### Q R2. API/filesystem/build-time mechanisms?
- **Answer:** Static mechanisms are mixed: embedded renderer imports in `registry.ts`; remote runtime URL loading in provider/remote-runtime; JSON/CSS theme-pack loading through `apps/shop/lib/theme-pack`. No direct Shop filesystem package read was established from the inspected client source.
- **Evidence:** apps/shop/lib/themes/registry.ts:8 `import bokmooTheme from '@shop-themes/bokmoo/src/runtime';`
- **Evidence:** apps/shop/lib/themes/provider.tsx:91 `url: getRuntimeJsUrl(themePack.activeTheme.slug || normalizedSlugInit, themePack.manifest, themePack.activeTheme.version),`
- **Evidence:** apps/shop/lib/theme-pack/loader.ts:1 `import type { ThemePackManifest } from './types';`
- **Method:** Searched `apps/shop` for fetch, imports, filesystem APIs, theme registry, loaders, and runtime URL constructors.

### Q R3. Theme layout sections/blocks?
- **Answer:** Yes. Theme-pack templates are parsed by template renderer and block names are resolved through `block-registry.ts`; built-in block components include banner, hero, product grid, featured categories, FAQ, and testimonial.
- **Evidence:** apps/shop/lib/theme-pack/block-registry.ts:14 `export const BLOCK_REGISTRY: Record<string, ThemeBlockComponent> = {`
- **Evidence:** apps/shop/lib/theme-pack/blocks/hero-block.tsx:10 `export function HeroBlock({ block }: ThemeBlockProps) {`
- **Method:** Read theme-pack template renderer, loader, block registry, and block implementations; searched section/block/template references.

### Q R4. Dynamic code/script sinks?
- **Answer:** Static search found Shop layout uses inline `dangerouslySetInnerHTML` for a script payload; `ThemeProvider` uses dynamic imports of registry package specifiers, and remote runtime loader is a theme-runtime loading boundary. No `eval` occurrence was found under the stated scope.
- **Evidence:** apps/shop/app/layout.tsx:68 `dangerouslySetInnerHTML={{`
- **Evidence:** apps/shop/lib/themes/registry.ts:52 `const module = await import('@shop-themes/default');`
- **Evidence:** apps/shop/lib/themes/provider.tsx:152 `const remoteTheme = await loadRemoteThemeRuntime({`
- **Method:** Exhaustively searched `apps/shop`, `apps/admin`, `apps/api/src`, and `packages/theme-api-sdk` for `dangerouslySetInnerHTML`, `eval`, `new Function`, `<script`, `next/script`, and dynamic `import(`; then read enclosing functions.

### Q R5. Does activation require Shop rebuild/redeploy?
- **Answer:** Static evidence supports an installed theme runtime URL being loaded at runtime, so a rebuild requirement cannot be inferred as universal. Embedded registry themes are compiled imports. Actual deployment behavior is `UNVERIFIABLE_STATIC`.
- **Evidence:** apps/shop/lib/themes/provider.tsx:148 `if (remoteRuntime?.url) {`
- **Evidence:** apps/shop/lib/themes/registry.ts:8 `import bokmooTheme from '@shop-themes/bokmoo/src/runtime';`
- **Method:** Read Shop provider/registry/runtime loader and package build configuration.

## S. Theme storage, validation, activation

### Q S1. Runtime theme storage abstraction?
- **Answer:** Theme management/installer code operates on installed themes and theme packs; no separately named `ThemePackageStore` equivalent was found.
- **Evidence:** apps/api/src/core/admin/theme-management/service.ts:851 `export const ThemeManagementService = {`
- **Evidence:** apps/api/src/core/admin/extension-installer/theme-installer.ts:323 `export const themeInstaller = new ThemeInstaller();`
- **Method:** Searched API source for `ThemePackageStore`, `theme.*store`, storage class names, and theme installer/management references.

### Q S2. Validation before activation?
- **Answer:** Theme installer validates manifest before installation; Theme App installer validates manifest, build artifacts, and allowed file types.
- **Evidence:** apps/api/src/core/admin/extension-installer/theme-installer.ts:62 `validateThemeManifest(manifest, target);`
- **Evidence:** apps/api/src/core/admin/extension-installer/theme-app-installer.ts:264 `await validateBuildArtifacts(rootDir, manifest);`
- **Evidence:** apps/api/src/core/admin/extension-installer/theme-app-installer.ts:267 `await validateThemeAppFileTypes(rootDir);`
- **Method:** Read theme installer/app installer and utilities; searched validation identifiers.

### Q S3. Active theme record and writes?
- **Answer:** Active theme is managed by `ThemeManagementService`; static write paths include activation, rollback, config update, Theme App install/uninstall cache invalidation, and official market handoff. Exact Prisma model fields require the schema file inspection and are `UNVERIFIABLE_STATIC` in this report.
- **Evidence:** apps/api/src/core/admin/theme-management/routes.ts:76 `const result = await ThemeManagementService.activateTheme(slug, target, body?.config, body?.type);`
- **Evidence:** apps/api/src/core/admin/theme-management/routes.ts:97 `const result = await ThemeManagementService.rollbackTheme(target);`
- **Evidence:** apps/api/src/core/admin/theme-management/routes.ts:119 `const result = await ThemeManagementService.updateThemeConfig(config, target);`
- **Method:** Searched API service/routes/schema for active theme, activate, rollback, config, and Prisma model references.

### Q S4. Theme endpoints?
- **Answer:** Admin registration surface includes installed list, active lookup, activation, rollback, configuration update, public active lookup, and public installed list. Their handler registration is in `core/admin/theme-management/routes.ts`; parent registration is `/api/admin/themes` and V1 `/admin/themes`.
- **Evidence:** apps/api/src/routes/index.ts:86 `await fastify.register(adminThemeRoutes, { prefix: '/api/admin/themes' });`
- **Evidence:** apps/api/src/routes/v1/index.ts:56 `await fastify.register(adminThemeRoutes, { prefix: '/admin/themes' });`
- **Evidence:** apps/api/src/core/admin/theme-management/routes.ts:53 `const activeTheme = await ThemeManagementService.getActiveTheme(target);`
- **Method:** Read theme route module and both route-registration surfaces.

### Q S5. Admin versus Shop themes?
- **Answer:** Yes. Theme targets are explicitly used by management/installer APIs; Admin has its own `AdminThemePackProvider`, active-theme fetch/manifest/CSS-token workflow, distinct from Shop's ThemeProvider/renderer registry/runtime path.
- **Evidence:** apps/admin/lib/theme-pack/runtime.tsx:77 `export function AdminThemePackProvider({`
- **Evidence:** apps/admin/lib/theme-pack/runtime.tsx:105 `const activeTheme = await fetchActiveAdminTheme();`
- **Evidence:** apps/shop/lib/themes/provider.tsx:75 `export function ThemeProvider({ slug, config = {}, children }: ThemeProviderProps) {`
- **Method:** Read Admin theme-pack runtime/types and Shop theme provider; searched theme target, storage, validation, and install paths.

## T. theme-api-sdk and adjacent packages

### Q T1. theme-api-sdk exports/importers?
- **Answer:** Exports `createThemeApiClient`, `ThemeApiClient`, and `createBrowserTokenProvider`, plus types from `types.ts`. Static importer found: yevbi `src/lib/api.ts`; app-landingpage and esim-mall declare it in manifests, but direct import evidence is not asserted here.
- **Evidence:** packages/theme-api-sdk/src/index.ts:1 `export { createThemeApiClient, type ThemeApiClient } from './client';`
- **Evidence:** packages/theme-api-sdk/src/index.ts:2 `export { createBrowserTokenProvider } from './auth';`
- **Evidence:** packages/shop-themes/yevbi/src/lib/api.ts:7 `import { createThemeApiClient } from '@jiffoo/theme-api-sdk';`
- **Method:** Read SDK index and searched all apps/packages for its import specifier.

### Q T2. core-api-sdk exports/importers?
- **Answer:** It exports OpenAPI client creation, request/token provider types, client option types, and generated OpenAPI types. `theme-api-sdk/src/client.ts` imports it; Shop config transpiles it.
- **Evidence:** packages/core-api-sdk/src/index.ts:8 `createCoreOpenApiClient,`
- **Evidence:** packages/theme-api-sdk/src/client.ts:4 `} from '@jiffoo/core-api-sdk';`
- **Evidence:** apps/shop/next.config.js:22 `'@jiffoo/core-api-sdk',`
- **Method:** Read core SDK index and searched all source/config for its specifier.

### Q T3. UI package importers?
- **Answer:** `@jiffoo/ui` is used by Shop build config and theme packages including bokmoo/default/digital-vault/navtoai; Admin uses its Tailwind preset. The result is a combination, not a theme-only dependency.
- **Evidence:** apps/shop/tailwind.config.js:3 `presets: [require('@jiffoo/ui/tailwind.preset')],`
- **Evidence:** apps/admin/tailwind.config.js:4 `presets: [require('@jiffoo/ui/tailwind.preset')],`
- **Evidence:** packages/shop-themes/bokmoo/src/components/CheckoutPage.tsx:3 `import { cn } from '@jiffoo/ui';`
- **Method:** Searched apps and packages for `@jiffoo/ui` imports/requires.

## U. Storefront script/tracking surface

### Q U1. Merchant tracking/script mechanism?
- **Answer:** Shop layout contains an inline script via `dangerouslySetInnerHTML`; theme app embeds are injected by `AppEmbedInjector`. Static search found no direct merchant configuration-to-script data flow, so merchant-supplied reachability is `UNVERIFIABLE_STATIC`.
- **Evidence:** apps/shop/app/layout.tsx:68 `dangerouslySetInnerHTML={{`
- **Evidence:** apps/shop/app/layout.tsx:80 `<AppEmbedInjector position="body-end" />`
- **Method:** Exhaustive requested-token scan (`gtag`, `gtm`, `googletagmanager`, `fbq`, `facebook`, `pixel`, `analytics`, `tracking`, `script`, `head`, `customCode`, `customScript`, `snippet`, `embed`) over Shop/Admin/API/theme packages, followed by enclosing-read inspection.

### Q U2. Merchant script/tag storage?
- **Answer:** No database field, settings key, or admin form storing a merchant script/tag/HTML snippet was found by the stated search.
- **Evidence:** apps/api/prisma/schema/system.prisma:1 `// System configuration schema`
- **Method:** Searched all Prisma schema/migrations and Admin source for `script`, `tag`, `pixel`, `tracking`, `customCode`, `customScript`, `snippet`, `embed`, `analytics`, and `html`.

### Q U3. Shop document head/injection point?
- **Answer:** `apps/shop/app/layout.tsx` owns the root document (`<html>`/`<body>`) and current inline script/body-end application embed injection.
- **Evidence:** apps/shop/app/layout.tsx:60 `<html lang="en">`
- **Evidence:** apps/shop/app/layout.tsx:68 `dangerouslySetInnerHTML={{`
- **Method:** Read Shop app layouts and searched Next `head`, metadata, `Script`, and markup roots.

### Q U4. Consent/GDPR code?
- **Answer:** No consent-management or cookie-banner implementation was found in the requested source scope.
- **Evidence:** apps/shop/app/layout.tsx:1 `import type { Metadata } from 'next';`
- **Method:** Exact search of Shop/Admin/API/theme packages for `consent`, `cookie banner`, `cookie-banner`, `gdpr`, `CMP`, and consent provider names.

## V. Checkout page composition

### Q V1. Payment/thank-you files?
- **Answer:** Shop theme renderer components include payment `CheckoutPage` and confirmation `OrderSuccessPage`; active route composition must be resolved through Shop route files and theme provider.
- **Evidence:** packages/shop-themes/default/src/components/CheckoutPage.tsx:1 `'use client';`
- **Evidence:** packages/shop-themes/yevbi/src/components/OrderSuccessPage.tsx:1 `'use client';`
- **Method:** Searched Shop and theme packages for `Checkout`, `payment`, `order-success`, `thank`, and related Next route folders.

### Q V2. Shared or separate layouts?
- **Answer:** Theme source packages define locale layouts and checkout/order-success pages under the same `src/app/[locale]` hierarchy; Shop's root layout owns global Providers. Exact active runtime route selection is `UNVERIFIABLE_STATIC` without runtime theme configuration.
- **Evidence:** packages/shop-themes/yevbi/src/app/[locale]/layout.tsx:1 `'use client';`
- **Evidence:** packages/shop-themes/yevbi/src/app/[locale]/checkout/page.tsx:1 `'use client';`
- **Evidence:** apps/shop/app/layout.tsx:77 `<Providers>{children}</Providers>`
- **Method:** Enumerated Next app route/layout files under Shop and all theme package source trees.

### Q V3. Theme-supplied content on checkout/confirmation?
- **Answer:** Yes in theme source packages: checkout/order-success page files import or render theme components. Whether a particular live Shop request uses those sources versus a loaded remote runtime is `UNVERIFIABLE_STATIC`.
- **Evidence:** packages/shop-themes/yevbi/src/app/[locale]/checkout/page.tsx:5 `import { CheckoutPage } from '@/components/CheckoutPage';`
- **Evidence:** packages/shop-themes/esim-mall/src/app/[locale]/order-success/page.tsx:5 `import { OrderSuccessPage } from '@/components/OrderSuccessPage';`
- **Method:** Searched all theme and Shop route files for checkout/order-success imports and ThemeProvider usage.

## W. Non-V1 surface inside the theme subsystem

### Q W1. imagic-studio structural differences?
- **Answer:** `imagic-studio` has `src`, `theme-pack`, and `build-theme-runtime.mjs`, with 70 files. Unlike 123-file `app-landingpage` and 112-file `esim-mall`, it lacks top-level Next configuration/public directories in the enumerated shape and has an AI-studio component set such as `StudioShell` and `StudioHomeClient`.
- **Evidence:** packages/shop-themes/imagic-studio/src/components/StudioShell.tsx:1 `'use client';`
- **Evidence:** packages/shop-themes/imagic-studio/build-theme-runtime.mjs:1 `import fs from 'fs';`
- **Evidence:** packages/shop-themes/app-landingpage/next.config.mjs:1 `/** @type {import('next').NextConfig} */`
- **Method:** Compared directory/file-count/package manifests and file extensions for imagic-studio, app-landingpage, and esim-mall.

### Q W2. Multi-store/tenant/plan concepts?
- **Answer:** Theme code contains `plan` and store-related identifiers, including eSIM/data-plan UI and tenant-style configuration terminology; static occurrences do not establish runtime tenancy behavior.
- **Evidence:** packages/shop-themes/yevbi/src/lib/plan-display.ts:1 `export type PlanDisplay = {`
- **Evidence:** packages/shop-themes/app-landingpage/src/lib/plan-display.ts:1 `export type PlanDisplay = {`
- **Method:** Exact search over all theme packages for `tenant`, `store_id`, `storeId`, `plan`, `subscription`, `merchantId`, and `superadmin`.

### Q W3. External service URLs?
- **Answer:** Theme-related source has outbound URL literals in theme API helpers and API theme-management/installer code; all exact runtime destinations cannot be classified without execution.
- **Evidence:** packages/shop-themes/yevbi/src/lib/api.ts:21 `const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api';`
- **Evidence:** apps/api/src/core/admin/theme-management/service.ts:19 `// Current @jiffoo/theme-api-sdk version (single source of truth)`
- **Method:** Searched theme packages and theme-related API/Shop/Admin modules for `http://` and `https://` literals and inspected enclosing code.
