# Visual verification

Set `DATABASE_URL_TEST` to the dedicated `jiffoo_core_test` database and check for leftover services on ports 3001-3003 before each run. The visual project follows the normal E2E flows, so its captures use seeded state. It is opt-in and does not run as part of standard `pnpm verify`.

Run `pnpm visual:capture` with `VISUAL_CAPTURE_SET=baseline` on the reference code. Capture `noise-1` and `noise-2` without code changes between runs, then compare them with `node scripts/visual-compare.mjs noise-1 noise-2`. Run `pnpm visual:compare` on the changed code to capture `current` and compare it with `baseline`. The report includes each page and viewport's differing pixel percentage, maximum per-channel delta, and named dynamic exclusions. Captures and difference images are ignored under `e2e/visual-results`.

The capture covers 14 Admin pages at 1440x900 and 390x844. It disables animations, requests reduced motion, waits for fonts, and returns to the top before each full-page screenshot. The comparison excludes only named, bounded dynamic regions; review every remaining pixel delta against the intended color mapping and the same-code noise floor.

The baseline-derived edge mask uses an 8-neighbor luminance difference greater than 12 and a 1px dilation. Its counts are diagnostic only: thin text can lie entirely within the mask even when its color is wrong. An edge-confined difference is never grounds for acceptance. Any per-channel delta greater than 2 requires computed-value equality evidence for the affected elements. `scripts/visual-token-check.mjs` compiles both the reference and current Tailwind classes with their real merged configurations before comparing RGBA values.

Each capture saves `<page>-<width>.boxes.json` alongside its PNG. The browser test locates generated IDs, dates, notification cells affected by timestamp width, and API uptime with accessible locators and records their `boundingBox()` values. Comparison excludes both baseline and current boxes for each matching name, inflated by 2px; missing or mismatched metadata fails comparison. The only fixed exclusions are the login submit-label render timing and the mobile products-list card radius/shadow rasterization. The comparison exits non-zero for any remaining channel delta above 2 or size mismatch.

When a capture fails comparison, preserve the failing current PNGs, diff PNGs, and box JSONs before recapturing once without code changes. Record both outcomes. A non-reproducing region belongs in the known capture noise log below; a later recurrence of the same region requires investigation.

## Known capture noise

- `customers-list-390.png`: the green Active statistic card bottom edge near x=37-350, y=816-837 showed maximum channel delta 9 in one capture. A subsequent unchanged-code capture had zero differing pixels. This is an observation, not an exclusion; recurrence requires investigation.
