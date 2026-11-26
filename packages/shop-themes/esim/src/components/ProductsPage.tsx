import React from 'react';
import { ArrowRight, ChevronLeft, ChevronRight, Grid3X3, List, Search, ShieldCheck } from 'lucide-react';
import { cn } from '@jiffoo/ui';
import type { Product } from 'shared/src/types/product';
import type { ProductsPageProps } from 'shared/src/types/theme';
import { displayProductTitle, getEsimProducts, normalizeProductForTheme, readProductCurrency, resolveEsimMediaUrl, type EsimApiProduct } from '../lib/api';
import { getEsimTravelProfile } from '../lib/digital-fulfillment';
import { destinationLabel, planTitle, regionLabelOf, type EsimPlanAttributes } from '../lib/esim/catalog';
import { type ThemeCopy, filterEsimPlans, pickCopy, resolveEsimSiteConfig } from '../site';

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

const PAGE_SIZE = 12;
/** Large enough to read a whole catalog in one request. */
const CATALOG_READ_SIZE = 250;
/** A plan is searchable in every storefront language, whatever language the shopper reads. */
const SEARCH_LOCALES = ['en', 'zh-Hans', 'zh-Hant', 'ja', 'ko', 'fr', 'de'];

type PlanSource = { name?: string; description?: string; typeData?: { esim?: EsimPlanAttributes } };
type PlanScope = 'local' | 'regional' | 'global' | 'unknown';

/** One plan of the list: the product its card reads, its plan facts, and what a shopper can find it by. */
interface PlanEntry {
  product: Product;
  esim?: EsimPlanAttributes;
  currency: string | null;
  searchText: string;
  scope: PlanScope;
}

function toPlanEntry(raw: unknown): PlanEntry {
  const source = raw as PlanSource;
  return {
    product: normalizeProductForTheme(raw as Product),
    esim: source.typeData?.esim || undefined,
    currency: readProductCurrency(raw),
    searchText: planSearchText(source),
    scope: catalogScope(source),
  };
}

/** The cheapest figure a shopper can pay for a plan: a variant's sale price, else the list price. */
function sellablePrice(product: Product): number {
  const variantSalePrices = (Array.isArray(product.variants) ? product.variants : [])
    .map((variant) => Number((variant as { salePrice?: number; price?: number }).salePrice ?? (variant as { price?: number }).price ?? 0))
    .filter((price) => price > 0);
  const listPrice = Number(product.price || 0);
  if (variantSalePrices.length === 0) return listPrice;
  return Math.min(listPrice > 0 ? listPrice : Number.POSITIVE_INFINITY, ...variantSalePrices);
}

/**
 * Local, Regional or Global. Plans carry their coverage as a list of destination codes; the region and
 * country text is read only where a catalog has no such list.
 */
function catalogScope(product: PlanSource): PlanScope {
  const esim = product.typeData?.esim;
  const destinations = Array.isArray(esim?.destinations) ? esim.destinations : [];
  const code = String(esim?.defaultCode || '').replace(/^boss-/i, '').toUpperCase();
  if (destinations.length > 0) {
    if (code.startsWith('GLOBAL')) return 'global';
    return destinations.length === 1 ? 'local' : 'regional';
  }
  const region = (esim?.region || '').toLowerCase();
  const country = (esim?.country || '').toLowerCase();
  if (region.includes('global') || country.includes('global')) return 'global';
  if (region && region !== country) return 'regional';
  if (country || region) return 'local';
  return 'unknown';
}

function matchesCatalogFilter(entry: PlanEntry, filter: CatalogFilter): boolean {
  if (filter === 'All' || filter === 'Popular') return true;
  if (filter === 'Global') return entry.scope === 'global';
  if (filter === 'Regional') return entry.scope === 'regional';
  return entry.scope === 'local';
}

