# Native plugin modules

A **native plugin module** is a plugin's own implementation compiled into a Cloudflare Native
core worker. The open-source repository is the framework and compiles **none**: a build that
wants modules in lists them in two small registry files before bundling. The core refers to the
modules in five places and nowhere else.

This page is for whoever prepares such a build.

## What a module is

`apps/cloudflare-native-core-api/src/native-plugin-modules/runtime.ts` defines the interface:

```ts
interface NativePluginModule {
  id: string;                        // the plugin's slug
  tryRoute?(request, env, waitUntil): Promise<Response | null>;
  onStoreEvent?(env, event): Promise<unknown>;
  runScheduledWork?(env): Promise<unknown>;
}
```

- `tryRoute` answers the module's own HTTP routes and returns `null` for anything else. It is asked
  only after every route the core handles itself has declined, so a module can never stand in for
  a core route. A module that throws surfaces like any other handler.
- `onStoreEvent` is told about every event the core's outbox delivers (an order created,
  cancelled or refunded, a payment that succeeded). A module that talks to the outside world
  **queues the work in this call and sends it from `runScheduledWork`**, so the store's own
  processing never waits on it. A module that fails is logged; the event is still delivered.
- `runScheduledWork` is the module's share of the core's scheduled run. Each module's outcome is
  reported on its own, so one failure stops nothing else.

`env` carries the instance's database (`DB`). A module that needs another binding says so in its
own types.

## Listing modules in a build

`apps/cloudflare-native-core-api/src/native-plugin-modules/registry.ts` is:

```ts
export const NATIVE_PLUGIN_MODULES: readonly NativePluginModule[] = [];
```

A build that compiles modules in rewrites it to list them as **static imports**, so the bundler
can see them:

```ts
import { teamExample } from '../../native-modules/team-example';
export const NATIVE_PLUGIN_MODULES: readonly NativePluginModule[] = [teamExample];
```

Keep the list in the build step only; do not commit a non-empty list to this repository.

### Admin pages

`apps/admin/lib/native-plugin-pages/registry.ts` works the same way for the page a plugin shows
in the admin: `NATIVE_PLUGIN_PAGES` maps a slug to a page component, and `PluginWorkspace`
renders it for that slug. The open-source build maps nothing.

## What a deployed worker reports

`GET /health` carries `pluginModules`: the slugs of the modules compiled into the worker.

```json
{ "status": "ok", "version": "…", "d1Schema": "…", "pluginModules": ["team-example"] }
```

A build step that lists modules reads this after deploying: a module missing from the list was
not compiled in, and a plugin the instance has enabled would silently do nothing.

## Installing

The admin's install route (`POST /api/v1/admin/market/extensions/<slug>/install`) accepts a
plugin when it is compiled into the worker as a module, exactly as for the plugins the core lists
by hand. That only says the plugin *has* an implementation here. Whether the instance may have it
is still decided per request by the platform from its own catalog: a non-free item goes on to the
platform's authorized package route and is refused with `MEMBERSHIP_REQUIRED` when the instance
cannot show an entitlement.

## Storage

The core's migrations live in this repository, so a module cannot add tables to them. A module
creates its own tables when it first needs them (`CREATE TABLE IF NOT EXISTS`), under a prefix
that names its plugin.
