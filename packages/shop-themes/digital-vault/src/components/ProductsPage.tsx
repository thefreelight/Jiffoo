import React from 'react';
import { ChevronLeft, ChevronRight, Grid3X3, List, Search, Sparkles } from 'lucide-react';
import { cn } from '@jiffoo/ui';
import type { ProductsPageProps } from 'shared/src/types/theme';
import { getDigitalPreview } from '../lib/digital-fulfillment';

function getProductImage(product: any): string {
  if (!product?.images?.length) return '/placeholder-product.svg';
  const first = product.images[0];
  return typeof first === 'string' ? first : first?.url || '/placeholder-product.svg';
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
    return <div className="min-h-screen bg-[var(--vault-bg)]" />;
  }

  return (
    <div className="min-h-screen bg-[var(--vault-bg)] px-4 pb-16 pt-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1280px]">
        <section className="rounded-[var(--vault-radius-lg)] border border-[var(--vault-line)] bg-[linear-gradient(135deg,color-mix(in_oklab,var(--vault-primary-soft)_86%,white),var(--vault-surface))] p-6 shadow-[var(--vault-shadow)] sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--vault-line)] bg-[var(--vault-surface)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--vault-copy)]">
                <Sparkles className="h-4 w-4 text-[var(--vault-primary)]" />
                Virtual inventory
              </div>
              <h1 className="mt-5 text-[clamp(2.2rem,5vw,4.4rem)] font-black leading-[0.94] tracking-[-0.05em] text-[var(--vault-ink)]">
                Browse goods that deliver as soon as payment clears.
              </h1>
              <p className="mt-4 text-base leading-7 text-[var(--vault-copy)]">
                Every listing emphasizes what lands in the buyer account: code, credential, file, or access bundle.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-[minmax(16rem,1fr)_auto_auto]">
              <form onSubmit={submitSearch} className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--vault-copy-soft)]" />
                <input
                  value={searchQuery}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(event.target.value)}
                  placeholder="Search gift cards, keys, downloads..."
                  className="h-12 w-full rounded-full border border-[var(--vault-line)] bg-[var(--vault-surface)] pl-11 pr-4 text-sm text-[var(--vault-ink)] outline-none placeholder:text-[var(--vault-copy-soft)]"
                />
              </form>

              <select
                value={sortBy}
                onChange={(event: React.ChangeEvent<HTMLSelectElement>) => onSortChange(event.target.value)}
                className="h-12 rounded-full border border-[var(--vault-line)] bg-[var(--vault-surface)] px-4 text-sm font-medium text-[var(--vault-ink)] outline-none"
              >
                <option value="createdAt">Newest</option>
                <option value="price">Price</option>
                <option value="name">Name</option>
              </select>

              <div className="flex items-center rounded-full border border-[var(--vault-line)] bg-[var(--vault-surface)] p-1">
                <button
                  onClick={() => onViewModeChange('grid')}
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-full transition-colors',
                    viewMode === 'grid' ? 'bg-[var(--vault-primary)] text-white' : 'text-[var(--vault-copy)]'
                  )}
                >
                  <Grid3X3 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => onViewModeChange('list')}
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-full transition-colors',
                    viewMode === 'list' ? 'bg-[var(--vault-primary)] text-white' : 'text-[var(--vault-copy)]'
                  )}
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <span className="rounded-full border border-[var(--vault-line)] bg-[var(--vault-surface)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--vault-copy)]">
              {totalProducts} products
            </span>
            <span className="rounded-full border border-[var(--vault-line)] bg-[var(--vault-surface)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--vault-copy)]">
              Instant fulfillment focus
            </span>
          </div>
        </section>

        <section className="mt-8">
          {products.length === 0 ? (
            <div className="rounded-[var(--vault-radius-lg)] border border-dashed border-[var(--vault-line)] bg-[var(--vault-surface)] p-16 text-center text-[var(--vault-copy)]">
              No digital goods matched the current search.
            </div>
          ) : (
            <div
              className={cn(
                'grid gap-4',
                viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3' : 'grid-cols-1'
              )}
            >
              {products.map((product: any) => {
                const preview = getDigitalPreview(product);
                return (
                  <article
                    key={product.id}
                    className={cn(
                      'group overflow-hidden rounded-[var(--vault-radius-lg)] border border-[var(--vault-line)] bg-[var(--vault-surface)] shadow-[var(--vault-shadow)] transition-transform duration-300 hover:-translate-y-1',
                      viewMode === 'list' && 'grid gap-5 p-5 md:grid-cols-[13rem_minmax(0,1fr)_auto] md:items-center'
                    )}
                  >
                    <button
                      onClick={() => onProductClick(product.id)}
                      className={cn(
                        'text-left',
                        viewMode === 'grid' ? 'block h-full' : 'contents'
                      )}
                    >
                      <div className={cn(viewMode === 'grid' ? '' : 'md:self-stretch')}>
                        <img
                          src={getProductImage(product)}
                          alt={product.name}
                          className={cn(
                            'w-full object-cover',
                            viewMode === 'grid'
                              ? 'aspect-[1.3/1] border-b border-[var(--vault-line)]'
                              : 'h-full min-h-[11rem] rounded-[var(--vault-radius-md)]'
                          )}
                        />
                      </div>

                      <div className={cn(viewMode === 'grid' ? 'p-5' : 'min-w-0')}>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-[var(--vault-primary-soft)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--vault-primary-strong)]">
                            {preview.kindLabel}
                          </span>
                          <span className="rounded-full bg-[color:color-mix(in_oklab,var(--vault-accent)_22%,white)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--vault-ink)]">
                            {preview.etaLabel}
                          </span>
                        </div>

                        <h2 className="mt-4 text-2xl font-black tracking-[-0.04em] text-[var(--vault-ink)]">
                          {product.name}
                        </h2>
                        <p className="mt-3 line-clamp-2 text-sm leading-6 text-[var(--vault-copy)]">
                          {product.description || 'Digital asset with instant delivery and account-side access.'}
                        </p>

                        <div className="mt-5 flex flex-wrap gap-2">
                          {preview.artifactLabels.slice(0, 3).map((item) => (
                            <span
                              key={item}
                              className="rounded-full border border-[var(--vault-line)] px-3 py-1 text-[11px] font-medium text-[var(--vault-copy)]"
                            >
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>
                    </button>

                    <div className={cn(viewMode === 'grid' ? 'px-5 pb-5' : 'md:w-[11rem]')}>
                      <div className="rounded-[var(--vault-radius-md)] border border-[var(--vault-line)] bg-[var(--vault-bg)] p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--vault-copy-soft)]">
                          Delivery
                        </p>
                        <p className="mt-2 text-sm font-medium text-[var(--vault-ink)]">{preview.deliveryLabel}</p>
                        <p className="mt-4 text-2xl font-black tracking-[-0.04em] text-[var(--vault-ink)]">
                          ${Number(product.price || 0).toFixed(2)}
                        </p>
                        <button
                          onClick={() => onAddToCart(product.id)}
                          className="mt-4 w-full rounded-full bg-[var(--vault-primary)] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-white"
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
              className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--vault-line)] bg-[var(--vault-surface)] text-[var(--vault-ink)] disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="rounded-full border border-[var(--vault-line)] bg-[var(--vault-surface)] px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--vault-copy)]">
              Page {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage >= totalPages}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--vault-line)] bg-[var(--vault-surface)] text-[var(--vault-ink)] disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </nav>
        ) : null}
      </div>
    </div>
  );
});
