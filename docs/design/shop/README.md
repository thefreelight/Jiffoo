# Shop design baseline (V1)

These boards are the owner-approved Shop design and the new visual baseline for the default shop theme, approved on 2026-10-16. All S1-S10 boards and shared pieces are approved. They are **specifications, not production code**: do not import, bundle or serve them. Rebuild them with the existing Shop stack and theme tokens. S-0 changes documentation only; the default-shop token change belongs to S-1.

## How to read a board

Each .dc.html file is one screen. The layout is between <x-dc> and </x-dc>. Its <helmet> contains the original design CSS and fonts. {{name}} placeholders are supplied by renderVals() in the text/x-dc script. The light/dark colour set is t; the root assigns its values to CSS variables. Read every data-props state and sc-if branch. Shared Header and Footer boards are included with dc-import; Header uses sc-for for category sample rows. Home imports MobileMenu in its menu state, keeping the home page visible behind the left sheet. MobileMenu also has a standalone sheet preview. canvas.json indexes every board at 1440px. Set width to mobile for the 390px state; the original 720px container query remains intact. State keys and their approved labels are listed below. Clickable state transitions use the board state; cross-screen links point at the corresponding board. Sample data is illustrative only.

## Board inventory

| Board | States |
| --- | --- |
| Header.dc.html | default; light / dark; desktop / mobile |
| Footer.dc.html | default; light / dark; desktop / mobile |
| Home.dc.html | default / 首页; menu / 手机菜单; light / dark; desktop / mobile |
| Category.dc.html | list / 有商品; empty / 空分类; filters / 手机筛选抽屉; light / dark; desktop / mobile |
| Search.dc.html | results / 有结果; none / 无结果; light / dark; desktop / mobile |
| Product.dc.html | ok / 有货; low / 库存紧张; oos / 缺货; added / 加入后抽屉; light / dark; desktop / mobile |
| Cart.dc.html | items / 有商品; stock / 库存不足; empty / 空购物车; light / dark; desktop / mobile |
| Checkout.dc.html | address / 填写地址; ready / 可支付; changed / 价格已变化; payfail / 支付不可用; light / dark; desktop / mobile |
| CheckoutResult.dc.html | paid / 支付成功; pending / 确认中; cancel / 已取消; light / dark; desktop / mobile |
| SignIn.dc.html | login / 登录; register / 注册; forgot / 忘记密码; reset / 重置密码; verify / 邮箱验证; light / dark; desktop / mobile |
| Account.dc.html | orders / 订单列表; detail / 订单详情; profile / 账户信息; light / dark; desktop / mobile |
| NotFound.dc.html | default; light / dark; desktop / mobile |
| MobileMenu.dc.html | default; light / dark; desktop / mobile |

## Colour and type mapping

These values come directly from the approved draft, not the current default-shop manifest. Implementations must use theme tokens. Core tokens include surfaces, text, borders, attention, destructive, radii and typography; primary, success and announcement tokens belong to extras. Draft-only border-strong, success-soft, image backgrounds and floating-layer shadow remain explicit design values pending S-1 token mapping; they are not new contract tokens in this batch.

| Draft value (light / dark) | Theme token |
| --- | --- |
| #ffffff / #0a0a0a | ground |
| #fafafa / #111111 | raised |
| #171717 / #ededed | foreground |
| #5c5c5c / #a1a1a1 | muted |
| #737373 / #7c7c7c | faint |
| rgba(0,0,0,.09) / rgba(255,255,255,.09) | border |
| rgba(0,0,0,.045) / rgba(255,255,255,.06) | active |
| #171717 / #ededed | primary |
| #ffffff / #0a0a0a | primary-foreground |
| #a15c07 / #f0a640 | attention |
| #fdf6e9 / #2a1d08 | attention-soft |
| #f1dcb4 / #5a3c10 | attention-line |
| #c4281c / #ff6b5e | destructive |
| #fdeeec / #2c0f0c | destructive-soft |
| #f5c7c2 / #5c1d17 | destructive-line |
| #1a7f4b / #4cc38a | success |
| #171717 / #ededed | announcement-bg |
| #ffffff / #0a0a0a | announcement-text |
| 8px | radius-control |
| 12px | radius-panel |
| System UI fonts, then PingFang SC, Hiragino Sans GB, Microsoft YaHei, Noto Sans CJK SC, sans-serif | font-body / font-heading |
| System monospace fonts | font-mono |

The Shop uses system fonts only. This owner decision supersedes the boards' Geist, Geist Mono and Noto Sans SC declarations; the theme contract is unchanged.

Body text is 14px with 1.5 line height; page titles are 32px (26px on phone), section titles 22px, small headings 16px. The hero uses 44px (28px on phone). Controls are 40px, large actions 48px, small actions 32px. Content width is 1280px with 32px desktop / 16px phone gutters. Product grids use four desktop / two phone columns. Shadows are reserved for floating sheets; the review toolbar, notes panel, stage frame radius and stage shadow are excluded.

