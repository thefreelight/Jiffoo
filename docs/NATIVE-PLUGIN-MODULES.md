# Native plugin modules

A **native plugin module** is a plugin's own implementation compiled into a Cloudflare Native
core worker. The open-source repository is the framework and compiles **none**: a build that
wants modules in lists them in two small registry files before bundling. The core refers to the
modules only in the places listed below.

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

Put the page's own files under `apps/admin/components/` (for example
`components/plugins/native-pages/<slug>/`). The admin's Tailwind reads class names from `app/`,
`components/` and `lib/` only: a page anywhere else compiles, looks right in a development server
for as long as its classes happen to be used elsewhere in the admin, and reaches a build without
the classes only it uses. After listing a page, check the compiled CSS for one of its classes.

## What a deployed worker reports

`GET /health` carries `pluginModules`: the slugs of the modules compiled into the worker.

```json
{ "status": "ok", "version": "…", "d1Schema": "…", "pluginModules": ["team-example"] }
```

A build step that lists modules reads this after deploying: a module missing from the list was
not compiled in, and a plugin the instance has enabled would silently do nothing.

## A module that takes payments

A plugin whose checkout runs on a page of the plugin's own (a payment gateway's cashier) adds three
optional members. The core keeps everything around that page the same for every such module — the
session, the return to the store, settling the order once, the refund bookkeeping — so the module
only describes its own protocol.

```ts
interface NativePluginModule {
  // …tryRoute, onStoreEvent, runScheduledWork as above
  settings?: {                                   // the plugin's form in the Admin
    name: string; version: string; description: string; category?: string;
    fields: Array<{ key: string; type: 'string' | 'number' | 'boolean' | 'secret'; label: string;
                    required?: boolean; description?: string; placeholder?: string;
                    enum?: string[]; pattern?: string; patternMessage?: string }>;
    validate?(config: Record<string, unknown>): void;
  };
  paymentMethod?(settings: Record<string, unknown>): {  // null while the plugin cannot be used
    displayName: string; icon: string; supportedCurrencies: string[]; isLive: boolean; clientConfig: Record<string, unknown>;
  } | null;
  payments?: {
    webhookAck?: 'json' | 'text';                 // 'text' answers a verified delivery with the bare body "success"
    createCheckout(settings, charge: { orderId; amountMinor; currency; successUrl; cancelUrl; notifyUrl; buyerEmail; idempotencyKey }): Promise<{ providerSessionId: string | null; url: string; expiresAt: string | null }>;
    lookup(settings, session: { orderId: string; providerSessionId: string | null }): Promise<{ status: 'succeeded' | 'failed' | 'pending'; paymentId: string | null } | null>;
    readWebhook(settings, delivery: { rawBody: string; headers: Record<string, string> }): Promise<NativePaymentNotice>;   // throws when unverifiable
    createRefund?(settings, { paymentId; amountMinor; currency; reason; reference }): Promise<{ outcome: 'succeeded' | 'failed' | 'pending'; providerRefundId: string | null }>;
    refundOutcome?(settings, { reference; providerRefundId }): Promise<'succeeded' | 'failed' | 'pending' | null>;
  };
}
```

The full types are in `src/native-plugin-modules/payments.ts` and `…/settings.ts`. Where the core uses them:

| Where | Behaviour |
| --- | --- |
| `GET /api/v1/payments/available-methods` | Lists the method of every module that is enabled and says it can be used, after the core's own methods. `name` is the plugin's slug. |
| `POST /api/v1/payments/sessions` with that `paymentMethod` | Calls `createCheckout` and keeps the session by the order (`<slug>_<orderId>`); `notifyUrl` is this store's webhook route for the module, on the host the shopper's client called. |
| `POST /api/v1/payments/webhook/<slug>` | Calls `readWebhook`. A delivery that throws is refused with 400 and nothing it says is trusted. A payment settles the order once; a refund completes the refund waiting for it. |
| `GET /api/v1/payments/sessions/<id>` | While the session is still unpaid, asks `lookup` first, so a shopper who returns before the webhook is not told the order is unpaid. |
| Admin refund | Asks `createRefund`; a refund the module takes but does not confirm is finished by its webhook or by the core's pending-refund timer through `refundOutcome`. A module without `createRefund` (money that cannot be sent back by itself) is refused with a message that says so. |
| Admin plugin settings | `settings` is the plugin's form: listed with the other plugins, saved with `secret` fields encrypted, `required` and `pattern` enforced when the plugin is switched on, then `validate`. The core hands the module its settings with the secrets decrypted. |

Before the module's page opens, the core checks `paymentMethod(settings)` and refuses with
`PAYMENT_METHOD_NOT_AVAILABLE` when it is null — the same rule that keeps the method off the
storefront list. `successUrl` must be an absolute https address (a page outside the store cannot
use an app scheme) and may contain `{CHECKOUT_SESSION_ID}`, which the core replaces with the session
it keeps.

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
