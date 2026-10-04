# Visual verification

Set `DATABASE_URL_TEST` to the dedicated `jiffoo_core_test` database and check for leftover services on ports 3001-3003 before each run. The baseline visual project follows the normal E2E flows, so its captures use seeded state. It is opt-in and does not run as part of standard `pnpm verify`.

Functional review screenshots are separately opt-in: set
`VISUAL_CAPTURE_SET=review` when running `pnpm visual:capture`. Participating
specifications use the review-capture helper to save review artifacts under
their selected `e2e/visual-results` sets; these are not the baseline/current
comparison project. Without that flag, the helper adds no disk capture. PNG
bytes required for the existing viewport-overflow assertion remain part of
the functional test. The runner passes this value to the review-capture helper
as `VISUAL_SET`; setting `VISUAL_SET` directly on the standard runner has no
effect.

`E2E_RELOAD_STRESS=1` enables the reload reproducer in
`34-shop-reload.spec.ts`, with twenty home reloads and ten checkout reloads
instead of one each.

Known open issue (2026-10-04): intermittent React #418 hydration failure,
not yet resolved; reproducible through the opt-in E2E_RELOAD_STRESS=1 reload
path. Plain theme style rendering and server-derived document language do
not establish that it is fixed.
The hydration failure is not capture noise or an allowed visual exclusion.
Preserve the failure evidence before another run.

Run `pnpm visual:capture` with `VISUAL_CAPTURE_SET=baseline` on the reference code. Capture `noise-1` and `noise-2` without code changes between runs, then compare them with `node scripts/visual-compare.mjs noise-1 noise-2`. Run `pnpm visual:compare` on the changed code to capture `current` and compare it with `baseline`. The report includes each page and viewport's differing pixel percentage, maximum per-channel delta, and named dynamic exclusions. Captures and difference images are ignored under `e2e/visual-results`.

The capture covers 14 Admin pages at 1440x900 and 390x844. It disables animations, requests reduced motion, waits for fonts, and returns to the top before each full-page screenshot. Admin capture parks the pointer on the first visible heading before navigation and again after returning to the top, away from interactive surfaces. The mobile customers capture additionally asserts that the Active statistic card is not hovered, has no transform, and has no running or pending subtree animations. The comparison excludes only named, bounded dynamic regions; review every remaining pixel delta against the intended color mapping and the same-code noise floor.

Shop coverage adds home (Default Shop), the translated category listing, localized product detail, customer login, cart, and account order list at both sizes (40 images in total). The catalog comes from the earlier standard flows. Cart and orders log in through the real customer UI as History Buyer from flow 17; checkout has cleared that customer's cart and the order remains cancelled. No data is created or modified by the visual flow. Home, category, product, login and empty cart have no dynamic exclusions. Orders exclude only the painted bounds of each generated creation date; the date occupies its own grid cell and does not reflow neighboring cells. Shop captures record all browser requests and body computed font families in `shop-observations-<width>.json`, assert no non-local HTTP requests, and require `system-ui, -apple-system, sans-serif`. The visual project remains after 19-themes and before 20-admin-theme.

Every capture validates the full-page PNG width against the configured viewport width. A mismatch is an overflow failure, even when the image would match another overflowing capture. Standard E2E test Q checks signed-out home and signed-in cart and orders at 390x844, using accessible header bounds and full-page PNG dimensions without browser evaluation. The mobile header uses named icon controls, a categories drawer, an expandable search form, and an expandable language selector; no navigation entry is removed. Mobile spacing derives from `--shop-section-spacing`; desktop classes retain the original layout.

Q also opens the Categories disclosure, checks every expected link, tabs to the first link, closes with Escape and checks focus returns to its named trigger, closes by clicking outside, and follows the translated category link with URL and heading assertions. The drawer keeps focus on its trigger when opened; native Tab reaches its links. Escape and link activation restore trigger focus; an outside pointer or focus transition closes without stealing focus from the outside target. The expanded mobile drawer occupies header flow rather than covering page controls; desktop positioning is unchanged. Search uses an explicit native GET form with no submit handler. Its mobile opener is native details/summary with an explicit button role, so it works before hydration. Standard test R disables JavaScript and submits the real search form at both viewport sizes in en and zh-Hans, asserting locale-prefixed actions, GET requests, result URLs and visible localized products. Both HEAD and HeaderSearch derive the action from localePath; no locale product fix was needed. Flow 13 and Q also cover hydrated search.

Set `VISUAL_HEADER_DIAGNOSE=1` for opt-in measurements of every logo-left/logo-center, inline/drawer and search on/off combination, with real theme packages and real browser login. It records signed-out home, category, login, register and product; signed-in home, account/profile, orders, order detail, cart and non-empty-cart checkout. Profile is part of the account page, not a separate route. Each diagnostic case restores Default Shop, uninstalls its theme and removes its temporary cart line. Add `VISUAL_HEADER_REQUIRE_FIT=1` to enforce document width 390 for every measurement. Diagnostic measurements run before the normal 40-image capture set and do not add screenshots to it.

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

