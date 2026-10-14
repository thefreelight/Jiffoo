# Admin design baseline (V1)

These files are the approved visual and interaction baseline for the Jiffoo Admin.
They are exported from the owner's design canvas. They are **specifications, not
production code**: do not import, bundle or serve them, and do not copy their inline
styles verbatim. Rebuild each screen with the existing Admin stack (Next.js, Tailwind 4,
shadcn/ui, theme tokens) so that it looks and behaves as drawn.

## How to read a board

Each `*.dc.html` file is one screen ("artboard"). The markup between `<x-dc>` and
`</x-dc>` is the layout. `{{name}}` placeholders are filled by `renderVals()` in the
`<script type="text/x-dc">` block at the bottom of the file; that block holds the
sample rows, the light/dark colour sets (`t`) and the state switches. The
`data-props` attribute lists the states the board can show (for example
`selection`, `view`, `overlay`, `state`); read every branch, because each state is
part of the specification. Sample names, amounts and dates are illustrative only;
real pages must show real data.

`Sidebar.dc.html` is the shared sidebar, imported by every page board through
`<dc-import name="Sidebar">`. `canvas.json` is the canvas index (board titles).

## Approval status

| Group | Boards | Status |
|---|---|---|
| A | Main (A1 overview), Orders (A2), OrderDetail (A3), Products (A4), ProductEdit (A5), Categories (A6), Sidebar | Approved |
| B | Customers (B1), CustomerDetail (B2), Staff (B3), StaffDetail (B4), Profile (B5), Auth (B6–B9), Install (B10) | Approved |
| C (first set) | Themes (C1), ThemeEdit (C2), Plugins (C3), PluginDetail (C4), StorefrontCode (C5) | Approved |
| C (second set) | Notifications (C6), Audit (C7), Settings (C8), Health (C9) | Approved |

## Colour and type mapping

Board colours are the light and dark values of the built-in `default-admin` theme
(`apps/api/builtin-themes/default-admin/theme.json`). Implementations must read them
from theme tokens, never hard-code them, so that an installed Admin theme recolours
every page:

| Board value (light / dark) | Theme token |
|---|---|
| `bg` #FFFFFF / #000000 | `ground` |
| `raised` #FAFAFA / #0A0A0A | `raised` |
| `fg` #171717 / #EDEDED | `foreground` |
| `muted` #5C5C5C / #A1A1A1 | `muted` |
| `faint` #737373 / #7C7C7C | `faint` |
| `border` rgba(0,0,0,.09) / rgba(255,255,255,.09) | `border` |
| `active` (selected row / nav item) | `active` |
| `alert`, `alertSoft`, `alertLine` (orange) | `attention`, `attention-soft`, `attention-line` |
| danger red (confirm buttons, field errors) | `destructive`, `destructive-soft`, `destructive-line` |
| radius 7px / 10px | `radius-control` / `radius-panel` |
| Geist + Noto Sans SC, Geist Mono | `font-body` / `font-heading`, `font-mono` |

## Design rules (apply to every Admin page)

1. Single column. Content flows top to bottom; no left/right split layouts. List pages
   use a 1120px content width; form and detail pages use 760px, centred.
2. Black, white and grey by default. Orange (attention) only where the merchant must
   decide something. Irreversible actions use red, inside the confirmation dialog.
3. Real data only. When there is no data, say so ("暂无…"). No fake trends, fake
   percentages or decorative English.
4. Every time is an exact time in the store time zone; state the time zone once in the
   table header or page header.
5. Page header: optional back link → 26px title → one line of description; primary
   actions on the right. Detail and edit pages have a sticky header so actions stay
   reachable while scrolling, plus "previous / next" in the top right that follows the
   current list filter and sort order.
6. Lists: underline status tabs with counts → search + filters (active filters shown as
   removable chips + "clear all") → table (whole row clickable, sortable headers) →
   pagination bar always visible (total · page size 20/50/100 · page numbers), even
   when there is only one page. List state (tab, search, filters, sort, page, page
   size) lives in the URL so returning from a detail page restores it.
7. Secondary row actions live in a "⋯" menu. Unavailable actions are shown disabled
   with the reason written next to them; never let the user click and then fail.
7b. Bulk actions: a checkbox on every row; the header checkbox selects the current page
   only; once the page is fully selected a bar above the table offers "select all N
   matching …" (the selection is then sent to the server as the filter plus excluded
   ids, never as a client-side list of every id); changing search or filters clears
   the selection; while anything is selected a floating bar at the bottom shows
   "N selected · actions · clear selection"; dangerous bulk confirmations state the
   real count and explain which items will be skipped.
8. Saving: on edit pages "Save" is fixed in the header and always visible; with no
   changes it is disabled and shows "Saved · time"; with changes it shows "Unsaved
   changes" and a "Discard changes" button. Leaving with unsaved changes (including via
   the sidebar) asks "Save and leave / Keep editing / Leave without saving". A failed
   save keeps every input, shows a message at the top and can jump to the first error.
   No autosave and no keyboard shortcuts (deferred).
9. Controls are 32–34px tall, radius 7px (controls) / 10px (panels), 1px borders, no
   shadows except floating layers. Order numbers, amounts, SKU/SPU codes use the mono
   font.
10. A page-top notice bar (for example test-signing mode) leaves 24px before the content.

## Copy

Chinese text on the boards is the approved zh-Hans copy. Every string must go through
the shared i18n messages in all three locales (en, zh-Hans, zh-Hant); report new
strings in the batch report.
