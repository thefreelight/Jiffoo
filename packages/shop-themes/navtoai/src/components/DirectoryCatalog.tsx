import React from 'react';
import { ChevronLeft, ChevronRight, Grid3X3, List, Search, Sparkles } from 'lucide-react';
import { cn } from '@jiffoo/ui';
import type { Product } from 'shared/src/types/product';
import { getToolDirectoryPreview } from '../lib/tool-directory';

interface DirectoryCatalogProps {
  products: Product[];
  isLoading: boolean;
  totalProducts: number;
  currentPage: number;
  totalPages: number;
  sortBy: string;
  viewMode: 'grid' | 'list';
  title: string;
  description: string;
  eyebrow?: string;
  searchQueryLabel?: string;
  canSearch?: boolean;
  onSortChange: (sortBy: string) => void;
  onViewModeChange: (mode: 'grid' | 'list') => void;
  onPageChange: (page: number) => void;
  onAddToCart: (productId: string) => Promise<void>;
  onProductClick: (productId: string) => void;
  onSearch?: (query: string) => void;
}

export function DirectoryCatalog({
  products,
  isLoading,
  totalProducts,
  currentPage,
  totalPages,
  sortBy,
  viewMode,
  title,
  description,
  eyebrow = 'AI directory',
  searchQueryLabel,
  canSearch = true,
  onSortChange,
  onViewModeChange,
  onPageChange,
  onAddToCart,
  onProductClick,
  onSearch,
}: DirectoryCatalogProps) {
  const [searchQuery, setSearchQuery] = React.useState(searchQueryLabel || '');

  React.useEffect(() => {
    setSearchQuery(searchQueryLabel || '');
  }, [searchQueryLabel]);

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSearch || !onSearch || !searchQuery.trim()) return;
    onSearch(searchQuery.trim());
  };

  if (isLoading) {
    return <div className="min-h-screen bg-[var(--navtoai-bg)]" />;
  }

  return (
    <div className="min-h-screen bg-[var(--navtoai-bg)] px-4 pb-16 pt-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1280px]">
        <section className="rounded-[var(--navtoai-radius-lg)] border border-[var(--navtoai-line)] bg-[linear-gradient(135deg,color-mix(in_oklab,var(--navtoai-primary-soft)_84%,white),var(--navtoai-surface))] p-6 shadow-[var(--navtoai-shadow)] sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--navtoai-line)] bg-[var(--navtoai-surface)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--navtoai-copy)]">
                <Sparkles className="h-4 w-4 text-[var(--navtoai-primary)]" />
                {eyebrow}
              </div>
              <h1 className="mt-5 text-[clamp(2.2rem,5vw,4.4rem)] font-black leading-[0.94] tracking-[-0.05em] text-[var(--navtoai-ink)]">
                {title}
              </h1>
              <p className="mt-4 text-base leading-7 text-[var(--navtoai-copy)]">
                {description}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-[minmax(16rem,1fr)_auto_auto]">
              {canSearch ? (
                <form onSubmit={submitSearch} className="relative">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--navtoai-copy-soft)]" />
                  <input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search chat, code, image, video..."
                    className="h-12 w-full rounded-full border border-[var(--navtoai-line)] bg-[var(--navtoai-surface)] pl-11 pr-4 text-sm text-[var(--navtoai-ink)] outline-none placeholder:text-[var(--navtoai-copy-soft)]"
                  />
                </form>
              ) : (
                <div className="flex h-12 items-center rounded-full border border-[var(--navtoai-line)] bg-[var(--navtoai-surface)] px-5 text-sm font-medium text-[var(--navtoai-copy)]">
                  {searchQueryLabel ? `Search: ${searchQueryLabel}` : 'Curated directory view'}
                </div>
              )}

              <select
                value={sortBy}
                onChange={(event: React.ChangeEvent<HTMLSelectElement>) => onSortChange(event.target.value)}
                className="h-12 rounded-full border border-[var(--navtoai-line)] bg-[var(--navtoai-surface)] px-4 text-sm font-medium text-[var(--navtoai-ink)] outline-none"
              >
                <option value="createdAt">Newest</option>
                <option value="price">Price</option>
                <option value="name">Name</option>
              </select>

              <div className="flex items-center rounded-full border border-[var(--navtoai-line)] bg-[var(--navtoai-surface)] p-1">
                <button
                  type="button"
                  onClick={() => onViewModeChange('grid')}
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-full transition-colors',
                    viewMode === 'grid' ? 'bg-[var(--navtoai-primary)] text-white' : 'text-[var(--navtoai-copy)]'
                  )}
                >
                  <Grid3X3 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onViewModeChange('list')}
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-full transition-colors',
                    viewMode === 'list' ? 'bg-[var(--navtoai-primary)] text-white' : 'text-[var(--navtoai-copy)]'
                  )}
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <span className="rounded-full border border-[var(--navtoai-line)] bg-[var(--navtoai-surface)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--navtoai-copy)]">
              {totalProducts} listings
            </span>
            <span className="rounded-full border border-[var(--navtoai-line)] bg-[var(--navtoai-surface)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--navtoai-copy)]">
              Directory-first presentation
            </span>
            {searchQueryLabel ? (
              <span className="rounded-full border border-[var(--navtoai-line)] bg-[var(--navtoai-surface)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--navtoai-primary-strong)]">
                Query: {searchQueryLabel}
              </span>
            ) : null}
          </div>
        </section>

        <section className="mt-8">
          {products.length === 0 ? (
            <div className="rounded-[var(--navtoai-radius-lg)] border border-dashed border-[var(--navtoai-line)] bg-[var(--navtoai-surface)] p-16 text-center text-[var(--navtoai-copy)]">
              No tools matched the current directory view.
            </div>
          ) : (
            <div
              className={cn(
                'grid gap-4',
                viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3' : 'grid-cols-1'
              )}
            >
              {products.map((product) => {
                const preview = getToolDirectoryPreview(product);

                return (
                  <article
                    key={product.id}
                    className={cn(
                      'overflow-hidden rounded-[var(--navtoai-radius-lg)] border border-[var(--navtoai-line)] bg-[var(--navtoai-surface)] shadow-[var(--navtoai-shadow)] transition-transform duration-300 hover:-translate-y-1',
                      viewMode === 'list' && 'grid gap-5 p-5 md:grid-cols-[13rem_minmax(0,1fr)_auto] md:items-center'
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => onProductClick(product.id)}
                      className={cn('text-left', viewMode === 'grid' ? 'block h-full w-full' : 'contents')}
                    >
                      <div className={cn(viewMode === 'grid' ? '' : 'md:self-stretch')}>
                        <img
                          src={preview.imageUrl}
                          alt={product.name}
                          className={cn(
                            'w-full object-cover',
                            viewMode === 'grid'
                              ? 'aspect-[1.28/1] border-b border-[var(--navtoai-line)]'
                              : 'h-full min-h-[11rem] rounded-[var(--navtoai-radius-md)]'
                          )}
                        />
                      </div>

                      <div className={cn(viewMode === 'grid' ? 'p-5' : 'min-w-0')}>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-[var(--navtoai-primary-soft)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--navtoai-primary-strong)]">
                            {preview.categoryLabel}
                          </span>
                          <span className="rounded-full bg-[color:color-mix(in_oklab,var(--navtoai-accent)_18%,white)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--navtoai-ink)]">
                            {preview.categoryAccent}
                          </span>
                        </div>

                        <h2 className="mt-4 text-2xl font-black tracking-[-0.04em] text-[var(--navtoai-ink)]">
                          {product.name}
                        </h2>
                        <p className="mt-2 text-sm font-medium text-[var(--navtoai-copy-soft)]">
                          {preview.primarySpec}
                        </p>
                        <p className="mt-3 line-clamp-2 text-sm leading-6 text-[var(--navtoai-copy)]">
                          {preview.summary}
                        </p>

                        <div className="mt-5 flex flex-wrap gap-2">
                          {preview.tags.map((item) => (
                            <span
                              key={item}
                              className="rounded-full border border-[var(--navtoai-line)] px-3 py-1 text-[11px] font-medium text-[var(--navtoai-copy)]"
                            >
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>
                    </button>

                    <div className={cn(viewMode === 'grid' ? 'px-5 pb-5' : 'md:w-[12rem]')}>
                      <div className="rounded-[var(--navtoai-radius-md)] border border-[var(--navtoai-line)] bg-[var(--navtoai-bg)] p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--navtoai-copy-soft)]">
                          Signal
                        </p>
                        <p className="mt-2 text-sm font-medium text-[var(--navtoai-ink)]">{preview.trustLabel}</p>
                        <p className="mt-4 text-2xl font-black tracking-[-0.04em] text-[var(--navtoai-ink)]">
                          ${Number(product.price || 0).toFixed(2)}
                        </p>
                        <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--navtoai-copy-soft)]">
                          {preview.pricingLabel}
                        </p>
                        <div className="mt-4 grid gap-2">
                          <button
                            type="button"
                            onClick={() => onAddToCart(product.id)}
                            className="w-full rounded-full bg-[var(--navtoai-primary)] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-white"
                          >
                            Add to stack
                          </button>
                          <button
                            type="button"
                            onClick={() => onProductClick(product.id)}
                            className="w-full rounded-full border border-[var(--navtoai-line)] bg-[var(--navtoai-surface)] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--navtoai-ink)]"
                          >
                            Open detail
                          </button>
                        </div>
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
              type="button"
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--navtoai-line)] bg-[var(--navtoai-surface)] text-[var(--navtoai-ink)] disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="rounded-full border border-[var(--navtoai-line)] bg-[var(--navtoai-surface)] px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--navtoai-copy)]">
              Page {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage >= totalPages}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--navtoai-line)] bg-[var(--navtoai-surface)] text-[var(--navtoai-ink)] disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </nav>
        ) : null}
      </div>
    </div>
  );
}
