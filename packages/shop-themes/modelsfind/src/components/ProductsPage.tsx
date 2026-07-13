import React from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Compass,
  Grid3X3,
  Heart,
  List,
  Loader2,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import type { Product, ProductImage } from 'shared/src/types/product';
import type { ProductsPageProps } from 'shared/src/types/theme';
import { heroRegions } from '../site';

function getProductImage(product: Product): string {
  const mainImage = product.images?.find((image) => image.isMain) || product.images?.[0];
  return (mainImage as ProductImage | undefined)?.url || '/placeholder-product.svg';
}

function getProductRegion(product: Product): string {
  const regionTag = product.tags?.find((tag) => heroRegions.some((region) => tag.toLowerCase().includes(region.toLowerCase())));
  return regionTag || product.category?.name || 'Model directory';
}

function getProductSubtitle(product: Product): string {
  return product.tags?.slice(0, 2).join(' • ') || product.description || 'Curated model profile';
}

function formatPrice(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value || 0);
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
  onProductClick,
  onSearch,
}: ProductsPageProps) {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [activeRegion, setActiveRegion] = React.useState<string>('China');
  const regionOptions = React.useMemo(() => heroRegions, []);

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSearch?.(searchQuery.trim());
  };

  const handleRegionClick = (region: string) => {
    setActiveRegion(region);
    onSearch?.(region);
  };

  if (isLoading) {
    return (
      <div className="modelsfind-shell flex min-h-screen items-center justify-center [font-family:var(--modelsfind-body)] text-[var(--modelsfind-ink)]">
        <div className="text-center">
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-[var(--modelsfind-primary)]" />
          <p className="mt-4 text-[11px] uppercase tracking-[0.28em] text-[var(--modelsfind-copy-soft)]">Loading profiles</p>
        </div>
      </div>
    );
  }

  return (
    <div className="modelsfind-shell min-h-screen px-4 pb-24 pt-20 [font-family:var(--modelsfind-body)] text-[var(--modelsfind-ink)] sm:px-6 sm:pt-24 lg:px-8">
      <div className="mx-auto max-w-[1040px]">
        <div className="modelsfind-frame overflow-hidden rounded-[2rem] border border-[var(--modelsfind-line-strong)] bg-[rgba(10,8,12,0.96)]">
          <div className="grid md:grid-cols-[10.5rem_minmax(0,1fr)]">
            <aside className="hidden border-r border-[var(--modelsfind-line)] bg-[rgba(20,16,22,0.72)] px-4 py-5 md:block">
              <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--modelsfind-copy-soft)]">Regions</p>
              <div className="mt-4 grid gap-2">
                {regionOptions.map((region) => (
                  <button
                    key={region}
                    type="button"
                    onClick={() => handleRegionClick(region)}
                    className={[
                      'rounded-[0.9rem] border px-3 py-3 text-left text-[11px] uppercase tracking-[0.18em] transition-colors',
                      activeRegion === region
                        ? 'border-[var(--modelsfind-primary)] bg-[var(--modelsfind-primary-soft)] text-[var(--modelsfind-ink)]'
                        : 'border-[var(--modelsfind-line)] text-[var(--modelsfind-copy-soft)] hover:text-[var(--modelsfind-copy)]',
                    ].join(' ')}
                  >
                    {region}
                  </button>
                ))}
              </div>

              <div className="mt-6 rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.02)] p-4">
                <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--modelsfind-copy-soft)]">Directory</p>
                <p className="mt-3 [font-family:var(--modelsfind-display)] text-[2rem] leading-none text-[var(--modelsfind-ink)]">
                  {totalProducts}
                </p>
                <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]">Profiles indexed</p>
              </div>
            </aside>

            <div className="p-4 md:p-5">
              <div className="flex items-center justify-between gap-4 border-b border-[var(--modelsfind-line)] pb-4">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.26em] text-[var(--modelsfind-copy-soft)]">The Collection</p>
                  <h1 className="mt-2 [font-family:var(--modelsfind-display)] text-[2.3rem] leading-none tracking-[-0.04em] text-[var(--modelsfind-ink)] md:text-[2.8rem]">
                    Featured directory
                  </h1>
                  <p className="mt-2 text-xs text-[var(--modelsfind-copy-soft)]">Showing {totalProducts} private editorials in {activeRegion}</p>
                </div>

                <div className="hidden items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-[var(--modelsfind-copy-soft)] md:flex">
                  <Compass className="h-3.5 w-3.5 text-[var(--modelsfind-primary)]" />
                  Curated nightly
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-3 md:hidden">
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {regionOptions.map((region) => (
                    <button
                      key={region}
                      type="button"
                      onClick={() => handleRegionClick(region)}
                      className={[
                        'whitespace-nowrap rounded-full border px-3 py-2 text-[10px] uppercase tracking-[0.18em]',
                        activeRegion === region
                          ? 'border-[var(--modelsfind-primary)] bg-[var(--modelsfind-primary-soft)] text-[var(--modelsfind-ink)]'
                          : 'border-[var(--modelsfind-line)] text-[var(--modelsfind-copy)]',
                      ].join(' ')}
                    >
                      {region}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4 rounded-[1.2rem] border border-[var(--modelsfind-line)] bg-[rgba(17,14,20,0.86)] p-3 shadow-[var(--modelsfind-card-shadow)]">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <form onSubmit={handleSearchSubmit} className="relative flex-1">
                    <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--modelsfind-copy-soft)]" />
                    <input
                      type="search"
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Search by mood, name, region, or album"
                      className="h-11 w-full rounded-full border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] pl-11 pr-4 text-sm text-[var(--modelsfind-ink)] outline-none placeholder:text-[var(--modelsfind-copy-soft)] focus:border-[var(--modelsfind-primary)]"
                    />
                  </form>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="inline-flex h-11 items-center gap-2 rounded-full border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-4 text-[10px] uppercase tracking-[0.22em] text-[var(--modelsfind-copy)]">
                      <SlidersHorizontal className="h-4 w-4 text-[var(--modelsfind-primary)]" />
                      {totalProducts} indexed
                    </div>

                    <select
                      value={sortBy}
                      onChange={(event) => onSortChange(event.target.value)}
                      className="h-11 rounded-full border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-4 text-xs uppercase tracking-[0.16em] text-[var(--modelsfind-ink)] outline-none"
                    >
                      <option value="createdAt">Newest</option>
                      <option value="name">Name</option>
                      <option value="price">Price</option>
                    </select>

                    <div className="inline-flex items-center rounded-full border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] p-1">
                      <button
                        type="button"
                        onClick={() => onViewModeChange('grid')}
                        className={[
                          'flex h-9 w-9 items-center justify-center rounded-full transition-colors',
                          viewMode === 'grid'
                            ? 'bg-[var(--modelsfind-primary)] text-white'
                            : 'text-[var(--modelsfind-copy)] hover:text-[var(--modelsfind-ink)]',
                        ].join(' ')}
                        aria-label="Grid view"
                      >
                        <Grid3X3 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onViewModeChange('list')}
                        className={[
                          'flex h-9 w-9 items-center justify-center rounded-full transition-colors',
                          viewMode === 'list'
                            ? 'bg-[var(--modelsfind-primary)] text-white'
                            : 'text-[var(--modelsfind-copy)] hover:text-[var(--modelsfind-ink)]',
                        ].join(' ')}
                        aria-label="List view"
                      >
                        <List className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {products.length === 0 ? (
                <div className="rounded-[1.6rem] border border-[var(--modelsfind-line)] bg-[rgba(16,13,18,0.9)] px-6 py-20 text-center shadow-[var(--modelsfind-card-shadow)] mt-4">
                  <p className="text-[11px] uppercase tracking-[0.26em] text-[var(--modelsfind-copy-soft)]">No results</p>
                  <h2 className="mt-4 [font-family:var(--modelsfind-display)] text-4xl text-[var(--modelsfind-ink)]">
                    No profiles match right now.
                  </h2>
                  <p className="mt-3 text-sm text-[var(--modelsfind-copy)]">Try another keyword, region, or sort order.</p>
                </div>
              ) : (
                <div
                  className={[
                    'mt-4 grid gap-3',
                    viewMode === 'grid' ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-1',
                  ].join(' ')}
                >
                  {products.map((product) => (
                    <article
                      key={product.id}
                      className={[
                        'group overflow-hidden rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(19,15,22,0.92)] transition-transform duration-300 hover:-translate-y-1',
                        viewMode === 'list' ? 'grid gap-0 md:grid-cols-[12rem_minmax(0,1fr)]' : '',
                      ].join(' ')}
                    >
                      <button
                        type="button"
                        onClick={() => onProductClick(product.id)}
                        className="block w-full text-left"
                      >
                        <div className={viewMode === 'list' ? 'h-full min-h-[14rem] relative overflow-hidden' : 'relative aspect-[0.78] overflow-hidden'}>
                          <img
                            src={getProductImage(product)}
                            alt={product.name}
                            className="h-full w-full object-cover grayscale transition-transform duration-500 group-hover:scale-[1.03]"
                          />
                          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,8,12,0.04),rgba(10,8,12,0.76))]" />
                          <div className="absolute left-3 right-3 top-3 flex items-center justify-between gap-2">
                            <span className="rounded-full border border-[var(--modelsfind-line-strong)] bg-[rgba(18,14,20,0.74)] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--modelsfind-primary)]">
                              {getProductRegion(product)}
                            </span>
                            <Heart className="h-3.5 w-3.5 text-[var(--modelsfind-primary)]" />
                          </div>
                        </div>
                      </button>

                      <div className="flex flex-col justify-between p-3 md:p-4">
                        <div>
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h3 className="[font-family:var(--modelsfind-display)] text-[1.25rem] leading-none tracking-[-0.04em] text-[var(--modelsfind-ink)] md:text-[1.5rem]">
                                {product.name}
                              </h3>
                              <p className="mt-1 text-[11px] leading-5 text-[var(--modelsfind-copy-soft)]">
                                {getProductSubtitle(product)}
                              </p>
                            </div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--modelsfind-copy)]">
                              {formatPrice(product.price)}
                            </p>
                          </div>

                          {viewMode === 'list' ? (
                            <p className="mt-3 text-sm leading-6 text-[var(--modelsfind-copy)]">{product.description}</p>
                          ) : null}
                        </div>

                        <div className="mt-4 flex gap-2">
                          <button
                            type="button"
                            onClick={() => onProductClick(product.id)}
                            className="inline-flex min-h-9 w-full items-center justify-center rounded-full bg-[linear-gradient(145deg,color-mix(in_oklab,var(--modelsfind-primary)_78%,white),color-mix(in_oklab,var(--modelsfind-primary)_72%,black))] text-[9px] font-semibold uppercase tracking-[0.22em] text-white"
                          >
                            View profile
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}

              {totalPages > 1 ? (
                <div className="mt-4 flex flex-col items-center justify-between gap-4 rounded-[1.2rem] border border-[var(--modelsfind-line)] bg-[rgba(17,14,20,0.88)] px-5 py-4 sm:flex-row">
                  <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--modelsfind-copy-soft)]">
                    Page {currentPage} of {totalPages}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="inline-flex h-10 items-center gap-2 rounded-full border border-[var(--modelsfind-line)] px-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--modelsfind-copy)] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Prev
                    </button>
                    <button
                      type="button"
                      onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      className="inline-flex h-10 items-center gap-2 rounded-full border border-[var(--modelsfind-line)] px-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--modelsfind-copy)] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Next
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
