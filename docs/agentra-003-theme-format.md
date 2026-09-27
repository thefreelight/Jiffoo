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
| `schemaVersion` | integer `1` |
| `kind` | literal `"theme"` |
| `slug` | lowercase ASCII slug, 2-32 characters |
| `name` | plain text, 1-100 characters |
| `version` | semantic version `major.minor.patch` |
| `description` | plain text, 1-500 characters |
| `author` | plain text, 1-100 characters |
| `license` | plain text, 1-100 characters |
| `target` | `shop` or `admin` |
| `tokens` | target-specific role/value object below |
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

Unspecified roles use Core defaults. Colors are `#RRGGBB` or `#RRGGBBAA`;
no CSS functions or arbitrary CSS are accepted. Lengths are numeric `px` or
`rem` in `[0, 128]` (container-width may reach `1600px`). Shadows are objects
`{x,y,blur,spread,color}`: four lengths (0-128; x/y/spread may be negative
down to -128) and a color. Font values name a declared font ID or one of
`system-sans`, `system-serif`, `outfit`. Outfit ships Latin 400-800 with a
CJK system fallback. Font declarations are
`{id,family,file,weight,style,license}`; `file` is `fonts/*.woff2`,
weight is 100-900, style is `normal` or `italic`, and a nonempty license is
mandatory. Font families are plain names, not CSS expressions.
The public resolved theme includes each font's `id`, `family`, versioned local
`url`, `weight`, and `style`; the renderer uses `id` to select font tokens.

Shop color roles: `background`, `surface`, `surface-muted`, `text`,
`text-muted`, `border`, `primary`, `primary-foreground`, `secondary`,
`secondary-foreground`, `accent`, `success`, `warning`, `danger`,
`header-bg`, `header-text`, `footer-bg`, `footer-text`, `announcement-bg`,
`announcement-text`, `price`, `sale-price`. Shop font roles: `font-body`,
`font-heading`. Shop length roles: `font-size-base`, `radius-sm`,
`radius-md`, `radius-lg`, `button-radius`, `card-radius`,
`section-spacing`, `container-width`. Shop number roles:
`type-scale` (1-2), `heading-weight` (100-900). Shop enum:
`button-style` (`solid` or `outline`). Shop shadow: `card-shadow`.

Admin color roles: `background`, `surface`, `surface-muted`, `text`,
`text-muted`, `border`, `primary`, `primary-foreground`, `sidebar-bg`,
`sidebar-text`, `sidebar-active-bg`, `sidebar-active-text`, `success`,
`warning`, `danger`, `info`, `foreground`, `action-base`, `action-dark`,
`action-deep`, `action-faint`, `action-light`, `action-pale`, `action-soft`,
`action-strong`, `action-veil`, `alert-dark`, `alert-faint`, `alert-strong`, `caution-base`,
`caution-faint`, `caution-soft`, `caution-strong`, `caution-veil`,
`chart-amber-base`, `chart-cyan-base`, `chart-teal-light`, `chart-violet-base`, `contrast-base`, `contrast-faint`,
`contrast-strong`, `cool-base`, `cool-faint`, `cool-ink`, `cool-light`,
`cool-pale`, `cool-soft`, `cool-strong`, `cool-veil`, `danger-base`,
`danger-dark`, `danger-deep`, `danger-deepest`, `danger-faint`,
`danger-light`, `danger-soft`, `danger-strong`, `danger-veil`,
`highlight-base`, `highlight-dark`, `highlight-deep`, `highlight-faint`,
`highlight-icon`, `highlight-soft`, `highlight-strong`, `highlight-veil`, `neutral-base`,
`neutral-dark`, `neutral-deep`, `neutral-deepest`, `neutral-faint`,
`neutral-light`, `neutral-pale`, `neutral-soft`, `neutral-strong`,
`neutral-veil`, `positive-deep`, `positive-faint`, `positive-light`,
`positive-pale`, `positive-strong`, `positive-veil`, `success-base`,
`success-dark`, `success-deep`, `success-deepest`, `success-faint`,
`success-light`, `success-soft`, `success-strong`, `success-veil`,
`warning-base`, `warning-dark`, `warning-deep`, `warning-faint`,
`warning-strong`, `warning-veil`, `highlight-faint-extra`,
`install-background`, `install-foreground`, `install-surface`,
`media-surface`, `overlay-ink`, `page-surface`. Admin font role: `font-body`. Admin length
roles: `radius-sm`, `radius-md`, `radius-lg`. Admin shadow:
`card-shadow`. Admin enum: `density` (`compact` or `comfortable`).
Admin assets may supply `logo` and `login-background`, both local image paths.

### Settings

Each setting is `{id,type,label,default,constraints,bindsToken?}`. `label`
is localized. `bindsToken` names a token role of the same compatible type.
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
