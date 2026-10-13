# Core V1 Declarative Theme Format

Theme ZIPs contain presentation data only. No executable code, CSS, HTML, SVG,
templates, framework dependencies, external resource URLs, or injection points
are permitted. Core renders every component. A theme targets either `shop` or
`admin`; an Admin theme cannot change layout.

## Archive

The ZIP root contains `theme.json`, optional `LICENSE` and `README.md`, images
under `assets/` (`.png`, `.jpg`, `.jpeg`, `.webp`), and fonts under `fonts/`
(`.woff2`). Files in those two directories may have nested, non-hidden names.
There are no other entries, dotfiles, symlinks, nested archives, or absolute or
traversing paths. The compressed upload is at most 20 MiB, each image at most
5 MiB, each font at most 2 MiB, and the archive at most 200 entries. The
validator checks file signatures as well as extensions. The manifest is at most
256 KiB. Every string is at most 500 characters unless specified below.

## Manifest

`theme.json` is UTF-8 JSON with exactly these top-level fields:

| Field | Type |
| --- | --- |
| `schemaVersion` | integer `2` only; v1 is rejected with `THEME_SCHEMA_INVALID` at `/schemaVersion` |
| `kind` | literal `"theme"` |
| `slug` | lowercase ASCII slug, 2-32 characters |
| `name` | plain text, 1-100 characters |
| `version` | semantic version `major.minor.patch` |
| `description` | plain text, 1-500 characters |
| `author` | plain text, 1-100 characters |
| `license` | plain text, 1-100 characters |
| `target` | `shop` or `admin` |
| `tokens` | required `{core,extras}` object below |
| `darkTokens` | optional bounded partial `{core?,extras?}` overrides |
| `fonts` | array of font declarations, possibly empty |
| `settings` | array of merchant-configurable declarations, possibly empty |
| `copy` | map of copy IDs to localized plain text objects |
| `assets` | Admin: optional `logo` and `login-background` image paths; Shop: empty object |
| `layout` | required for Shop; forbidden for Admin |

All objects reject unknown keys. Copy IDs and setting IDs match
`^[a-z][a-z0-9-]{0,63}$`. Localized values always contain **all three**
`en`, `zh-Hans`, and `zh-Hant`, each plain text (no markup), up to 500
characters. `copy` is controlled copy only, never HTML.

### Tokens

