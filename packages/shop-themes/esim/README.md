# eSIM Route Mall (esim) Theme

Bokmoo is an embedded official storefront theme for premium travel connectivity:

- destination eSIM plans
- regional travel passes
- instant QR delivery
- setup-first onboarding
- premium black-and-gold brand presentation

The homepage is 路线通 (Route Planner): pick destinations, tune days and
usage, and the storefront deterministically verifies which single eSIM
covers the whole trip — zero model calls. Deployed as its own worker
(esim.bokmoo.com) pinned to slug `esim` via THEME_SLUG_PIN while sharing
the bokmoo core API, users, orders and payments.

## Copy and localization

Every customer-facing string goes through `pickCopy(locale, { en, hans, hant })`
in `src/site.ts`, which resolves in this order:

1. a translation kept in the Store Localization (i18n) plugin for the
   `theme.esim` namespace — its keys are the English source strings, so an
   operator's edit reaches the storefront without a theme release;
2. an explicit inline `hans` / `hant` entry;
3. the message catalog `src/i18n/{ja,ko,fr,de}.json`, keyed by English source;
4. the English source.

`npm test` keeps that true: every static English source string must have a
translation in all four catalog locales, no raw JSX text may carry copy, and
nothing may resolve copy by hand.

`node scripts/export-i18n.mjs > theme-i18n.json` exports every string with its
current translations in the plugin's import format, so the plugin's table can
be seeded for a store.

## Page metadata (title and description)

The shop host renders a few marketing routes on the theme's behalf and emits
their `<title>` and meta description server-side, so the theme runtime cannot
set them. The theme declares them instead in `theme-pack/theme.json`, per route
and locale:

```json
"x-jiffoo-seo": {
  "pages": {
    "home": {
      "en": { "title": "{brand} eSIM — One Trip, One eSIM", "description": "…" },
      "de": { "title": "{brand} eSIM — Eine Reise, eine eSIM", "description": "…" }
    }
  }
}
```

The host resolves a route's copy in the same order as `pickCopy`: the plugin
translation keyed by the English source, then the entry declared for the
locale, then the English source. `{brand}` becomes the storefront brand name.
Routes the theme does not list keep the host defaults. `npm test` checks that
every declared route covers all seven locales, and `scripts/export-i18n.mjs`
exports these strings as well, so operators can override them in the plugin.
