# @jiffoo-core/plugin-sdk

Extension authoring CLI and canonical Core types, version 1.0.0-alpha.1.
Supported runtime: Node.js >=24.13.1 <25, matching Core's Node 24 CI runtime.

Install the SDK tarball attached to the matching Core release:

```sh
npm i ./jiffoo-core-plugin-sdk-1.0.0-alpha.1.tgz
npx jiffoo-plugin create --slug my-extension --name "My extension" --output my-extension
```

Install the generated project's dependencies and run its build script before
packing `dist/package` with `jiffoo-plugin pack --input ... --output plugin.zip`.
`jiffoo-plugin migrations --input my-extension` validates local migration bytes
and prints their declaration; it never connects to a database.

```typescript
import type { PluginContext } from '@jiffoo-core/plugin-sdk';
```

The root export supplies the generated canonical authoring declarations,
including page, task and service manifest declarations. Runtime capabilities
come from Core. `@jiffoo-core/plugin-sdk/cli` resolves the installed CLI.
The package ships tsc-compiled signing, migration, manifest/config/event and
UI-asset validators internally; it has no Core application runtime imports or
workspace dependencies. Archiver and zod remain ordinary npm dependencies.

From the repository, `pnpm --filter @jiffoo-core/plugin-sdk build` builds the
package. `pnpm --filter @jiffoo-core/plugin-sdk test:standalone` runs the
database-free clean-install smoke script. Its audited node:test wrapper is
selected through `pnpm verify:quick --test-files="scripts/plugin-sdk-standalone.test.mjs"`.
It installs the tarball and scaffold build tools in an external temporary
directory and removes that directory afterward. It does not start services.

Each Core release distributes a self-contained SDK tarball as a release asset.
Pre-releases use 1.0.0-alpha.N. npm publishing is deferred until the owner
provides an npm organisation; public publish access will be configured then.
