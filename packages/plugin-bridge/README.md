# @jiffoo/plugin-bridge

The browser-side client of the Core plugin page shell, version 1.0.0-alpha.1.
It runs in the storefront's browser; the build and the verification run on
Node.js >=24.13.1 <25, matching Core's Node 24 CI runtime.

Install the bridge tarball attached to the matching Core release:

```sh
npm i ./jiffoo-plugin-bridge-1.0.0-alpha.1.tgz
```

```typescript
import { createPluginBridge } from '@jiffoo/plugin-bridge';
```

One client per iframe document. `createPluginBridge()` reads the shell origin
from the frame URL that Core generated, completes the `bridge.hello` and
`bridge.welcome` handshake with the shell, and exposes `ready`, `request`,
`context()`, `subscribe()`, `token()`, `refreshToken()` and `close()`. No Core
credential ever enters the frame: the shell sends a short-lived scoped token
and the frame asks the shell for a fresh one.

The package ships the compiled bridge and its type declarations. It has no
dependencies, no Core application runtime imports and no workspace references.

From the repository, `pnpm --filter @jiffoo/plugin-bridge build` builds the
package and `pnpm --filter @jiffoo/plugin-bridge test:standalone` runs the
database-free clean-install script. Its audited node:test wrapper is selected
through `pnpm verify:quick --test-files="scripts/plugin-bridge-standalone.test.mjs"`.
The script builds the tree, packs it, installs the tarball in an external
temporary directory, asserts that the installed `dist` bytes are the tree's
build and prints the tarball's SHA256. It starts no service and touches no
database.

Each Core release distributes the bridge as a release artifact next to the SDK
tarball. Pre-releases use 1.0.0-alpha.N. npm publishing is deferred until the
owner provides an npm organisation.

A consumer that vendors the tarball records the Core commit it came from and
the tarball's SHA256 beside the file, so that the bytes stay traceable to a
tree.
