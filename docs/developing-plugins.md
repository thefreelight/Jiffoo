# Developing Plugins

A Jiffoo plugin extends the platform with payment providers, email delivery, integrations,
analytics, and similar capabilities. Plugins run inside the host process, register routes and
hooks through a versioned contract, and expose settings in the admin panel.

This guide describes the plugin model and the contract your plugin must honor. The
[`jiffoo-plugin-sdk`](https://www.npmjs.com/package/jiffoo-plugin-sdk) npm package provides the
TypeScript types, the `definePlugin` helper, and validators described here.

## Plugin contract (v1)

Every plugin declares a **contract version**. Contract `v1` is the current one; the contract
version in your manifest must match a version the host supports, and it is what the host uses
to decide compatibility at load time.

A plugin manifest carries:

| Field | Required | Purpose |
|---|---|---|
| `id` | yes | Slug identifying the plugin (`kebab-case`, unique per installation) |
| `version` | yes | Plugin version (see [Versioning](#versioning)) |
| `contract` | yes | `"v1"` |
| `dependsOn` | no | Slugs of plugins that must be active for this one to load |
| `requiredSettings` | no | Settings keys the merchant must fill before activation |
| `uses` | no | Extension surfaces the plugin touches (see below) |

### Extension surfaces

Declare only what you use via `uses`:

- `api` — register HTTP routes
- `events` — subscribe to platform events
- `adminUI` — admin panel pages
- `storefront` — storefront widgets or theme integrations
- `db` — database migrations
- `jobs` — background/scheduled jobs
- `drivers` — replaceable driver implementations (payment, email, shipping, …)

### Categories

One of: `payment`, `email`, `integration`, `theme`, `analytics`, `marketing`, `shipping`,
`seo`, `social`, `security`, `other`.

## Quickstart

```bash
npm install jiffoo-plugin-sdk
```

```typescript
import { definePlugin } from 'jiffoo-plugin-sdk';

export default definePlugin({
  slug: 'my-plugin',
  name: 'My Plugin',
  version: '0.0.1',
  category: 'integration',
  capabilities: ['webhook.receive'],
  async onActivate(ctx) {
    ctx.logger.info('my-plugin activated');
  },
});
```

`definePlugin` validates your definition against the contract at build/startup time — a plugin
that violates the contract fails fast instead of breaking the host at runtime.

## Lifecycle hooks

| Hook | When it runs |
|---|---|
| `onInstall` | First installation (create tables, seed defaults) |
| `onActivate` | Merchant enables the plugin |
| `onDeactivate` | Merchant disables the plugin |
| `onUninstall` | Removal (clean up what you own) |

All hooks receive the `CoreContext` (logger, settings, platform APIs, event bus).

## Surfaces in practice

### API routes

Register routes through the contract's route registration (`GET`/`POST`/`PUT`/`PATCH`/`DELETE`).
Routes are namespaced under the plugin slug — never register bare top-level paths.

### Events

Subscribe to contract events such as `order.created`, `order.paid`, `order.fulfilled`,
`order.cancelled`, `order.refunded`, `cart.updated`, `product.created`, `product.updated`,
`product.deleted`, `customer.registered`, `customer.login`, `payment.failed`,
`payment.succeeded`. Custom event names are allowed but contract events are the stable,
forward-compatible set.

### Admin UI

Admin pages render inside the platform's plugin page shell. Use the shared admin primitives
(form rows, tables, tabs) rather than custom chrome; declare all admin pages in your
`admin-ui.json` — the first page becomes the sidebar entry and the generated tab strip handles
sub-pages. Keep inputs controlled and use empty strings for missing text values.

### Database

Ship SQL migrations with ordered ids; the host tracks applied migrations per plugin. Only touch
tables your plugin owns.

## Settings

Declare merchant-facing settings with typed fields so the admin panel renders them
automatically:

- Field types: `string`, `number`, `boolean`, `select`, `multiselect`, `password`, `url`,
  `email`, `textarea`
- Each field: `key`, `type`, `label`, optional `description`, `required`, `default`, `options`
  (for selects), and `validation` (`min`/`max`/`pattern`)
- Secrets belong in `password` fields — the host stores them encrypted and never returns them
  in plaintext reads

## Versioning

- New plugins start at **0.0.1**.
- Advance the **last digit** for fixes and compatible changes.
- Reserve minor/major bumps for contract-level breaking changes — hosts may refuse plugins
  whose major contract expectations do not match.

The SDK ships a compatibility checker (`checkPluginCompatibility`,
`checkRequestCompatibility`) — run it in CI against the platform versions you support.

## Packaging and distribution

The official marketplace is curated: plugins ship as versioned artifacts from the official
catalog, and merchants install/enable them from the admin marketplace. Submit your plugin
through the submission pipeline:

### 0. Get a developer API key

Submissions are authenticated with a developer API key (`jfdev_…`) issued by the platform
team — request yours with your developer name, email, and company. Keys identify every
submission, so the review always knows who submitted.

Prefer a form? A self-service submission page lives at **`/developer-portal`** on the API host.

### 1. Create the submission

```bash
curl -X POST https://<api-host>/api/v1/developer/submissions \
  -H 'authorization: Bearer jfdev_your-key' \
  -H 'content-type: application/json' \
  -d '{
    "kind": "plugin",
    "slug": "my-plugin",
    "name": "My Plugin",
    "version": "0.0.1",
    "contractVersion": "v1",
    "category": "integration",
    "description": "What the plugin does, in a sentence or two.",
    "developerName": "Your Name",
    "developerEmail": "you@example.com",
    "sourceUrl": "https://github.com/you/my-plugin",
    "artifactUrl": "https://github.com/you/my-plugin/releases/download/v0.0.1/my-plugin-0.0.1.zip",
    "manifest": { "id": "my-plugin", "version": "0.0.1", "contract": "v1", "category": "integration", "uses": ["api", "events"] }
  }'
```

The response includes an automated **validation report** (`{ ok, issues[] }`). `error`-level
issues block review; `warning`s are shown to the reviewer. Fix your plugin or manifest and
create the submission again if needed.

### 2. Submit for review

```bash
curl -X POST https://<api-host>/api/v1/developer/submissions/<id>/submit \
  -H 'authorization: Bearer jfdev_your-key'
```

This requires the validation to pass and an artifact to be attached. Attach one either as an
https URL or upload the file directly:

```bash
curl -X POST https://<api-host>/api/v1/developer/submissions/<id>/artifact/upload \
  -H 'authorization: Bearer jfdev_your-key' \
  -F 'artifact=@dist/my-plugin-0.0.1.zip'   # max 200MB
```

### 3. Track the decision

```bash
curl -H 'authorization: Bearer jfdev_your-key' \
  https://<api-host>/api/v1/developer/submissions/<id>
```

Possible outcomes: **approved** → **published** (the platform records the catalog reference
and hands the entry to the market publish flow), **rejected**, or **changes_requested** (fix
the noted issues, re-create the submission at a new patch version, and submit again). List
your own submissions with `GET /api/v1/developer/submissions` — the key defines ownership.

Keep your plugin build reproducible from a public source repository — review covers manifest
correctness, surface usage, and data handling.

## See also

- [Developing Themes](./developing-themes.md)
- [`jiffoo-plugin-sdk` on npm](https://www.npmjs.com/package/jiffoo-plugin-sdk)
