import React from 'react';
import { ChevronLeft, ChevronRight, Grid3X3, List, Search } from 'lucide-react';
import { cn } from '@jiffoo/ui';
import type { Product } from '../types/product';
import type { ProductsPageProps } from '../types/theme';
import { getDigitalPreview } from '../lib/digital-fulfillment';

function getProductImage(product: Product): string {
  if (!product?.images?.length) return '/placeholder-product.svg';
  const first = product.images[0];
  return typeof first === 'string' ? first : first?.url || '/placeholder-product.svg';
}

function getCategoryGroups(products: Product[]) {
  const map = new Map<string, { id: string; name: string; count: number }>();

  for (const product of products) {
    const category = product.category;
    if (!category?.id) continue;
    const existing = map.get(category.id);
    if (existing) {
      existing.count += 1;
    } else {
      map.set(category.id, {
        id: category.id,
        name: category.name,
        count: 1,
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

function filterProducts(products: Product[], query: string, categoryId: string | null) {
  const normalizedQuery = query.trim().toLowerCase();

  return products.filter((product) => {
    if (categoryId && product.category?.id !== categoryId) {
      return false;
    }

    if (!normalizedQuery) return true;

    const haystack = [
      product.name,
      product.description,
      product.category?.name,
      ...(product.tags || []),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return haystack.includes(normalizedQuery);
  });
}

function sortProducts(products: Product[], sortBy: string) {
  const next = [...products];

  if (sortBy === 'price') {
    next.sort((a, b) => a.price - b.price);
    return next;
  }

  if (sortBy === 'name') {
    next.sort((a, b) => a.name.localeCompare(b.name));
    return next;
  }

  next.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  return next;
}

function getPurchaseMode(product: Product): string {
  const mode = String((product as Record<string, unknown>)?.purchaseType ?? (product as Record<string, unknown>)?.purchase_type ?? '').toLowerCase();
  return mode === 'guest' ? 'Guest checkout' : 'Member checkout';
}

function getStockLabel(product: Product): string {
  const record = product as Record<string, unknown>;
  const inventory = (record.inventory as Record<string, unknown> | undefined)?.available;
  const stock = Number(inventory ?? record.stock ?? 0);
  if (!Number.isFinite(stock) || stock <= 0) return 'Out of stock';
  if (stock <= 5) return `Only ${stock} left`;
  return 'In stock';
}

function getAccentTag(product: Product): string | null {
  const tags = Array.isArray(product.tags) ? product.tags : [];
  return typeof tags[0] === 'string' && tags[0].trim() ? tags[0].trim() : null;
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
  const [selectedCategoryId, setSelectedCategoryId] = React.useState<string | null>(null);
  const categories = React.useMemo(() => getCategoryGroups(products), [products]);

  const visibleProducts = React.useMemo(() => {
    const filtered = filterProducts(products, searchQuery, selectedCategoryId);
    return sortProducts(filtered, sortBy);
  }, [products, searchQuery, selectedCategoryId, sortBy]);

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    onSearch?.(searchQuery.trim());
  };

  if (isLoading) {
    return <div className="min-h-screen bg-[var(--vault-bg)]" />;
  }

  return (
    <div className="min-h-screen bg-[var(--vault-bg)] px-4 pb-16 pt-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1280px]">
        <div className="mb-10 border-b border-[var(--vault-line)] pb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--vault-copy-soft)]">Digital catalog</p>
          <h1 className="mx-auto mt-4 max-w-[14ch] text-[clamp(2.4rem,4.6vw,4.6rem)] font-black leading-[0.95] tracking-[-0.05em] text-[var(--vault-ink)]">
            Browse digital goods by category before you buy.
          </h1>
          <p className="mx-auto mt-4 max-w-3xl text-sm leading-7 text-[var(--vault-copy)] sm:text-base">
            Filter by category, skim a denser product list, and verify delivery type before jumping into checkout.
          </p>
        </div>

        <div className="flex flex-col gap-8 lg:flex-row">
          <aside className="lg:w-64 lg:flex-shrink-0">
            <div className="rounded-[var(--vault-radius-lg)] border border-[var(--vault-line)] bg-[var(--vault-surface)] p-5 shadow-[var(--vault-shadow-soft)] lg:sticky lg:top-24">
              <div className="space-y-4">
                <div>
                  <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--vault-copy-soft)]">Categories</h2>
                  <p className="mt-2 text-sm leading-6 text-[var(--vault-copy)]">
                    Narrow the catalog the same way a digital-goods storefront should: by format first.
                  </p>
                </div>

                <form onSubmit={submitSearch} className="relative">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--vault-copy-soft)]" />
                  <input
                    value={searchQuery}
                    onChange={(event: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(event.target.value)}
                    placeholder="Search codes, accounts..."
                    className="h-11 w-full rounded-xl border border-[var(--vault-line)] bg-[var(--vault-bg)] pl-11 pr-4 text-sm text-[var(--vault-ink)] outline-none placeholder:text-[var(--vault-copy-soft)]"
                  />
                </form>
              </div>

              <div className="mt-4 grid gap-2">
                <button
                  onClick={() => setSelectedCategoryId(null)}
                  className={cn(
                    'rounded-xl px-4 py-3 text-left text-sm font-medium transition-colors',
                    selectedCategoryId === null
                      ? 'bg-[var(--vault-primary)] text-white'
                      : 'bg-[var(--vault-surface-alt)] text-[var(--vault-ink)] hover:bg-[var(--vault-primary-soft)]'
                  )}
                >
                  All categories
                </button>
                {categories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => setSelectedCategoryId(category.id)}
                    className={cn(
                      'rounded-xl px-4 py-3 text-left text-sm font-medium transition-colors',
                      selectedCategoryId === category.id
                        ? 'bg-[var(--vault-primary)] text-white'
                        : 'bg-[var(--vault-surface-alt)] text-[var(--vault-ink)] hover:bg-[var(--vault-primary-soft)]'
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate">{category.name}</span>
                      <span className="text-xs opacity-70">{category.count}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </aside>

          <main className="min-w-0 flex-1">
            <div className="mb-6 flex flex-col gap-4 rounded-[var(--vault-radius-lg)] border border-[var(--vault-line)] bg-[var(--vault-surface)] p-5 shadow-[var(--vault-shadow-soft)] xl:flex-row xl:items-center xl:justify-between">
              <div className="flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--vault-copy-soft)]">
                  Catalog view
                </p>
                <p className="mt-2 text-sm leading-6 text-[var(--vault-copy)]">
                  {selectedCategoryId
                    ? `${visibleProducts.length} products in the selected category`
                    : `${visibleProducts.length} products visible across the storefront`}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-xl bg-[var(--vault-surface-alt)] px-4 py-3 text-sm font-medium text-[var(--vault-copy)]">
                  {visibleProducts.length} visible · {totalProducts} total
                </span>
                <select
                  value={sortBy}
                  onChange={(event: React.ChangeEvent<HTMLSelectElement>) => onSortChange(event.target.value)}
                  className="h-12 rounded-xl border border-[var(--vault-line)] bg-[var(--vault-bg)] px-4 text-sm font-medium text-[var(--vault-ink)] outline-none"
                >
                  <option value="createdAt">Newest</option>
                  <option value="price">Price</option>
                  <option value="name">Name</option>
                </select>
                <div className="flex items-center rounded-xl border border-[var(--vault-line)] bg-[var(--vault-bg)] p-1">
                  <button
                    onClick={() => onViewModeChange('grid')}
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-lg transition-colors',
                      viewMode === 'grid' ? 'bg-[var(--vault-primary)] text-white' : 'text-[var(--vault-copy)]'
                    )}
                  >
                    <Grid3X3 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => onViewModeChange('list')}
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-lg transition-colors',
                      viewMode === 'list' ? 'bg-[var(--vault-primary)] text-white' : 'text-[var(--vault-copy)]'
                    )}
                  >
                    <List className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {visibleProducts.length === 0 ? (
              <div className="rounded-[var(--vault-radius-lg)] border border-dashed border-[var(--vault-line)] bg-[var(--vault-surface)] p-16 text-center text-[var(--vault-copy)]">
                No digital goods matched the current search.
              </div>
            ) : (
              <div className={cn('grid gap-4', viewMode === 'grid' ? 'grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3' : 'grid-cols-1')}>
                {visibleProducts.map((product) => {
                  const preview = getDigitalPreview(product);
                  const accentTag = getAccentTag(product);
                  return (
                    <article
                      key={product.id}
                      className={cn(
                        'overflow-hidden rounded-[var(--vault-radius-lg)] border border-[var(--vault-line)] bg-[var(--vault-surface)] shadow-[var(--vault-shadow-soft)] transition-all hover:-translate-y-1 hover:shadow-[var(--vault-shadow)]',
                        viewMode === 'list' && 'grid gap-4 p-4 md:grid-cols-[7rem_minmax(0,1fr)_auto] md:items-center'
                      )}
                    >
                      <button
                        onClick={() => onProductClick(product.id)}
                        className={cn(viewMode === 'grid' ? 'block text-left' : 'contents')}
                      >
                        <div className="relative">
                          {accentTag ? (
                            <span className="absolute right-3 top-3 z-10 rounded-full bg-black/62 px-3 py-1 text-[11px] font-semibold tracking-[0.04em] text-white backdrop-blur-sm">
                              {accentTag}
                            </span>
                          ) : null}
                          <img
                            src={getProductImage(product)}
                            alt={product.name}
                            className={cn(
                              'w-full object-cover',
                              viewMode === 'grid'
                                ? 'aspect-[16/10] border-b border-[var(--vault-line)]'
                                : 'h-full min-h-[7rem] rounded-xl'
                            )}
                          />
                        </div>

                        <div className={cn(viewMode === 'grid' ? 'p-5' : 'min-w-0')}>
                          <p className="text-[12px] leading-6 text-[var(--vault-copy-soft)]">
                            {product.category?.name || 'Digital goods'} · {preview.kindLabel}
                          </p>

                          <h2 className={cn('font-bold tracking-tight text-[var(--vault-ink)]', viewMode === 'grid' ? 'mt-3 text-xl' : 'text-base')}>
                            {product.name}
                          </h2>
                          <p className={cn('text-sm leading-6 text-[var(--vault-copy)]', viewMode === 'grid' ? 'mt-2 line-clamp-2 min-h-[3rem]' : 'mt-1 line-clamp-1')}>
                            {product.description || 'Digital asset with immediate post-payment delivery.'}
                          </p>

                          <div className={cn('flex flex-wrap gap-x-3 gap-y-2 text-[11px] uppercase tracking-[0.12em] text-[var(--vault-copy-soft)]', viewMode === 'grid' ? 'mt-4' : 'mt-3')}>
                            <span>{getPurchaseMode(product)}</span>
                            <span>{preview.deliveryLabel}</span>
                            <span>{getStockLabel(product)}</span>
                          </div>

                          {preview.artifactLabels[0] ? (
                            <p className={cn('text-sm text-[var(--vault-copy)]', viewMode === 'grid' ? 'mt-3' : 'mt-2')}>
                              Includes {preview.artifactLabels.slice(0, 2).join(' + ')}.
                            </p>
                          ) : null}
                        </div>
                      </button>

                      <div className={cn(viewMode === 'grid' ? 'border-t border-[var(--vault-line)] px-5 py-4' : 'md:w-[11rem]')}>
                        <div className={cn('flex items-center gap-3', viewMode === 'grid' ? 'justify-between' : 'flex-col items-stretch')}>
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--vault-copy-soft)]">
                              Price
                            </p>
                            <p className="mt-1 text-2xl font-black tracking-[-0.04em] text-[var(--vault-ink)]">
                              ${Number(product.price || 0).toFixed(2)}
                            </p>
                          </div>
                          <div className={cn('flex gap-2', viewMode === 'grid' ? '' : 'w-full flex-col')}>
                            <button
                              onClick={() => onProductClick(product.id)}
                              className="rounded-xl border border-[var(--vault-line)] bg-[var(--vault-surface-alt)] px-4 py-3 text-sm font-medium text-[var(--vault-ink)] transition-colors hover:bg-[var(--vault-primary-soft)]"
                            >
                              View details
                            </button>
                            <button
                              onClick={() => onAddToCart(product.id)}
                              className="rounded-xl bg-[var(--vault-primary)] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--vault-primary-strong)]"
                            >
                              Add to cart
                            </button>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {totalPages > 1 ? (
              <nav className="mt-8 flex items-center justify-center gap-3">
                <button
                  onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                  disabled={currentPage <= 1}
                  className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--vault-line)] bg-[var(--vault-surface)] text-[var(--vault-ink)] disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="rounded-xl border border-[var(--vault-line)] bg-[var(--vault-surface)] px-4 py-3 text-sm font-medium text-[var(--vault-copy)]">
                  Page {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage >= totalPages}
                  className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--vault-line)] bg-[var(--vault-surface)] text-[var(--vault-ink)] disabled:opacity-40"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </nav>
            ) : null}
          </main>
        </div>
      </div>
    </div>
  );
});
