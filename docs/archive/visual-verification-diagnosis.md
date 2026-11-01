# Visual verification — the dated diagnosis

The measurements of the visual baseline of the batch that rebuilt the mobile header, kept as they
were taken: the width diagnosis of the toolbar, the reconciliation of the coverage that batch
changed, the known changes of the desktop capture and the log of the capture noise. The live
description of the visual baseline is in `docs/verification.md`.

Every date, commit and pixel count below belongs to the day it was measured on.

## Mobile header diagnosis

The pre-fix toolbar at `HEAD:apps/shop/components/header.tsx:36` was a non-wrapping flex item with `min-width: auto`. At 390px its parent had 358px of content width. Signed-out controls required 435.625px; signed-in controls required 564.046875px. With logo-left, the toolbar began at x=16, so its right edge was 451.625px or 580.046875px. With logo-center, centering an oversized toolbar also produced a negative left edge. Inline versus drawer navigation did not change these intrinsic toolbar widths.

| Element | Pre-fix width | Source and reason |
| --- | ---: | --- |
| Search form | 148px | `HEAD:apps/shop/components/header.tsx:40`: 112px input, 34px submit button, 2px borders |
| Language select | 160px | `HEAD:apps/shop/components/language-switcher.tsx:23`: native options plus padding and border |
| Guest auth labels | 37.40625px + 54.21875px | `HEAD:apps/shop/components/auth-links.tsx:23`: Login and Register intrinsic text widths |
| Buyer navigation | 50.109375px + 42.875px + 55.265625px + 47.796875px | Cart, My orders, Account, Logout; some labels already wrap inside their minimum-width flex items |
| Guest toolbar | 435.625px | Above controls plus three 12px gaps; removing search reduces it to 275.625px |
| Buyer toolbar | 564.046875px | Above controls plus five 12px gaps; removing search reduces it to 404.046875px |

| Logo | Navigation | Search | Pre-fix guest document width | Pre-fix buyer document width | Fixed width, both states |
| --- | --- | --- | ---: | ---: | ---: |
| left | inline | on | 452 | 580 | 390 |
| left | drawer | on | 452 | 580 | 390 |
| left | inline | off | 390 | 420 | 390 |
| left | drawer | off | 390 | 420 | 390 |
| center | inline | on | 413 | 477 | 390 |
| center | drawer | on | 413 | 477 | 390 |
| center | inline | off | 390 | 397 | 390 |
| center | drawer | off | 390 | 397 | 390 |

The following per-page values use the default logo-left/inline/search-on header. The other seven configurations were measured on the same pages, with the widths in the preceding table. The fixed run also measured categories, search (when enabled), and language in their expanded states: all 108 observations across eight configurations had document width 390.

| Page | Signed in? | Pre-fix document width at 390 | Fixed document width at 390 |
| --- | --- | ---: | ---: |
| home | no | 452 | 390 |
| category | no | 452 | 390 |
| product | no | 452 | 390 |
| login | no | 452 | 390 |
| register | no | 452 | 390 |
| home | yes | 580 | 390 |
| account/profile | yes | 580 | 390 |
| orders | yes | 580 | 390 |
| order detail | yes | 580 | 390 |
| cart | yes | 580 | 390 |
| checkout with a cart line | yes | 580 | 390 |

`git ls-files apps/shop/app` lists the account route but no separate profile page; `apps/shop/app/[locale]/account/page.tsx` renders AccountManagement with the real profile. Checkout was measured with a real cart line, not the empty-cart redirect.

All eight configurations share the named icon toolbar at narrow widths. Inline navigation becomes the same mobile disclosure as drawer navigation; logo-left and logo-center retain their logo arrangement; search-off omits search as before. The toolbar can wrap without a minimum-content overflow, and its spacing derives from Shop tokens. No account entry was removed or placed behind an account menu because the named icons fit.

The desktop-affecting changes audited in the header are the toolbar's added `min-w-0`, anonymous Cart text becoming a span, auth-label spans, search input `min-w-0`/`md:flex-none`, and submit `shrink-0`. New mobile drawer/search/language controls are hidden at desktop; responsive classes restore the original desktop gaps, padding, display, width, alignment and drawer positioning. HeaderSearch emits separate mobile and desktop native forms without adding a desktop wrapper. The recorded desktop banner region and entry-box comparison, rather than an assumption about responsive prefixes, verifies the visible result.

## Coverage reconciliation

