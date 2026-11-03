# @jiffoo/plugin-bridge

The browser-side client of the Core plugin page shell, version 1.0.0-alpha.3.
It runs in the storefront's browser; the build and the verification run on
Node.js >=24.13.1 <25, matching Core's Node 24 CI runtime.

Install the bridge tarball attached to the matching Core release:

```sh
npm i ./jiffoo-plugin-bridge-1.0.0-alpha.3.tgz
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

A page token lives two minutes. `token()` returns the token the frame holds
and refreshes it from the shell when it is about to expire, so a plugin that
asks for a token on every request spends one refresh of the budget of the
session instead of one per request. `refreshToken()` asks for a new token
without that check: use it when the frame knows that the token it holds is
gone. The budget of a session is thirty refreshes a minute; a refresh beyond
it is answered with `RATE_LIMITED`, which does not end the page — the shell
answers with the token it still holds and the plugin keeps working. A refresh
that Core refused does not become a refresh per request either: the bridge
waits half a minute and keeps the token it holds while that token is valid.

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
