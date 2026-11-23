import React from 'react';
import { ArrowRight, ChevronLeft, ChevronRight, Grid3X3, List, Search, ShieldCheck } from 'lucide-react';
import { cn } from '@jiffoo/ui';
import type { Product } from 'shared/src/types/product';
import type { ProductsPageProps } from 'shared/src/types/theme';
import { displayProductTitle, getEsimProducts, mapEsimApiProductToThemeProduct, normalizeProductForTheme, readProductCurrency, resolveEsimMediaUrl, type EsimApiProduct } from '../lib/api';
import { getEsimTravelProfile } from '../lib/digital-fulfillment';
import { destinationLabel, regionLabelOf, type EsimPlanAttributes } from '../lib/esim/catalog';
import { filterEsimPlans, pickCopy, resolveEsimSiteConfig } from '../site';

const GOLD_CTA = 'bg-[linear-gradient(135deg,var(--esim-gold-strong),var(--esim-gold)_55%,color-mix(in_oklab,var(--esim-gold)_70%,#7a5c14))]';

const FOCUS_VISIBLE_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--esim-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--esim-bg)]';

const CATALOG_FILTERS = ['All', 'Popular', 'Local', 'Regional', 'Global'] as const;
type CatalogFilter = (typeof CATALOG_FILTERS)[number];

const FILTER_LABELS: Record<CatalogFilter, { en: string; hans: string; hant: string }> = {
  All: { en: 'All', hans: '全部', hant: '全部' },
  Popular: { en: 'Popular', hans: '热门', hant: '熱門' },
  Local: { en: 'Local', hans: '本地', hant: '本地' },
  Regional: { en: 'Regional', hans: '区域', hant: '區域' },
  Global: { en: 'Global', hans: '全球', hant: '全球' },
};

const SORT_LABELS: Record<string, { en: string; hans: string; hant: string }> = {
  createdAt: { en: 'Newest', hans: '最新', hant: '最新' },
  price: { en: 'Price', hans: '价格', hant: '價格' },
  name: { en: 'Name', hans: '名称', hant: '名稱' },
};

function getProductImage(product: Product): string | null {
  if (!product?.images?.length) return null;
  const primary = product.images.find((image) => image.isMain) || product.images[0];
  return primary?.url || null;
}

function productText(product: { name?: string; description?: string; typeData?: { esim?: { country?: string; region?: string; carrier?: string } } }): string {
  const esim = product.typeData?.esim;
  return [product.name, product.description, esim?.country, esim?.region, esim?.carrier].filter(Boolean).join(' ').toLowerCase();
}

function matchesCatalogFilter(product: { typeData?: { esim?: { country?: string; region?: string } } }, filter: CatalogFilter): boolean {
  const esim = product.typeData?.esim;
  const region = (esim?.region || '').toLowerCase();
  const country = (esim?.country || '').toLowerCase();

  if (filter === 'All' || filter === 'Popular') return true;
  if (filter === 'Global') return region.includes('global') || country.includes('global');
  if (filter === 'Regional') return Boolean(region && !region.includes('global') && region !== country);
  if (filter === 'Local') return Boolean(country && (!region || region === country || !region.includes('global')));
  return true;
}

function ProductMedia({ product, apiBaseUrl }: { product: Product; apiBaseUrl?: string }) {
  const image = resolveEsimMediaUrl(getProductImage(product), apiBaseUrl);
  const profile = getEsimTravelProfile(product);

  if (image) {
    return (
      <img
        src={image}
        alt={displayProductTitle(product.name)}
        className="h-full w-full object-cover"
      />
    );
  }

  return (
    <div className="flex h-full w-full flex-col justify-between bg-[linear-gradient(160deg,color-mix(in_oklab,var(--esim-gold)_12%,transparent),transparent_55%),linear-gradient(180deg,var(--esim-bg-soft),var(--esim-bg))] p-5">
      <div className="flex items-start justify-between gap-3">
        <span className="rounded-full border border-[var(--esim-line)] px-3 py-1 text-[10px] tracking-[0.2em] text-[var(--esim-gold)]">
          {profile.cardEyebrow}
        </span>
        <span className="rounded-full border border-[var(--esim-line)] px-3 py-1 text-[10px] tracking-[0.16em] text-[var(--esim-copy)]">
          {profile.planBadge}
        </span>
      </div>
      <div>
        <p className="text-sm tracking-[0.22em] text-[var(--esim-copy-soft)]">BOKMOO</p>
        <p className="mt-3 text-2xl leading-[0.98] tracking-[-0.04em] text-[var(--esim-ink)]">{profile.coverageLabel}</p>
      </div>
    </div>
  );
}