The baseline-derived edge mask uses an 8-neighbor luminance difference greater than 12 and a 1px dilation. Its counts are diagnostic only: thin text can lie entirely within the mask even when its color is wrong. An edge-confined difference is never grounds for acceptance. Any per-channel delta greater than 2 requires computed-value equality evidence for the affected elements. `scripts/visual-token-check.mjs` compiles both the reference and current Tailwind classes with their real merged configurations before comparing RGBA values.

Each capture saves `<page>-<width>.boxes.json` alongside its PNG. The browser test locates generated IDs, dates, notification cells affected by timestamp width, and API uptime with accessible locators. A read-only evaluation measures the element and all descendants using their border boxes and computed styles. Each box is expanded by its own non-inset box shadows (offset, blur, spread), text shadows (offset, blur), and outline (width plus offset); their union is rounded outward to whole pixels. The JSON records the own box, descendant union, and each node's painted overflow. Comparison excludes both baseline and current painted bounds for each matching name without extra padding; missing or mismatched metadata fails comparison. Reflow exclusions use the smallest affected title line, action row, or reference badge group, never a whole card, header, or page. The only fixed exclusions are the login submit-label render timing and the mobile products-list card radius/shadow rasterization. The comparison exits non-zero for any remaining channel delta above 2 or size mismatch.

When a capture fails comparison, preserve the failing current PNGs, diff PNGs, and box JSONs before recapturing once without code changes. Record both outcomes. A non-reproducing region belongs in the known capture noise log below; a later recurrence of the same region requires investigation.

## Known changes

- The post-fix desktop cart and orders headers equal the pre-fix cart header exactly: zero pixels with delta greater than zero within the recorded banner painted bounds `(0, 0, 1440, 71)`. All recorded desktop entry boxes are identical across cart and orders. The post-fix captures are accepted as the Shop baseline.
- The cause of the pre-fix one-pixel difference at `(385, 41)` between the orders and cart headers is not proven. HEAD source shows no page-dependent header branch for the signed-in customer, and pre-fix element coordinates were not recorded. Do not describe this as a proven subpixel-position fix. If this pixel or its neighborhood differs again in any later capture, investigate under the capture-noise rules; it is not an exclusion.

## Known capture noise

- `customers-list-390.png`: the green Active statistic card bottom edge near x=37-350, y=816-837 showed maximum channel delta 9 in one capture. A subsequent unchanged-code capture had zero differing pixels. This is an observation, not an exclusion; recurrence requires investigation.
- During Shop header verification this region recurred: 911 pixels exceeded 2, with maximum delta 9. Clusters were `(37,816)-(37,817)` (2 pixels), `(38,819)` (1 pixel), and `(39,822)-(350,837)` (908 pixels). The failed captures, diffs and service logs are preserved under `e2e/visual-results/archive-shop-header-capture-noise/`. One unchanged-code recapture with existing read-only CSS inspection did not reproduce it: this image had zero differing pixels. The inspection recorded the Active card's gradient, border, shadow, radius and box in `noise-2/computed-customers-list-390.json`; the card source contains hover translation/shadow transitions, but the exact rendering cause of the failed frame is not proven. No exclusion was added and no Admin product code was changed.
- The recurrence investigation reproduced the same 1317 differing pixels, 911 above 2 and maximum delta 9 in two diagnostic captures on unchanged product code. Both showed identical Active card text, value 4, trend 100.00%, and empty-trend content. The outer box was `(16,518.59375,358,337.59375)` and the inner panel was `(37,695.59375,316,139.59375)` in both; gradient, border, shadow, radius, panel backdrop blur and paragraph geometry/color/line-height also matched. Both cards were hovered and translated by -2px. The decorative circle's running 700ms hover transition was at 184.150ms versus 175.627ms, with scales 1.06722 versus 1.05968. Fonts were loaded, DPR was 1, scroll was `(0,0)` and viewport was `390x844` in both. The original failing capture and both diagnostic sets are preserved under `e2e/visual-results/archive-customer-hover-diagnosis/`.
- Classification: identical content with unnormalized capture interaction state (hover and a running transition), not customer-row data noise. Pointer parking and the explicit no-hover/no-animation assertion stabilize that state without product changes or new exclusions. The exact rasterization/compositing mechanism producing the bottom-edge pixels is not proven. After stabilization, three consecutive unchanged-code sets (`noise-2`, `current`, `noise-1`) compared against the first had zero over-limit pixels across all 40 images; `customers-list-390.png` had zero differing pixels in all three. Only `customer-detail-390.png` differed in the second/third comparisons (10/16 pixels, maximum delta 1, within the existing threshold). This is supporting evidence, not permission to ignore another recurrence.
- `dashboard-1440.png` during Batch 2c showed three versus four recent-order rows. Confirmed cause: the API caches the dashboard under `stats:admin-dashboard:` for 15 seconds; a GET within 15 seconds of the latest fill uses that fill without extending it. Whether the capture's serving fill occurred before or after the fourth order determined three versus four rows, confirmed by modeling every dashboard GET per run from the access log. Fix: commit `e0657f61` runs the visual project in its own E2E group and clears `stats:admin-dashboard:*` with the rate-limit keys at every group start; no product change. Verification: same-code baseline/noise-1 on `e0657f61` both showed four rows, with zero over-limit pixels across all 40 images. The earlier captures remain archived under `e2e/visual-results/archive-batch-2c-dashboard-recent-orders-four-vs-three/`; no exclusion was added.
