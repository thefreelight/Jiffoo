# Developing Themes

A Jiffoo theme is a **pure UI rendering layer**. It renders UI from host-provided data and
notifies user interactions through host-provided hooks — it never owns business logic. This
standard keeps themes portable across hosts and safe to swap.

Jiffoo supports three theme forms. Pick the lightest one that fits:

| Form | What it is | Best for |
|---|---|---|
| **Builtin Embedded** | Ships inside the host runtime, loaded from `src/runtime.ts` | First-party themes maintained with the core |
| **Theme Pack** | Self-contained directory: `theme.json` manifest + tokens + templates + optional runtime bundle | Distributable themes installed on any instance |
| **Theme App** | A self-managed microservice (e.g. Next.js app) that the shop proxies to | Full-app experiences that need their own backend |

## The ThemeRuntime contract

The host provides a single `ThemeRuntime` context — the **sole interface** between host and
theme. A theme that reaches around it (direct API calls, global fetches for shop data) breaks
portability guarantees.

```typescript
interface ThemeRuntime {
  navigation: ThemeNavigation;
  auth: ThemeAuth;
  cart: ThemeCart;
  config: ThemeConfig;
  dataService: ThemeDataService;
}
```

- `navigation` — route helpers and link resolution
- `auth` — session/login state hooks
- `cart` — cart operations (add/update/remove)
- `config` — merchant-tuned theme settings (colors, copy, feature flags)
- `dataService` — products, collections, and other shop data

Render from these; never hardcode shop data or endpoints.

## The `theme.json` manifest

Theme packs declare a manifest at their root:

```json
{
  "schemaVersion": 1,
  "slug": "my-theme",
  "name": "My Theme",
  "version": "0.1.0",
  "target": "shop",
  "description": "One-line description.",
  "author": "Your Name",
  "thumbnail": "assets/thumbnail.svg",
  "category": "saas",
  "entry": {
    "tokensCSS": "tokens.css",
    "runtimeJS": "runtime/theme-runtime.js",
    "templatesDir": "templates",
    "assetsDir": "assets",
    "settingsSchema": "schemas/settings.schema.json"
  },
  "compatibility": { "minCoreVersion": "0.2.0" },
  "poweredBy": { "removable": false }
}
```

Key points:

- `version` follows the same policy as plugins: start at **0.0.x/0.1.x**, advance the last
  digit for compatible changes.
- `entry.runtimeJS` is required when you ship a built runtime bundle — the bundle's embedded
  meta version must match the manifest version.
- `schemas/settings.schema.json` declares merchant-tunable settings; `defaultConfig` provides
  the defaults.

## Tokens CSS is mandatory

If your theme has a `tokens.css`, the runtime must **import it directly** (`import '../tokens.css'`
from the runtime entry). Hosts that embed themes load only the runtime entry — a tokens file
referenced anywhere else renders an unbranded, black-and-white site because the `:root`
definitions never make it into the built CSS.

## Powered by Jiffoo attribution

Storefront themes render a small "Powered by Jiffoo" footer attribution:

- **Free themes**: the badge is **always rendered** — the manifest carries
  `"poweredBy": { "removable": false }` and no setting can turn it off.
- **Paid themes**: the badge may be merchant-removable (`"removable": true`); the admin panel
  then exposes a toggle (default on).

Render it unconditionally in your footer component (small inline SVG mark + text, `currentColor`
styling so it adapts to any footer background). Themes that render no footer of their own
(template-only packs) inherit the host's default footer, which already carries the attribution.

## Theme App form

A Theme App is a standalone web app (commonly Next.js) that implements the same rendering
principles against host APIs, registered as the active theme with `type: 'app'`. The shop
proxies requests to it. Theme Apps manage their own deployment and are self-consistent — they
are not subject to the theme-pack packaging rules, but they must honor the attribution policy
and the pure-rendering principle for anything merchant-configurable.

## Versioning and compatibility

- Keep `compatibility.minCoreVersion` accurate — hosts use it to gate installs.
- Regenerate the runtime bundle whenever the source changes so the bundled meta version and
  footer content stay in sync with the manifest; publishing a stale bundle is the most common
  theme-release defect.

## Packaging and distribution

Like plugins, the official marketplace is curated — themes ship as versioned artifacts from the
official catalog. Submit your theme through the submission pipeline (`"kind": "theme"`):

```bash
curl -X POST https://<api-host>/api/v1/developer/submissions \
  -H 'content-type: application/json' \
  -d '{
    "kind": "theme",
    "slug": "my-theme",
    "name": "My Theme",
    "version": "0.1.0",
    "description": "One-line description of the theme look and target audience.",
    "developerName": "Your Name",
    "developerEmail": "you@example.com",
    "sourceUrl": "https://github.com/you/my-theme",
    "artifactUrl": "https://github.com/you/my-theme/releases/download/v0.1.0/my-theme-0.1.0.zip",
    "manifest": {
      "schemaVersion": 1, "slug": "my-theme", "name": "My Theme", "version": "0.1.0",
      "target": "shop",
      "entry": { "tokensCSS": "tokens.css", "templatesDir": "templates", "settingsSchema": "schemas/settings.schema.json" },
      "poweredBy": { "removable": false }
    }
  }'
```

Automated validation covers the manifest contract: `target` (`shop`/`admin`), semver version,
`entry` fields (tokensCSS required), and the `poweredBy` attribution declaration. Then submit
for review (`POST .../submissions/<id>/submit`) and track the decision
(`GET .../submissions/<id>`) exactly as with plugins — see
[Developing Plugins](./developing-plugins.md#packaging-and-distribution) for the full flow.

Review covers manifest correctness, ThemeRuntime usage (no bypassed data access), settings
schema quality, screenshots (desktop + mobile), and the attribution policy.

## See also

- [Developing Plugins](./developing-plugins.md)