/** Name, description, region code, and every destination and region name in every storefront language. */
function planSearchText(product: PlanSource): string {
  const esim = product.typeData?.esim;
  const parts: string[] = [product.name || '', product.description || '', esim?.region || '', esim?.country || '', esim?.carrier || ''];
  const code = String(esim?.defaultCode || '').replace(/^boss-/i, '').toUpperCase();
  if (code) parts.push(code.split('-')[0]);
  for (const destination of esim?.destinations || []) {
    for (const language of SEARCH_LOCALES) parts.push(destinationLabel(destination, language));
  }
  for (const language of SEARCH_LOCALES) {
    const label = regionLabelOf(esim?.defaultCode || '', language);
    if (label) parts.push(label);
  }
  return parts.filter(Boolean).join(' ').toLowerCase();
}

/** Every word of the query has to appear in the plan's text. */
function matchesSearch(searchText: string, query: string): boolean {
  return query.toLowerCase().split(/\s+/).filter(Boolean).every((term) => searchText.includes(term));
}

function sortPlans(entries: PlanEntry[], sortBy: string, locale?: string): PlanEntry[] {
  if (sortBy === 'price') return [...entries].sort((a, b) => sellablePrice(a.product) - sellablePrice(b.product));
  if (sortBy === 'name') {
    const title = (entry: PlanEntry) => planTitle(entry.esim?.defaultCode || entry.product.id, displayProductTitle(entry.product.name), locale);
    return [...entries].sort((a, b) => title(a).localeCompare(title(b), locale, { sensitivity: 'base', numeric: true }));
  }
  return entries;
}

