import React from 'react';
import { ChevronLeft, ChevronRight, Grid3X3, List, Search, ShieldCheck } from 'lucide-react';
import { cn } from '@jiffoo/ui';
import type { Product } from 'shared/src/types/product';
import type { ProductsPageProps } from 'shared/src/types/theme';
import { getBokmooTravelProfile } from '../lib/digital-fulfillment';

function getProductImage(product: Product): string | null {
  if (!product?.images?.length) return null;
  const primary = product.images.find((image) => image.isMain) || product.images[0];
  return primary?.url || null;
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
        <span className="rounded-full border border-[var(--bokmoo-line)] px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-[var(--bokmoo-gold)]">
          {profile.cardEyebrow}
        </span>
        <span className="rounded-full border border-[var(--bokmoo-line)] px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-[var(--bokmoo-copy)]">
          {profile.planBadge}
        </span>
      </div>
      <div>
        <p className="text-sm uppercase tracking-[0.22em] text-[var(--bokmoo-copy-soft)]">Bokmoo</p>
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
}: ProductsPageProps) {
  const [searchQuery, setSearchQuery] = React.useState('');

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    onSearch?.(searchQuery.trim());
  };

  if (isLoading) {
    return <div className="min-h-screen bg-[var(--bokmoo-bg)]" />;
  }

  return (
    <div className="min-h-screen bg-[var(--bokmoo-bg)] px-4 pb-16 pt-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1280px]">
        <section className="rounded-[var(--bokmoo-radius-xl)] border border-[var(--bokmoo-line)] bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_10%,transparent),transparent_34%),var(--bokmoo-bg-elevated)] p-6 shadow-[var(--bokmoo-shadow)] sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--bokmoo-copy)]">
                <ShieldCheck className="h-4 w-4 text-[var(--bokmoo-gold)]" />
                Curated travel plans
              </div>
              <h1 className="mt-5 text-[clamp(2.3rem,5vw,4.6rem)] leading-[0.95] tracking-[-0.05em] text-[var(--bokmoo-ink)]">
                Choose the plan you want before you leave, not after you land.
              </h1>
              <p className="mt-4 text-base leading-7 text-[var(--bokmoo-copy)]">
                Premium destination and regional eSIM bundles, presented with the clarity of a travel brief instead of a price wall.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-[minmax(16rem,1fr)_auto_auto]">
              <form onSubmit={submitSearch} className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--bokmoo-copy-soft)]" />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search destinations or passes..."
                  className="h-12 w-full rounded-full border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] pl-11 pr-4 text-sm text-[var(--bokmoo-ink)] outline-none placeholder:text-[var(--bokmoo-copy-soft)]"
                />
              </form>

              <select
                value={sortBy}
                onChange={(event) => onSortChange(event.target.value)}
                className="h-12 rounded-full border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] px-4 text-sm font-medium text-[var(--bokmoo-ink)] outline-none"
              >
                <option value="createdAt">Newest</option>
                <option value="price">Price</option>
                <option value="name">Name</option>
              </select>

              <div className="flex items-center rounded-full border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] p-1">
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

          <div className="mt-6 flex flex-wrap gap-2">
            <span className="rounded-full border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-copy)]">
              {totalProducts} plans
            </span>
            <span className="rounded-full border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-copy)]">
              Instant QR delivery
            </span>
            <span className="rounded-full border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-copy)]">
              Device-ready before takeoff
            </span>
          </div>
        </section>

        <section className="mt-8">
          {products.length === 0 ? (
            <div className="rounded-[var(--bokmoo-radius-xl)] border border-dashed border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] p-16 text-center text-[var(--bokmoo-copy)]">
              No travel plans matched the current search.
            </div>
          ) : (
            <div
              className={cn(
                'grid gap-4',
                viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3' : 'grid-cols-1'
              )}
            >
              {products.map((product) => {
                const profile = getBokmooTravelProfile(product);

                return (
                  <article
                    key={product.id}
                    className={cn(
                      'overflow-hidden rounded-[var(--bokmoo-radius-xl)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] shadow-[var(--bokmoo-shadow)] transition-transform duration-300 hover:-translate-y-1',
                      viewMode === 'list' && 'grid gap-5 p-5 md:grid-cols-[14rem_minmax(0,1fr)_12rem] md:items-center'
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
                            ? 'aspect-[1.18/1] border-b'
                            : 'h-full rounded-[var(--bokmoo-radius-lg)] border'
                        )}
                      >
                        <ProductMedia product={product} />
                      </div>

                      <div className={cn(viewMode === 'grid' ? 'p-5' : 'min-w-0')}>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-[var(--bokmoo-line)] px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-[var(--bokmoo-gold)]">
                            {profile.cardEyebrow}
                          </span>
                          <span className="rounded-full border border-[var(--bokmoo-line)] px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-[var(--bokmoo-copy)]">
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
                              className="rounded-[var(--bokmoo-radius-md)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] px-3 py-3"
                            >
                              <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--bokmoo-copy-soft)]">{label}</p>
                              <p className="mt-2 text-sm font-medium text-[var(--bokmoo-ink)]">{value}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </button>

                    <div className={cn(viewMode === 'grid' ? 'px-5 pb-5' : 'md:w-[12rem]')}>
                      <div className="rounded-[var(--bokmoo-radius-lg)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] p-4">
                        <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--bokmoo-copy-soft)]">
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
                          Add to cart
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {totalPages > 1 ? (
          <nav className="mt-10 flex items-center justify-center gap-2">
            <button
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] text-[var(--bokmoo-ink)] disabled:opacity-40"
              type="button"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="rounded-full border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-copy)]">
              Page {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage >= totalPages}
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
