import React from 'react';
import { ChevronLeft, ChevronRight, Grid3X3, List, Search, ShieldCheck } from 'lucide-react';
import { cn } from '@jiffoo/ui';
import type { Product } from 'shared/src/types/product';
import type { ProductsPageProps } from 'shared/src/types/theme';
import { getBokmooProducts, mapBokmooApiProductToThemeProduct, normalizeProductForTheme } from '../lib/api';
import { getBokmooTravelProfile } from '../lib/digital-fulfillment';
import { resolveBokmooSiteConfig } from '../site';

const CATALOG_FILTERS = ['All', 'Popular', 'Local', 'Regional', 'Global'] as const;
type CatalogFilter = (typeof CATALOG_FILTERS)[number];

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

function ProductMedia({ product }: { product: Product }) {
  const image = getProductImage(product);
  const profile = getBokmooTravelProfile(product);

  if (image) {
    return (
      <img
        src={image}
        alt={product.name}
        className="h-full w-full object-cover"
      />
    );
  }

  return (
    <div className="flex h-full w-full flex-col justify-between bg-[linear-gradient(160deg,color-mix(in_oklab,var(--bokmoo-gold)_12%,transparent),transparent_55%),linear-gradient(180deg,var(--bokmoo-bg-soft),var(--bokmoo-bg))] p-5">
      <div className="flex items-start justify-between gap-3">
        <span className="rounded-full border border-[var(--bokmoo-line)] px-3 py-1 text-[10px] tracking-[0.2em] text-[var(--bokmoo-gold)]">
          {profile.cardEyebrow}
        </span>
        <span className="rounded-full border border-[var(--bokmoo-line)] px-3 py-1 text-[10px] tracking-[0.16em] text-[var(--bokmoo-copy)]">
          {profile.planBadge}
        </span>
      </div>
      <div>
        <p className="text-sm tracking-[0.22em] text-[var(--bokmoo-copy-soft)]">BOKMOO</p>
        <p className="mt-3 text-2xl leading-[0.98] tracking-[-0.04em] text-[var(--bokmoo-ink)]">{profile.coverageLabel}</p>
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
  const site = resolveBokmooSiteConfig(config);
  const normalizedProducts = React.useMemo(
    () =>
      (remoteProducts.length > 0 ? remoteProducts : products).map((product) =>
        normalizeProductForTheme(product as unknown as Product)
      ),
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
        const response = await getBokmooProducts(
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

        setRemoteProducts(scopedItems.map(mapBokmooApiProductToThemeProduct));
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
    return <div className="min-h-screen bg-[var(--bokmoo-bg)]" />;
  }

  const displayTotal = remoteProducts.length > 0 ? remoteTotal : totalProducts;
  const displayTotalPages = remoteProducts.length > 0 ? remoteTotalPages : totalPages;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,color-mix(in_oklab,var(--bokmoo-gold)_10%,transparent),transparent_34%),var(--bokmoo-bg)] px-4 pb-24 pt-16 sm:px-6 sm:pt-20 lg:px-8">
      <div className="mx-auto max-w-[1280px]">
        <section className="rounded-[1.45rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_20%,var(--bokmoo-line))] bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_10%,transparent),transparent_34%),color-mix(in_oklab,var(--bokmoo-bg-elevated)_76%,black)] p-5 shadow-[var(--bokmoo-shadow)] sm:rounded-[var(--bokmoo-radius-xl)] sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--bokmoo-copy)]">
                <ShieldCheck className="h-4 w-4 text-[var(--bokmoo-gold)]" />
                Plan Collection
              </div>
              <h1 className="mt-5 text-[clamp(2.3rem,5vw,4.6rem)] leading-[0.95] tracking-[-0.05em] text-[var(--bokmoo-ink)]">
                eSIM plans built for every journey.
              </h1>
              <p className="mt-4 text-base leading-7 text-[var(--bokmoo-copy)]">
                Explore destination-ready profiles, regional bundles, and premium data options with the clarity of a product catalog.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-[minmax(16rem,1fr)_auto_auto] lg:min-w-[34rem]">
              <form onSubmit={submitSearch} className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--bokmoo-copy-soft)]" />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search destinations or bundles..."
                  className="h-12 w-full rounded-[0.95rem] border border-[var(--bokmoo-line)] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_88%,black)] pl-11 pr-4 text-sm text-[var(--bokmoo-ink)] outline-none placeholder:text-[var(--bokmoo-copy-soft)] sm:rounded-full"
                />
              </form>

              <select
                value={sortBy}
                onChange={(event) => onSortChange(event.target.value)}
                className="h-12 rounded-[0.95rem] border border-[var(--bokmoo-line)] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_88%,black)] px-4 text-sm font-medium text-[var(--bokmoo-ink)] outline-none sm:rounded-full"
              >
                <option value="createdAt">Newest</option>
                <option value="price">Price</option>
                <option value="name">Name</option>
              </select>

              <div className="flex items-center rounded-[0.95rem] border border-[var(--bokmoo-line)] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_88%,black)] p-1 sm:rounded-full">
                <button
                  onClick={() => onViewModeChange('grid')}
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-full transition-colors',
                    viewMode === 'grid'
                      ? 'bg-[var(--bokmoo-gold)] text-[var(--bokmoo-bg)]'
                      : 'text-[var(--bokmoo-copy)]'
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
                      ? 'bg-[var(--bokmoo-gold)] text-[var(--bokmoo-bg)]'
                      : 'text-[var(--bokmoo-copy)]'
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
                      ? 'border-[var(--bokmoo-line-strong)] bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_88%,white),color-mix(in_oklab,var(--bokmoo-gold)_68%,black))] text-[var(--bokmoo-bg)]'
                      : 'border-[var(--bokmoo-line)] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_88%,black)] text-[var(--bokmoo-copy)]'
                  )}
                  type="button"
                >
                  {filter}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-[0.8rem] border border-[var(--bokmoo-line)] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_88%,black)] px-4 py-2 text-[11px] font-semibold text-[var(--bokmoo-copy)]">
                {displayTotal} plans
              </span>
              <span className="rounded-[0.8rem] border border-[var(--bokmoo-line)] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_88%,black)] px-4 py-2 text-[11px] font-semibold text-[var(--bokmoo-copy)]">
                Instant eSIM delivery
              </span>
            </div>
          </div>
        </section>

        <section className="mt-8">
          {remoteError && normalizedProducts.length === 0 ? (
            <div className="rounded-[var(--bokmoo-radius-xl)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] p-10 text-center shadow-[var(--bokmoo-shadow)]">
              <p className="text-xl font-semibold text-[var(--bokmoo-ink)]">Plans are unavailable right now.</p>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[var(--bokmoo-copy)]">{remoteError}</p>
              <button
                onClick={() => void loadRemoteProducts(searchQuery.trim())}
                className="mt-6 min-h-11 rounded-[0.9rem] bg-[var(--bokmoo-gold)] px-5 text-sm font-semibold text-[var(--bokmoo-bg)]"
                type="button"
              >
                Try Again
              </button>
            </div>
          ) : normalizedProducts.length === 0 ? (
            <div className="rounded-[var(--bokmoo-radius-xl)] border border-dashed border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] p-16 text-center text-[var(--bokmoo-copy)]">
              No plans matched the current search.
            </div>
          ) : (
            <div
              className={cn(
                'grid gap-3 sm:gap-4',
                viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3' : 'grid-cols-1'
              )}
            >
              {normalizedProducts.map((product) => {
                const profile = getBokmooTravelProfile(product);

                return (
                  <article
                    key={product.id}
                    className={cn(
                      'overflow-hidden rounded-[1.35rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_14%,var(--bokmoo-line))] bg-[color:color-mix(in_oklab,var(--bokmoo-bg-elevated)_82%,black)] shadow-[var(--bokmoo-shadow)] transition-transform duration-300 hover:-translate-y-1 sm:rounded-[var(--bokmoo-radius-xl)]',
                      viewMode === 'list' && 'grid gap-4 p-4 md:grid-cols-[14rem_minmax(0,1fr)_12rem] md:items-center md:gap-5 md:p-5'
                    )}
                  >
                    <button
                      onClick={() => onProductClick(product.id)}
                      className={cn(viewMode === 'grid' ? 'block text-left' : 'contents')}
                      type="button"
                    >
                      <div
                        className={cn(
                          'overflow-hidden border-[var(--bokmoo-line)]',
                          viewMode === 'grid'
                            ? 'aspect-[1.28/1] border-b sm:aspect-[1.18/1]'
                            : 'aspect-[1.45/1] rounded-[1rem] border md:aspect-auto md:h-full md:rounded-[var(--bokmoo-radius-lg)]'
                        )}
                      >
                        <ProductMedia product={product} />
                      </div>

                      <div className={cn(viewMode === 'grid' ? 'p-5' : 'min-w-0')}>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-[var(--bokmoo-line)] px-3 py-1 text-[10px] tracking-[0.18em] text-[var(--bokmoo-gold)]">
                            {profile.cardEyebrow}
                          </span>
                          <span className="rounded-full border border-[var(--bokmoo-line)] px-3 py-1 text-[10px] tracking-[0.18em] text-[var(--bokmoo-copy)]">
                            {profile.deliveryLabel}
                          </span>
                        </div>

                        <h2 className="mt-4 text-[clamp(1.7rem,2vw,2.4rem)] leading-[1] tracking-[-0.04em] text-[var(--bokmoo-ink)]">
                          {product.name}
                        </h2>
                        <p className="mt-3 text-sm leading-6 text-[var(--bokmoo-copy)]">
                          {product.description || profile.summary}
                        </p>

                        <div className="mt-5 grid gap-2 sm:grid-cols-3">
                          {[
                            ['Coverage', profile.coverageLabel],
                            ['Plan', profile.planLabel],
                            ['Validity', profile.durationLabel],
                          ].map(([label, value]) => (
                            <div
                              key={label}
                              className="rounded-[var(--bokmoo-radius-md)] border border-[var(--bokmoo-line)] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_88%,black)] px-3 py-3"
                            >
                              <p className="text-[10px] tracking-[0.16em] text-[var(--bokmoo-copy-soft)]">{label}</p>
                              <p className="mt-2 text-sm font-medium text-[var(--bokmoo-ink)]">{value}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </button>

                    <div className={cn(viewMode === 'grid' ? 'px-5 pb-5' : 'md:w-[12rem]')}>
                      <div className="rounded-[1rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_16%,var(--bokmoo-line))] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_90%,black)] p-4">
                        <p className="text-[10px] tracking-[0.18em] text-[var(--bokmoo-copy-soft)]">
                          Starting at
                        </p>
                        <p className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[var(--bokmoo-ink)]">
                          ${Number(product.price || 0).toFixed(2)}
                        </p>
                        <p className="mt-2 text-xs text-[var(--bokmoo-copy)]">{profile.planBadge}</p>
                        <button
                          onClick={() => onAddToCart(product.id)}
                          className="mt-4 w-full rounded-full bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_82%,white),color-mix(in_oklab,var(--bokmoo-gold)_65%,black))] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-bg)]"
                          type="button"
                        >
                          Buy Now
                        </button>
                      </div>
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
              className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] text-[var(--bokmoo-ink)] disabled:opacity-40"
              type="button"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="rounded-full border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] px-5 py-3 text-[11px] font-semibold tracking-[0.18em] text-[var(--bokmoo-copy)]">
              Page {currentPage} / {displayTotalPages}
            </span>
            <button
              onClick={() => onPageChange(Math.min(displayTotalPages, currentPage + 1))}
              disabled={currentPage >= displayTotalPages}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] text-[var(--bokmoo-ink)] disabled:opacity-40"
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