/** The search a shopper arrived with (`/search?q=…`), so the list starts narrowed and the box shows it. */
function searchFromAddress(): string {
  if (typeof window === 'undefined') return '';
  return new URLSearchParams(window.location.search).get('q')?.trim() ?? '';
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
  const [searchQuery, setSearchQuery] = React.useState(searchFromAddress);
  const [activeSearch, setActiveSearch] = React.useState(searchFromAddress);
  const [remoteProducts, setRemoteProducts] = React.useState<EsimApiProduct[]>([]);
  const [remoteLoading, setRemoteLoading] = React.useState(false);
  const [remoteError, setRemoteError] = React.useState('');
  const [selectedFilter, setSelectedFilter] = React.useState<CatalogFilter>('All');
  const [localSort, setLocalSort] = React.useState<string | null>(null);
  const [page, setPage] = React.useState(1);
  const readId = React.useRef(0);
  const listRef = React.useRef<HTMLElement | null>(null);
  const site = resolveEsimSiteConfig(config);
  const t = (copy: ThemeCopy) => pickCopy(locale, copy);

  // A host that pages on its server hands over one page of a longer list, and the pages stay its job.
  // Anything else — the whole catalog in one piece, or nothing to show — is handled here: this
  // storefront's catalog always arrives whole, so search, filters, sort and pages are worked out on
  // the full list. Host-provided lists may also carry Bokmoo physical cards; the pure eSIM mall never
  // shows them.
  const serverPaged = products.length > 0 && Number(totalPages) > 1 && products.length < Number(totalProducts);
  const hostEntries = React.useMemo(() => filterEsimPlans(products as unknown as EsimApiProduct[]).map(toPlanEntry), [products]);
  const remoteEntries = React.useMemo(() => filterEsimPlans(remoteProducts).map(toPlanEntry), [remoteProducts]);
  const entries = hostEntries.length > 0 ? hostEntries : remoteEntries;
  const sortKey = localSort ?? sortBy;
  // Where the host runs the search itself, its list is already the answer to the search in the address.
  const appliedSearch = activeSearch && (!serverPaged || !onSearch) ? activeSearch : '';
  const scoped = React.useMemo(() => {
    const matching = entries.filter((entry) => matchesSearch(entry.searchText, appliedSearch) && matchesCatalogFilter(entry, selectedFilter));
    return sortPlans(matching, serverPaged ? '' : sortKey, locale);
  }, [entries, appliedSearch, selectedFilter, serverPaged, sortKey, locale]);
  const narrowed = Boolean(appliedSearch) || selectedFilter !== 'All';
  const pageCount = serverPaged ? Math.max(1, Number(totalPages) || 1) : Math.max(1, Math.ceil(scoped.length / PAGE_SIZE));
  const pageShown = serverPaged ? Math.max(1, Number(currentPage) || 1) : Math.min(page, pageCount);
  const pageItems = serverPaged ? scoped : scoped.slice((pageShown - 1) * PAGE_SIZE, pageShown * PAGE_SIZE);

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const next = searchQuery.trim();
    setPage(1);
    // Where the host searches its own pages it does the searching; here the list on show is searched.
    if (serverPaged && onSearch) {
      onSearch(next);
      return;
    }

    setActiveSearch(next);
  };

  const changeFilter = (filter: CatalogFilter) => {
    setSelectedFilter(filter);
    setPage(1);
  };

  const changeSort = (next: string) => {
    setPage(1);
    if (serverPaged) {
      onSortChange(next);
      return;
    }
    setLocalSort(next);
  };

  const goToPage = (next: number) => {
    const target = Math.max(1, Math.min(pageCount, next));
    if (serverPaged) {
      onPageChange(target);
      return;
    }
    if (target === pageShown) return;
    setPage(target);
    // The page that was on show may have been scrolled far down; bring the new page's first plans into view.
    const list = listRef.current;
    if (!list) return;
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
    list.scrollIntoView?.({ block: 'start', behavior: reducedMotion ? 'auto' : 'smooth' });
    list.focus({ preventScroll: true });
  };

  const loadCatalog = React.useCallback(
    async () => {
      const id = ++readId.current;
      setRemoteLoading(true);
      setRemoteError('');
      try {
        const response = await getEsimProducts(
          {
            baseUrl: site.apiBaseUrl,
          },
          {
            page: 1,
            limit: CATALOG_READ_SIZE,
            locale: locale || 'en',
            type: 'esim',
          }
        );
        if (id !== readId.current) return;
        setRemoteProducts(response.items);
      } catch (error) {
        if (id !== readId.current) return;
        const message = error instanceof Error ? error.message : pickCopy(locale, { en: 'Unable to load Bokmoo plans.', hans: '无法加载 BOKMOO 套餐。', hant: '無法載入 BOKMOO 方案。' });
        setRemoteError(message);
        setRemoteProducts([]);
      } finally {
        if (id === readId.current) setRemoteLoading(false);
      }
    },
    [locale, site.apiBaseUrl]
  );

  // The catalog is read here only when the host has nothing to show — an empty search answer, say.
  React.useEffect(() => {
    if (isLoading || serverPaged || hostEntries.length > 0) return;
    void loadCatalog();
  }, [isLoading, serverPaged, hostEntries.length, loadCatalog]);

  if (isLoading || (remoteLoading && scoped.length === 0)) {
    return <div className="min-h-screen bg-[var(--esim-bg)]" />;
  }

  const displayTotal = serverPaged && !narrowed ? totalProducts : scoped.length;
  const displayTotalPages = pageCount;

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
                  aria-label={t({ en: 'Search destinations or bundles...', hans: '搜索目的地或套餐…', hant: '搜尋目的地或套餐…' })}
                  className="h-12 w-full rounded-[0.95rem] border border-[var(--esim-line)] bg-[color:color-mix(in_oklab,var(--esim-bg)_88%,black)] pl-11 pr-4 text-sm text-[var(--esim-ink)] outline-none placeholder:text-[var(--esim-copy-soft)] sm:rounded-full"
                />
              </form>

              <select
                value={sortKey}
                onChange={(event) => changeSort(event.target.value)}
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
                  onClick={() => changeFilter(filter)}
                  aria-pressed={selectedFilter === filter}
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
              <span data-purpose="catalog-count" className="rounded-[0.8rem] border border-[var(--esim-line)] bg-[color:color-mix(in_oklab,var(--esim-bg)_88%,black)] px-4 py-2 text-[11px] font-semibold text-[var(--esim-copy)]">
                {displayTotal} {t({ en: 'plans', hans: '个套餐', hant: '個套餐' })}
              </span>
              <span className="rounded-[0.8rem] border border-[var(--esim-line)] bg-[color:color-mix(in_oklab,var(--esim-bg)_88%,black)] px-4 py-2 text-[11px] font-semibold text-[var(--esim-copy)]">
                {t({ en: 'Instant eSIM delivery', hans: 'eSIM 即时送达', hant: 'eSIM 即時送達' })}
              </span>
            </div>
          </div>
        </section>

        <section ref={listRef} tabIndex={-1} className="mt-8 scroll-mt-24 focus:outline-none">
          {remoteError && scoped.length === 0 ? (
            <div className="rounded-[var(--esim-radius-xl)] border border-[var(--esim-line)] bg-[var(--esim-bg-elevated)] p-10 text-center shadow-[var(--esim-shadow)]">
              <p className="text-xl font-semibold text-[var(--esim-ink)]">{t({ en: 'Plans are unavailable right now.', hans: '套餐暂时无法获取。', hant: '套餐暫時無法獲取。' })}</p>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[var(--esim-copy)]">{remoteError}</p>
              <button
                onClick={() => void loadCatalog()}
                className="mt-6 min-h-11 rounded-[0.9rem] bg-[var(--esim-gold)] px-5 text-sm font-semibold text-[var(--esim-bg)]"
                type="button"
              >
                {t({ en: 'Try Again', hans: '重试', hant: '重試' })}
              </button>
            </div>
          ) : scoped.length === 0 ? (
            <div className="rounded-[var(--esim-radius-xl)] border border-dashed border-[var(--esim-line)] bg-[var(--esim-bg-elevated)] p-16 text-center text-[var(--esim-copy)]">
              {t({ en: 'No plans matched the current search.', hans: '没有符合当前搜索的套餐。', hant: '沒有符合當前搜尋的套餐。' })}
            </div>
          ) : (
            <div
              data-purpose="catalog-grid"
              className={cn(
                'grid gap-3 sm:gap-4',
                viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3' : 'grid-cols-1'
              )}
            >
              {pageItems.map(({ product, esim, currency: rawCurrency }) => {
                const profile = getEsimTravelProfile(product, locale);
                const destinations = esim?.destinations || [];
                const regionName = regionLabelOf(esim?.defaultCode || '', locale);
                const isMultiCountry = destinations.length > 1;
                const coverageLine = destinations.length > 0
                  ? (isMultiCountry
                    // The region name follows the storefront locale (it used to
                    // be pinned to the Chinese spelling on every locale).
                    ? `${regionName ? `${regionName} · ` : ''}${t({ en: `covers ${destinations.length} destinations`, hans: `覆盖 ${destinations.length} 个目的地`, hant: `覆蓋 ${destinations.length} 個目的地`, ja: `${destinations.length} の目的地をカバー`, ko: `${destinations.length}개 목적지 커버`, fr: `couvre ${destinations.length} destinations`, de: `deckt ${destinations.length} Ziele ab`})}`
                    : `${t({ en: 'Covers', hans: '覆盖', hant: '覆蓋' })} ${destinations.map((code) => destinationLabel(code, locale)).join('/')}`)
                  : profile.coverageLabel;
                const eyebrowLabel = destinations.length > 1
                  ? (regionName || t({ en: 'Multi-country', hans: '多国联程', hant: '多國聯程' }))
                  : (regionName || profile.cardEyebrow);
                // The amount checkout bills is the variant sale price, not the
                // product-level list price; the card shows what the cart will charge.
                const displayPrice = sellablePrice(product);

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
                    data-purpose="catalog-plan"
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
                        {planTitle(esim?.defaultCode || product.id, displayProductTitle(product.name), locale)}
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
          <nav data-purpose="catalog-pager" className="mt-10 flex items-center justify-center gap-2">
            <button
              onClick={() => goToPage(pageShown - 1)}
              disabled={pageShown <= 1}
              aria-label={t({ en: 'Previous', hans: '上一页', hant: '上一頁' })}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--esim-line)] bg-[var(--esim-bg-elevated)] text-[var(--esim-ink)] disabled:opacity-40"
              type="button"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span data-purpose="catalog-page-label" className="rounded-full border border-[var(--esim-line)] bg-[var(--esim-bg-elevated)] px-5 py-3 text-[11px] font-semibold tracking-[0.18em] text-[var(--esim-copy)]">
              {t({ en: 'Page', hans: '第', hant: '第' })} {pageShown} / {displayTotalPages}
            </span>
            <button
              onClick={() => goToPage(pageShown + 1)}
              disabled={pageShown >= displayTotalPages}
              aria-label={t({ en: 'Next', hans: '下一页', hant: '下一頁' })}
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