export const ProductsPage = React.memo(function ProductsPage({
  products,
  isLoading,
  totalProducts,
  currentPage,
  totalPages,
  sortBy,
  viewMode,
  onSortChange,
  onViewModeChange,
  onPageChange,
  onAddToCart,
  onProductClick,
  onSearch,
  config,
  locale,
}: ProductsPageProps) {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [activeSearch, setActiveSearch] = React.useState('');
  const [remoteProducts, setRemoteProducts] = React.useState<Product[]>([]);
  const [remoteTotal, setRemoteTotal] = React.useState(0);
  const [remoteTotalPages, setRemoteTotalPages] = React.useState(1);
  const [remoteLoading, setRemoteLoading] = React.useState(false);
  const [remoteError, setRemoteError] = React.useState('');
  const [selectedFilter, setSelectedFilter] = React.useState<CatalogFilter>('All');
  const site = resolveEsimSiteConfig(config);
  const t = (copy: { en: string; hans: string; hant: string }) => pickCopy(locale, copy);
  const normalizedProducts = React.useMemo(
    () =>
      // Host-provided fallback lists come from the shared instance catalog
      // and may contain Bokmoo physical cards — the pure eSIM mall never
      // shows them.
      (remoteProducts.length > 0
        ? remoteProducts
        : filterEsimPlans(products as unknown as EsimApiProduct[]) as unknown as EsimApiProduct[]).map((raw) => {
        const esimAttrs = ((raw as EsimApiProduct).typeData?.esim || undefined) as EsimPlanAttributes | undefined;
        return {
          product: normalizeProductForTheme(raw as unknown as Product),
          esim: esimAttrs,
          currency: readProductCurrency(raw),
        };
      }),
    [products, remoteProducts]
  );

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    if (onSearch) {
      onSearch(searchQuery.trim());
      return;
    }

    setActiveSearch(searchQuery.trim());
  };

  const loadRemoteProducts = React.useCallback(
    async (search: string = '') => {
      setRemoteLoading(true);
      setRemoteError('');
      try {
        const response = await getEsimProducts(
          {
            baseUrl: site.apiBaseUrl,
          },
          {
            page: currentPage || 1,
            limit: 12,
            locale: locale || 'en',
            type: 'esim',
          }
        );

        const filteredItems = search
          ? response.items.filter((item) =>
              productText(item).includes(search.toLowerCase())
            )
          : response.items;
        const scopedItems = filteredItems.filter((item) => matchesCatalogFilter(item, selectedFilter));
        const isLocalScope = Boolean(search || selectedFilter !== 'All');

        // mapEsimApiProductToThemeProduct now carries typeData + currency
        // through (typed on Product), so the structured BOSS facts survive
        // for the plan cards.
        setRemoteTotal(isLocalScope ? scopedItems.length : Number(response.total || scopedItems.length || 0));
        setRemoteTotalPages(Math.max(1, Math.ceil((isLocalScope ? scopedItems.length : Number(response.total || scopedItems.length || 0)) / 12)));
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to load Bokmoo plans.';
        setRemoteError(message);
        setRemoteProducts([]);
        setRemoteTotal(0);
        setRemoteTotalPages(1);
      } finally {
        setRemoteLoading(false);
      }
    },
    [currentPage, locale, selectedFilter, site.apiBaseUrl]
  );

  React.useEffect(() => {
    if (products.length > 0) return;
    void loadRemoteProducts(activeSearch);
  }, [activeSearch, loadRemoteProducts, products.length]);

  if (isLoading || (remoteLoading && normalizedProducts.length === 0)) {
    return <div className="min-h-screen bg-[var(--esim-bg)]" />;
  }

  const displayTotal = remoteProducts.length > 0 ? remoteTotal : totalProducts;
  const displayTotalPages = remoteProducts.length > 0 ? remoteTotalPages : totalPages;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,color-mix(in_oklab,var(--esim-gold)_10%,transparent),transparent_34%),var(--esim-bg)] px-4 pb-24 pt-16 sm:px-6 sm:pt-20 lg:px-8">
      <div className="mx-auto max-w-[1280px]">
        <section className="rounded-[1.45rem] border border-[color:color-mix(in_oklab,var(--esim-gold)_20%,var(--esim-line))] bg-[linear-gradient(145deg,color-mix(in_oklab,var(--esim-gold)_10%,transparent),transparent_34%),color-mix(in_oklab,var(--esim-bg-elevated)_76%,black)] p-5 shadow-[var(--esim-shadow)] sm:rounded-[var(--esim-radius-xl)] sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--esim-line)] bg-[var(--esim-bg)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--esim-copy)]">
                <ShieldCheck className="h-4 w-4 text-[var(--esim-gold)]" />
                {t({ en: 'Plan collection', hans: '套餐集合', hant: '套餐集合' })}
              </div>
              <h1 className="mt-5 text-[clamp(2.3rem,5vw,4.6rem)] leading-[0.95] tracking-[-0.05em] text-[var(--esim-ink)]">
                {t({ en: 'eSIM plans built for every journey.', hans: '为每一段旅程而生的 eSIM 套餐。', hant: '為每一段旅程而生的 eSIM 套餐。' })}
              </h1>
              <p className="mt-4 text-base leading-7 text-[var(--esim-copy)]">
                {t({ en: 'Explore destination-ready profiles, regional bundles, and premium data options with the clarity of a product catalog.', hans: '探索目的地套餐、区域组合与高级流量选项，像商品目录一样一目了然。', hant: '探索目的地套餐、區域組合與高級流量選項，像商品目錄一樣一目了然。' })}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-[minmax(16rem,1fr)_auto_auto] lg:min-w-[34rem]">
              <form onSubmit={submitSearch} className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--esim-copy-soft)]" />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder={t({ en: 'Search destinations or bundles...', hans: '搜索目的地或套餐…', hant: '搜尋目的地或套餐…' })}
                  className="h-12 w-full rounded-[0.95rem] border border-[var(--esim-line)] bg-[color:color-mix(in_oklab,var(--esim-bg)_88%,black)] pl-11 pr-4 text-sm text-[var(--esim-ink)] outline-none placeholder:text-[var(--esim-copy-soft)] sm:rounded-full"
                />
              </form>

              <select
                value={sortBy}
                onChange={(event) => onSortChange(event.target.value)}
                className="h-12 rounded-[0.95rem] border border-[var(--esim-line)] bg-[color:color-mix(in_oklab,var(--esim-bg)_88%,black)] px-4 text-sm font-medium text-[var(--esim-ink)] outline-none sm:rounded-full"
              >
                <option value="createdAt">{t(SORT_LABELS.createdAt)}</option>
                <option value="price">{t(SORT_LABELS.price)}</option>
                <option value="name">{t(SORT_LABELS.name)}</option>
              </select>

              <div className="flex items-center rounded-[0.95rem] border border-[var(--esim-line)] bg-[color:color-mix(in_oklab,var(--esim-bg)_88%,black)] p-1 sm:rounded-full">
                <button
                  onClick={() => onViewModeChange('grid')}
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-full transition-colors',
                    viewMode === 'grid'
                      ? 'bg-[var(--esim-gold)] text-[var(--esim-bg)]'
                      : 'text-[var(--esim-copy)]'
                  )}
                  type="button"
                >
                  <Grid3X3 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => onViewModeChange('list')}
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-full transition-colors',
                    viewMode === 'list'
                      ? 'bg-[var(--esim-gold)] text-[var(--esim-bg)]'
                      : 'text-[var(--esim-copy)]'
                  )}
                  type="button"
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {CATALOG_FILTERS.map((filter) => (
                <button
                  key={filter}
                  onClick={() => setSelectedFilter(filter)}
                  className={cn(
                    'rounded-[0.8rem] border px-4 py-2 text-[11px] font-semibold transition-colors',
                    selectedFilter === filter
                      ? 'border-[var(--esim-line-strong)] bg-[linear-gradient(145deg,color-mix(in_oklab,var(--esim-gold)_88%,white),color-mix(in_oklab,var(--esim-gold)_68%,black))] text-[var(--esim-bg)]'
                      : 'border-[var(--esim-line)] bg-[color:color-mix(in_oklab,var(--esim-bg)_88%,black)] text-[var(--esim-copy)]'
                  )}
                  type="button"
                >
                  {t(FILTER_LABELS[filter])}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-[0.8rem] border border-[var(--esim-line)] bg-[color:color-mix(in_oklab,var(--esim-bg)_88%,black)] px-4 py-2 text-[11px] font-semibold text-[var(--esim-copy)]">
                {displayTotal} {t({ en: 'plans', hans: '个套餐', hant: '個套餐' })}
              </span>
              <span className="rounded-[0.8rem] border border-[var(--esim-line)] bg-[color:color-mix(in_oklab,var(--esim-bg)_88%,black)] px-4 py-2 text-[11px] font-semibold text-[var(--esim-copy)]">
                {t({ en: 'Instant eSIM delivery', hans: 'eSIM 即时送达', hant: 'eSIM 即時送達' })}
              </span>
            </div>
          </div>
        </section>

        <section className="mt-8">
          {remoteError && normalizedProducts.length === 0 ? (
            <div className="rounded-[var(--esim-radius-xl)] border border-[var(--esim-line)] bg-[var(--esim-bg-elevated)] p-10 text-center shadow-[var(--esim-shadow)]">
              <p className="text-xl font-semibold text-[var(--esim-ink)]">{t({ en: 'Plans are unavailable right now.', hans: '套餐暂时无法获取。', hant: '套餐暫時無法獲取。' })}</p>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[var(--esim-copy)]">{remoteError}</p>
              <button
                onClick={() => void loadRemoteProducts(searchQuery.trim())}
                className="mt-6 min-h-11 rounded-[0.9rem] bg-[var(--esim-gold)] px-5 text-sm font-semibold text-[var(--esim-bg)]"
                type="button"
              >
                {t({ en: 'Try Again', hans: '重试', hant: '重試' })}
              </button>
            </div>
          ) : normalizedProducts.length === 0 ? (
            <div className="rounded-[var(--esim-radius-xl)] border border-dashed border-[var(--esim-line)] bg-[var(--esim-bg-elevated)] p-16 text-center text-[var(--esim-copy)]">
              {t({ en: 'No plans matched the current search.', hans: '没有符合当前搜索的套餐。', hant: '沒有符合當前搜尋的套餐。' })}
            </div>
          ) : (
            <div
              className={cn(
                'grid gap-3 sm:gap-4',
                viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3' : 'grid-cols-1'
              )}
            >
              {normalizedProducts.map(({ product, esim, currency: rawCurrency }) => {
                const profile = getEsimTravelProfile(product, locale);
                const destinations = esim?.destinations || [];
                const regionName = regionLabelOf(esim?.defaultCode || '', locale);
                const isMultiCountry = destinations.length > 1;
                const coverageLine = destinations.length > 0
                  ? (isMultiCountry
                    // The region name follows the storefront locale (it used to
                    // be pinned to the Chinese spelling on every locale).
                    ? `${regionName ? `${regionName} · ` : ''}${t({ en: `covers ${destinations.length} destinations`, hans: `覆盖 ${destinations.length} 个目的地`, hant: `覆蓋 ${destinations.length} 個目的地` })}`
                    : `${t({ en: 'Covers', hans: '覆盖', hant: '覆蓋' })} ${destinations.map((code) => destinationLabel(code, locale)).join('/')}`)
                  : profile.coverageLabel;
                const eyebrowLabel = destinations.length > 1
                  ? (regionName || t({ en: 'Multi-country', hans: '多国联程', hant: '多國聯程' }))
                  : (regionName || profile.cardEyebrow);
                // The core's product-level price is the odoo list price; the
                // amount checkout bills is the variant sale price. Show the
                // cheapest sellable figure so the card matches the cart.
                const variantSalePrices = (Array.isArray(product.variants) ? product.variants : [])
                  .map((variant: any) => Number(variant.salePrice ?? variant.price ?? 0))
                  .filter((price: number) => price > 0);
                const listPrice = Number(product.price || 0);
                const displayPrice = variantSalePrices.length > 0
                  ? Math.min(listPrice > 0 ? listPrice : Number.POSITIVE_INFINITY, ...variantSalePrices)
                  : listPrice;

                // Design-spec plan card (套餐对比 spec): pure typographic —
                // no product-image concept anywhere on this storefront.
                const planValidityDays = typeof esim?.validityDays === 'number' && esim.validityDays > 0 ? esim.validityDays : null;
                const planCurrency = rawCurrency || readProductCurrency(product) || 'USD';
                const currencySymbol = planCurrency === 'CNY' ? '¥' : planCurrency === 'USD' ? '$' : `${planCurrency} `;
                const dailyAverage = planValidityDays && Number.isFinite(displayPrice) && displayPrice > 0
                  ? displayPrice / planValidityDays
                  : null;

                return (
                  <article
                    key={product.id}
                    className={cn(
                      'relative flex flex-col overflow-hidden rounded-2xl border-2 border-[color:color-mix(in_oklab,var(--esim-gold)_26%,transparent)] bg-[linear-gradient(160deg,#23262d_via_40%,#1a1c22_to_75%,#121418)] shadow-[0_16px_50px_rgba(0,0,0,0.65)] ring-1 ring-[color:color-mix(in_oklab,var(--esim-gold)_14%,transparent)] transition-transform duration-300 hover:-translate-y-1',
                      viewMode === 'list' && 'md:flex-row md:items-stretch md:gap-6 md:p-6',
                    )}
                  >
                    <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[color:color-mix(in_oklab,var(--esim-gold)_13%,transparent)] blur-3xl" aria-hidden="true" />
                    <div className="pointer-events-none absolute -bottom-14 -left-16 h-48 w-48 rounded-full bg-[color:color-mix(in_oklab,var(--esim-gold)_7%,transparent)] blur-3xl" aria-hidden="true" />

                    <button
                      onClick={() => onProductClick(product.id)}
                      className="relative z-10 flex min-h-11 flex-1 flex-col gap-5 p-6 text-left lg:p-7"
                      type="button"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="rounded-full border border-[color:color-mix(in_oklab,var(--esim-gold)_30%,transparent)] bg-[#1c1f26]/90 px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-wider text-[var(--esim-gold)]">
                          {eyebrowLabel}
                        </span>
                        <span className="rounded-full bg-[linear-gradient(90deg,var(--esim-gold),var(--esim-gold-strong))] px-3 py-1 font-mono text-[11px] font-bold text-[#141414] shadow-sm">
                          {profile.deliveryLabel}
                        </span>
                      </div>

                      <h2 className="font-serif text-2xl font-normal leading-[1.12] tracking-tight text-[var(--esim-ink)] lg:text-3xl">
                        {displayProductTitle(product.name)}
                      </h2>

                      <p className="inline-flex items-center gap-2 text-sm text-[var(--esim-gold)]">
                        <span className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-full bg-[var(--esim-gold)] text-[10px] font-bold text-[#141414]">✓</span>
                        <span className="font-semibold text-[var(--esim-ink)]">{coverageLine}</span>
                      </p>

                      <div className="flex items-baseline justify-between gap-4 rounded-xl border border-white/[0.06] bg-black/30 p-4">
                        <p className="flex items-baseline gap-1.5">
                          <span className="font-serif text-4xl font-normal tracking-tight text-[var(--esim-gold)] lg:text-5xl">
                            {currencySymbol}{Number(Number.isFinite(displayPrice) ? displayPrice : 0).toFixed(2)}
                          </span>
                          <span className="font-mono text-xs text-[var(--esim-copy-soft)]">
                            {t({ en: '/ full trip', hans: '/ 全程包费', hant: '/ 全程包費' })}
                          </span>
                        </p>
                        {dailyAverage ? (
                          <p className="text-right font-mono text-xs text-[var(--esim-copy-soft)]">
                            <span className="block font-bold text-[var(--esim-gold)]">≈ {currencySymbol}{dailyAverage.toFixed(1)}{t({ en: '/day', hans: '/天', hant: '/天' })}</span>
                            <span>{t({ en: 'daily average', hans: '单日均摊', hant: '單日均攤' })}</span>
                          </p>
                        ) : null}
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center">
                        {([
                          [profile.planLabel, t({ en: 'data included', hans: '流量包含', hant: '流量包含' })],
                          [profile.durationLabel, t({ en: 'validity', hans: '有效期', hant: '有效期' })],
                          [profile.deliveryLabel, t({ en: 'instant delivery', hans: '即时数字发放', hant: '即時數字發放' })],
                        ] as [string, string][]).map(([value, label]) => (
                          <div key={label} className="rounded-lg border border-white/[0.06] bg-black/25 p-2.5">
                            <span className="block font-mono text-xs font-bold text-[var(--esim-gold)]">{value}</span>
                            <span className="mt-0.5 block text-[11px] text-[var(--esim-copy-soft)]">{label}</span>
                          </div>
                        ))}
                      </div>

                      <p className="mt-auto line-clamp-2 text-xs leading-5 text-[var(--esim-copy-soft)]">
                        {product.description || profile.summary}
                      </p>
                    </button>

                    <div className={cn('relative z-10 flex flex-col justify-end gap-2 px-6 pb-6', viewMode === 'list' && 'md:w-[14rem] md:justify-center md:px-0 md:pb-6')}>
                      <button
                        onClick={() => onProductClick(product.id)}
                        className={`inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-6 py-4 text-sm font-bold text-[#141414] shadow-lg transition-transform duration-150 active:scale-[0.98] ${GOLD_CTA}`}
                        type="button"
                      >
                        {t({ en: 'View coverage & plans', hans: '查看覆盖与套餐', hant: '查看覆蓋與套餐' })}
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <p className="text-center text-[11px] text-[var(--esim-copy-soft)]">
                        {t({ en: 'Instant QR delivery · Refundable before activation', hans: '即时二维码发放 · 未激活随时退款', hant: '即時二維碼發放 · 未激活隨時退款' })}
                      </p>
                      <button
                        onClick={() => onAddToCart(product.id)}
                        className={`inline-flex min-h-11 w-full items-center justify-center rounded-full border border-[var(--esim-line)] px-4 text-xs font-medium text-[var(--esim-copy)] transition-colors hover:border-[color:color-mix(in_oklab,var(--esim-gold)_45%,var(--esim-line))] hover:text-[var(--esim-gold)] ${FOCUS_VISIBLE_RING}`}
                        type="button"
                      >
                        {t({ en: 'Add to cart', hans: '加入购物车', hant: '加入購物車' })}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {displayTotalPages > 1 ? (
          <nav className="mt-10 flex items-center justify-center gap-2">
            <button
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--esim-line)] bg-[var(--esim-bg-elevated)] text-[var(--esim-ink)] disabled:opacity-40"
              type="button"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="rounded-full border border-[var(--esim-line)] bg-[var(--esim-bg-elevated)] px-5 py-3 text-[11px] font-semibold tracking-[0.18em] text-[var(--esim-copy)]">
              {t({ en: 'Page', hans: '第', hant: '第' })} {currentPage} / {displayTotalPages}
            </span>
            <button
              onClick={() => onPageChange(Math.min(displayTotalPages, currentPage + 1))}
              disabled={currentPage >= displayTotalPages}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--esim-line)] bg-[var(--esim-bg-elevated)] text-[var(--esim-ink)] disabled:opacity-40"
              type="button"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </nav>
        ) : null}
      </div>
    </div>
  );
});