Both targets require every core role: `ground`, `raised`, `foreground`,
`muted`, `faint`, `border`, `active`, `attention`, `attention-soft`,
`attention-line`, `destructive`, `destructive-soft`, `destructive-line`,
`radius-control`, `radius-panel`, `font-body`, `font-heading`, `font-mono`.
The `extras` object is required but its enumerated entries are optional.
Colors are six/eight-digit hex only; alpha is retained in serialization.
No CSS functions, named colors, URLs, scripts or arbitrary properties are allowed.
Lengths use numeric px/rem in [0,128], except container-width up to 1600px.
Shadows have exactly {x,y,blur,spread,color}, each bounded length, with signed
x/y/spread. Font IDs reference packaged declarations or system-sans,
system-serif, system-mono, outfit. A packaged font is
{id,family,file,weight,style,license}, file under fonts/*.woff2,
weight 100-900, normal/italic style, plain family and nonempty license.
There are at most 20 font declarations, 100 settings and 200 copy entries.

Admin extras: primary-foreground, focus-ring, hover, overlay,
sidebar-background, sidebar-foreground, sidebar-active (all colors).
Shop extras: primary, primary-foreground, secondary, secondary-foreground,
accent, success, warning, header-bg, header-text, footer-bg, footer-text,
announcement-bg, announcement-text, price, sale-price (colors);
font-size-base, radius-sm, radius-lg, button-radius, card-radius,
section-spacing, container-width (lengths); type-scale (1-2),
heading-weight (integer 100-900), button-style (solid/outline), card-shadow.

Dark overrides may use only keys explicitly defined in the corresponding
base token group. All values use the same bounds and references as light values.
An absent darkTokens means darkAvailable=false; Core does not invent dark colors.
Runtime payloads contain schemaVersion=2, nested tokens, darkAvailable and optional
darkTokens. Styles declare light roles on :root, dark roles on
:root[data-color-mode="dark"] and, inside prefers-color-scheme:dark,
:root[data-color-mode="system"]. No mode attribute is set by U1a.

### Temporary presentation bridge

packages/shared/src/extensions/theme-bridge.json is the single fixed alias map
for unconverted Admin utilities and existing Shop CSS variables. It maps to v2
core/extras variables, never parses a v1 manifest, and preserves color alpha.
Admin palette aliases are neutral; warning/needs-action aliases use attention,
danger aliases use destructive, and primary actions use foreground.
Remove aliases page-by-page in later redesign batches. Shop aliases retain the
current storefront colors, layout and font behavior.

Builtin packages are synchronized from disk at API startup. An invalid active
package is replaced by the target's builtin default with a theme.startup_fallback
AdminAuditEvent. Stored packages are not deleted. Invalid stored setting values
are ignored at resolve time, defaults apply, and configuration/revisions remain
unchanged. No v1 parsing, serialization or migration adapter exists.

### Settings

Each setting is `{id,type,label,default,constraints,bindsToken?}`. `label`
is localized. `bindsToken` names an explicitly defined v2 path such as
`core.foreground` or `extras.primary`, of the same compatible type. Font
select options must all name available fonts; number bindings obey token bounds.
Types and constraints:

| Type | Default | Constraints |
| --- | --- | --- |
| `color` | six/eight-digit hex | empty object |
| `text` | localized plain text | `{maxLength}` integer 1-500 |
| `image` | `assets/...` or `/uploads/products/...` | empty object |
| `category` | category ID string | empty object |
| `product-list` | array of product IDs, at most 20 | `{maxItems}` integer 1-20 |
| `boolean` | boolean | empty object |
| `select` | one option value | `{options}` array of 1-20 unique plain strings |
| `number` | number | `{min,max,step}` finite numbers, min <= default <= max, step > 0 |
| `link` | internal `/...` path or HTTPS navigation URL | empty object |

Merchant image values in T1b must originate in Core's product-image upload
store. External URLs are permitted **only** for navigation `link` values,
never for images, fonts, tokens, scripts, or embedded resources.

### Shop layout

`header` is `{variant,menu,showSearch}`: variant `logo-left` or
`logo-center`; menu `inline` or `drawer`; search is boolean. `footer` is
`{columns}` with 0-4 columns `{title,links,text}`, up to 8 links each.
Each link is `{label,href}` and href follows the navigation-link rule.
`pages.home.sections` has at most 30 ordered sections. `pages.category` is
`{columns,showFilters}` (columns 2-5); `pages.product` is
`{gallery,showRelatedProducts}` (gallery `left` or `right`). `slots` has
`category.top`, `category.bottom`, `product.bottom`, each a section array
with at most 30 elements. No cart, checkout, payment, or account sections.

Every section is `{id,type,settings}` with a unique ID in its array. A section
setting is a literal of its documented type or `{"$setting":"id"}` referring
to a declared compatible theme setting. No arbitrary section types or fields.

| Section type | Settings (required unless marked ?) | Bounds |
| --- | --- | --- |
| `announcement-bar` | `text` localized, `link`? navigation link | one line, 500 characters/locale |
| `hero-banner` | `title` localized, `body`? localized, `image`? image path, `alt`? localized, `link`? navigation link, `buttonLabel`? localized | one image; missing alt renders as empty alt |
| `image-carousel` | `slides` array of slides with `image` image path, `title` localized, `alt`? localized, `link`? navigation link | 1-8 slides; missing alt renders as empty alt; manual controls, no autoplay |
| `category-list` | `title` localized, `categoryIds`? string array | 0-20 IDs |
| `product-grid` | `title` localized, `source` (`latest`, `category`, `manual`), `categoryId`? category ID, `productIds`? product ID array, `count`? integer, `columns`? integer | 0-20 IDs; count 1-48, columns 1-5; categoryId required for category, productIds for manual |
| `image-with-text` | `image` image path, `alt`? localized, `title` localized, `body` localized, `link`? navigation link, `position`? (`left`, `right`) | one image; missing alt renders as empty alt |
| `text-block` | `title`? localized, `body` localized | 500 characters/locale |
| `feature-list` | `items` array of `{title,body,icon}` | 1-8 items; icon is `check`, `star`, or `truck` |

Images in a package use paths under `assets/`. Every referenced asset and
font must exist in the archive. Theme data is validated at install time;
activation, merchant values, and configuration restore are separate work.