## Design rules

1. Black, white and grey by default. Orange only where the shopper must act; red only for errors. No fabricated ratings, sales counts, hot badges, countdowns or compare-at prices. Render only real data and omit unconfigured or empty sections.
2. Stock above 5 is in stock, 1-5 shows only N left, and 0 is sold out with add-to-cart disabled. Sold-out variants are struck through and cannot be selected. The owner approval fixes these thresholds; the draft's earlier threshold question is historical.
3. Shipping amounts are calculated and shown at checkout, never estimated in the cart. Order receipts and order details retain actual shipping charges as drawn.
4. Checkout has no main navigation or footer. The phone order summary belongs at the top. The draft explicitly renders details open, so the boards retain that initial expanded state even though its notes call it collapsed. The changed-price phone summary retains the draft's 379 heading while its detail and confirmation action show 385; implementation must obtain a decision before resolving these source inconsistencies.
5. Add-to-cart opens the cart sheet instead of navigating. Unavailable stock disables checkout. Times use the store time zone. Home is built from theme sections; every section's content is merchant-configured.
6. Board photos are illustrative StockSnap CC0 1.0 samples (public domain, commercial use allowed, no attribution required). The shipped default theme bundles no photos. img/SOURCES.txt preserves the source inventory.

## Approved source notes

The following notes are copied directly from the approved draft. They describe intended production behaviour, not live service calls inside a design board.

### 首页

- 首页完全由主题区块拼成：公告栏、横幅、分类列表、商品网格、图文。商家没有配置的区块不渲染。
- “新品”取最新上架的商品。没有评分、销量、“热卖”角标，因为现有数据里没有这些。
- 页头：桌面显示分类导航、搜索框、语言、账户、购物车；手机收起成菜单按钮，见“手机菜单”页。

### 分类/列表

- 商品数取分类的 productCount。排序只列接口实际支持的选项。
- 筛选：主题设置 showFilters 打开时才显示；手机端用左侧抽屉。
- 已售罄商品显示灰色角标，不隐藏。

### 搜索

- 无结果时给出分类入口和新品，不放推荐算法的假结果。

### 商品详情

- 规格来自 variants.attributes；已售罄的规格划掉，不能选。
- 库存提示按真实 stock：大于 5 显示“有货”，1 到 5 显示“仅剩 N 件”，0 时禁用加入购物车。阈值待你确认。
- 加入后从右侧滑出购物车抽屉（shadcn Sheet），不跳转页面。
- 没有划线价：当前商品模型没有原价字段。

### 购物车

- 运费在结账时按地址计算，所以购物车里不显示运费金额。
- 库存不足沿用接口返回的 INSUFFICIENT_STOCK 和可用数量，结账按钮禁用。

### 结账

- 结账页去掉主导航和页脚，减少干扰；手机端订单摘要折叠在顶部。
- 流程和现有接口一致：先填地址，再报价得到配送方式，然后选支付方式。
- 价格变化时（expectedTotal 不一致）用橙色提醒，按钮文字写清新金额，要求确认。
- 支付方式来自已启用的支付插件，名称由插件提供。

### 结账结果

- 对应 checkout/complete、return、cancel 三个现有页面。
- “确认中”对应支付回跳后结果未定，或 REQUIRES_REVIEW 的情况。

### 登录注册

- 五个认证页共用一个居中窄栏版式（400px）。
- 错误提示放在字段下方，红色只用于错误。

### 账户

- 订单状态标签：待支付用橙色（需要顾客处理），已发货用绿色，其余灰色。
- 订单时间按店铺时区显示。手机端订单表格改成卡片列表。

### 404

- 商品下架、链接失效都落到这里。

### 手机菜单

- 手机端菜单：左侧抽屉，包含搜索、分类、账户和语言。

## Copy and implementation boundaries

Chinese board copy is copied from the draft as UTF-8 and is the approved zh-Hans copy for later batches. Production strings must use the shared i18n messages in en, zh-Hans and zh-Hant. Authentication screens are in SignIn.dc.html. Routes represented include /, /products, /categories/[slug], /search, /products/[slug], /cart, /checkout, /checkout/complete, /checkout/return, /checkout/cancel, /login, /register, /forgot-password, /reset-password, /verify-email, /account, /account/orders and /account/orders/[id], under the existing locale routes.

The boards express layout, all draft states, theme and phone variants, and sheet/state navigation. They do not perform login, payment, server polling, stock mutations, sorting, filtering, saving or merchant configuration. The draft also represents these as sample UI rather than real backend operations. The pending spinner remains animated; payment-result refresh is a production requirement. No application, theme manifest, dependency, test, script or schema is changed here.