| Suite/file | Before | After | Delta | Added titles | Removed or renamed |
| --- | ---: | ---: | ---: | --- | --- |
| API, 79 files | 1073 passed + 2 skipped | 1073 passed + 2 skipped | 0 | none | none |
| Admin, 11 files | 50 | 50 | 0 | none | none |
| `apps/shop/tests/theme-render.test.ts` | 11 | 13 | +2 | S preserves named mobile controls and desktop labels in every header configuration; T retains real authentication destinations, cart count and search submission | none |
| Other six Shop files | 25 | 25 | 0 | none | none |
| Shop total, seven files | 36 | 38 | +2 | above | none |
| `e2e/13-shop.spec.ts` | 1 | 2 | +1 | R Shop search submits a native GET before hydration on desktop and mobile | none |
| `e2e/17-shop-order-history-cancel.spec.ts` | 1 | 2 | +1 | Q Shop home, cart and orders fit the mobile viewport without horizontal overflow | none |
| Other 18 standard E2E files | 19 | 19 | 0 | none | none |
| Standard E2E total, 20 files | 21 | 23 | +2 | Q and R | none |
| Opt-in `e2e/visual.spec.ts` | 2 | 4 | +2 | capture Shop pages at 1440x900; capture Shop pages at 390x844 | none |

The eight opt-in header-diagnosis cases are additional only when `VISUAL_HEADER_DIAGNOSE=1`; neither they nor visual captures count toward standard E2E. The two new static-rendering tests render real Header/AuthLinks/LanguageSwitcher/HeaderSearch components with actual Next context providers. The server-only marker is the environment stub; header behavior is not mocked. Q/R exercise real browser UI and real server routes.

## Known changes

- The post-fix desktop cart and orders headers equal the pre-fix cart header exactly: zero pixels with delta greater than zero within the recorded banner painted bounds `(0, 0, 1440, 71)`. All recorded desktop entry boxes are identical across cart and orders. The post-fix captures are accepted as the Shop baseline.
- The cause of the pre-fix one-pixel difference at `(385, 41)` between the orders and cart headers is not proven. HEAD source shows no page-dependent header branch for the signed-in customer, and pre-fix element coordinates were not recorded. Do not describe this as a proven subpixel-position fix. If this pixel or its neighborhood differs again in any later capture, investigate under the capture-noise rules; it is not an exclusion.

## Known capture noise

- `customers-list-390.png`: the green Active statistic card bottom edge near x=37-350, y=816-837 showed maximum channel delta 9 in one capture. A subsequent unchanged-code capture had zero differing pixels. This is an observation, not an exclusion; recurrence requires investigation.
- During Shop header verification this region recurred: 911 pixels exceeded 2, with maximum delta 9. Clusters were `(37,816)-(37,817)` (2 pixels), `(38,819)` (1 pixel), and `(39,822)-(350,837)` (908 pixels). The failed captures, diffs and service logs are preserved under `e2e/visual-results/archive-shop-header-capture-noise/`. One unchanged-code recapture with existing read-only CSS inspection did not reproduce it: this image had zero differing pixels. The inspection recorded the Active card's gradient, border, shadow, radius and box in `noise-2/computed-customers-list-390.json`; the card source contains hover translation/shadow transitions, but the exact rendering cause of the failed frame is not proven. No exclusion was added and no Admin product code was changed.
- The recurrence investigation reproduced the same 1317 differing pixels, 911 above 2 and maximum delta 9 in two diagnostic captures on unchanged product code. Both showed identical Active card text, value 4, trend 100.00%, and empty-trend content. The outer box was `(16,518.59375,358,337.59375)` and the inner panel was `(37,695.59375,316,139.59375)` in both; gradient, border, shadow, radius, panel backdrop blur and paragraph geometry/color/line-height also matched. Both cards were hovered and translated by -2px. The decorative circle's running 700ms hover transition was at 184.150ms versus 175.627ms, with scales 1.06722 versus 1.05968. Fonts were loaded, DPR was 1, scroll was `(0,0)` and viewport was `390x844` in both. The original failing capture and both diagnostic sets are preserved under `e2e/visual-results/archive-customer-hover-diagnosis/`.
- Classification: identical content with unnormalized capture interaction state (hover and a running transition), not customer-row data noise. Pointer parking and the explicit no-hover/no-animation assertion stabilize that state without product changes or new exclusions. The exact rasterization/compositing mechanism producing the bottom-edge pixels is not proven. After stabilization, three consecutive unchanged-code sets (`noise-2`, `current`, `noise-1`) compared against the first had zero over-limit pixels across all 40 images; `customers-list-390.png` had zero differing pixels in all three. Only `customer-detail-390.png` differed in the second/third comparisons (10/16 pixels, maximum delta 1, within the existing threshold). This is supporting evidence, not permission to ignore another recurrence.
- `dashboard-1440.png` during Batch 2c showed three versus four recent-order rows. Confirmed cause: the API caches the dashboard under `stats:admin-dashboard:` for 15 seconds; a GET within 15 seconds of the latest fill uses that fill without extending it. Whether the capture's serving fill occurred before or after the fourth order determined three versus four rows, confirmed by modeling every dashboard GET per run from the access log. Fix: commit `e0657f61` runs the visual project in its own E2E group and clears `stats:admin-dashboard:*` with the rate-limit keys at every group start; no product change. Verification: same-code baseline/noise-1 on `e0657f61` both showed four rows, with zero over-limit pixels across all 40 images. The earlier captures remain archived under `e2e/visual-results/archive-batch-2c-dashboard-recent-orders-four-vs-three/`; no exclusion was added.

