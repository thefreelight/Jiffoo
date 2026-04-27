import React from 'react';
import { ChevronLeft, ChevronRight, Grid3X3, List, Search, Sparkles, Star } from 'lucide-react';
import type { ThemeConfig } from 'shared/src/types/theme';
import type { Product } from 'shared/src/types/product';
import { MarketplaceFrame } from './MarketplaceFrame';
import { getNavCopy } from '../i18n';
import { getSubmissionPlanMeta, isSubmissionPlanProduct } from '../lib/submission-plan';
import { getToolDirectoryPreview } from '../lib/tool-directory';
import { Rating, ToolLogo } from './design-primitives';

type ActiveNavId = 'tools' | 'apps' | 'models' | 'rankings' | 'news' | 'collections';

interface DirectoryCatalogProps {
  products?: Product[];
  isLoading?: boolean;
  totalProducts?: number;
  currentPage?: number;
  totalPages?: number;
  sortBy?: string;
  viewMode?: 'grid' | 'list';
  title: string;
  description: string;
  locale?: string;
  config?: ThemeConfig;
  activeNavId?: ActiveNavId;
  eyebrow?: string;
  searchQueryLabel?: string;
  canSearch?: boolean;
  onNavigate?: (path: string) => void;
  onSortChange?: (sortBy: string) => void;
  onViewModeChange?: (mode: 'grid' | 'list') => void;
  onPageChange?: (page: number) => void;
  onAddToCart?: (productId: string) => Promise<void>;
  onProductClick?: (productId: string) => void;
  onSearch?: (query: string) => void;
}

function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

function renderCardInitial(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9\u3400-\u9fff]/g, '').trim();
  return cleaned.slice(0, 1).toUpperCase() || 'AI';
}

function getPlanShelfCopy(locale?: string): { eyebrow: string; title: string } {
  const resolved = getNavCopy(locale).locale;
  if (resolved === 'zh-Hant') {
    return { eyebrow: '提交方案', title: '面向付費提交的訂閱方案' };
  }
  if (resolved === 'zh-Hans') {
    return { eyebrow: '提交方案', title: '面向付费提交的订阅方案' };
  }
  return { eyebrow: 'Submission plans', title: 'Plans for paid project submissions' };
}

function getMobileCatalogCopy(locale?: string): {
  title: string;
  all: string;
  explore: string;
  viewAll: string;
} {
  const resolved = getNavCopy(locale).locale;
  if (resolved === 'zh-Hant') {
    return { title: '分類', all: '全部分類', explore: '探索', viewAll: '查看全部' };
  }
  if (resolved === 'zh-Hans') {
    return { title: '分类', all: '全部分类', explore: '探索', viewAll: '查看全部' };
  }
  return { title: 'Categories', all: 'All', explore: 'Explore', viewAll: 'View all' };
}

export function DirectoryCatalog({
  products = [],
  isLoading = false,
  totalProducts = products.length,
  currentPage = 1,
  totalPages = 1,
  sortBy = 'createdAt',
  viewMode = 'grid',
  title,
  description,
  locale,
  config,
  activeNavId = 'tools',
  eyebrow,
  searchQueryLabel,
  canSearch = true,
  onNavigate,
  onSortChange = () => undefined,
  onViewModeChange = () => undefined,
  onPageChange = () => undefined,
  onAddToCart = async () => undefined,
  onProductClick = () => undefined,
  onSearch,
}: DirectoryCatalogProps) {
  const copy = getNavCopy(locale);
  const planShelfCopy = getPlanShelfCopy(locale);
  const mobileCatalogCopy = getMobileCatalogCopy(locale);
  const [searchQuery, setSearchQuery] = React.useState(searchQueryLabel || '');
  const [mobileCategory, setMobileCategory] = React.useState<string>('all');
  const featuredPlans = React.useMemo(
    () => products.filter((product) => isSubmissionPlanProduct(product)).slice(0, 3),
    [products],
  );
  const mobileCategoryList = React.useMemo(() => {
    const categoryPairs: Array<[string, string]> = products
      .map((product) => [
        product.category?.id || product.category?.name || 'all',
        product.category?.name || 'AI',
      ] satisfies [string, string])
      .filter(([id]) => Boolean(id));
    const entries = Array.from(
      new Map<string, string>(categoryPairs).entries(),
    ).map(([id, label]) => ({ id, label }));

    return [{ id: 'all', label: mobileCatalogCopy.all }, ...entries];
  }, [mobileCatalogCopy.all, products]);
  const groupedProducts = React.useMemo(() => {
    const map = new Map<string, { label: string; items: Product[] }>();

    for (const product of products) {
      const key = product.category?.id || product.category?.name || 'uncategorized';
      const label = product.category?.name || (copy.locale === 'en' ? 'AI Tools' : 'AI 工具');

      if (!map.has(key)) {
        map.set(key, { label, items: [] });
      }

      map.get(key)?.items.push(product);
    }

    return Array.from(map.entries()).map(([id, value]) => ({
      id,
      label: value.label,
      items: value.items,
    }));
  }, [copy.locale, products]);
  const mobileSections = React.useMemo(() => {
    if (mobileCategory === 'all') {
      return groupedProducts.slice(0, 4);
    }

    const matched = groupedProducts.find((section) => section.id === mobileCategory);
    return matched ? [matched] : groupedProducts.slice(0, 4);
  }, [groupedProducts, mobileCategory]);

  React.useEffect(() => {
    setSearchQuery(searchQueryLabel || '');
  }, [searchQueryLabel]);

  React.useEffect(() => {
    if (!mobileCategoryList.some((item) => item.id === mobileCategory)) {
      setMobileCategory('all');
    }
  }, [mobileCategory, mobileCategoryList]);

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSearch || !onSearch || !searchQuery.trim()) return;
    onSearch(searchQuery.trim());
  };

  if (isLoading) {
    return (
      <MarketplaceFrame activeItem={activeNavId} locale={locale} config={config} onNavigate={onNavigate}>
        <div className="rounded-[var(--navtoai-radius-xl)] border border-[var(--navtoai-line)] bg-[var(--navtoai-surface)] p-10 text-center text-[var(--navtoai-copy)]">
          {copy.common.loading}
        </div>
      </MarketplaceFrame>
    );
  }

  return (
    <MarketplaceFrame activeItem={activeNavId} locale={locale} config={config} onNavigate={onNavigate}>
      <div className="lg:hidden">
        <section className="flex gap-4">
          <aside className="w-[4.8rem] shrink-0 border-r border-[#edf0f8] pr-2">
            <div className="sticky top-[4.7rem] grid gap-1">
              {mobileCategoryList.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setMobileCategory(item.id)}
                  className={[
                    'relative rounded-[0.65rem] px-2 py-3 text-center text-xs font-semibold transition-colors',
                    mobileCategory === item.id
                      ? 'bg-[#f3f1ff] text-[#6257ff]'
                      : 'text-[#596174]',
                  ].join(' ')}
                >
                  {mobileCategory === item.id ? <span className="absolute bottom-2 left-0 top-2 w-0.5 rounded-full bg-[#6257ff]" /> : null}
                  {item.label}
                </button>
              ))}
            </div>
          </aside>

          <div className="min-w-0 flex-1 space-y-6">
            <section className="relative overflow-hidden rounded-[0.9rem] bg-[linear-gradient(135deg,#6257ff,#6b8cff)] px-4 py-6 text-white shadow-[0_18px_38px_-28px_rgba(81,86,230,0.8)]">
              <h1 className="max-w-[10.5rem] text-[1.65rem] font-black leading-tight">
                {copy.locale === 'en' ? 'Explore 1000+ quality AI tools' : copy.locale === 'zh-Hant' ? '探索 1000+ 優質 AI 工具' : '探索 1000+ 优质 AI 工具'}
              </h1>
              <p className="mt-2 max-w-[10rem] text-xs font-semibold leading-5 text-white/78">
                {copy.locale === 'en' ? 'Discover tools that match real workflows' : copy.locale === 'zh-Hant' ? '發現適合你的 AI 工具' : '发现适合你的 AI 工具'}
              </p>
              <div className="absolute bottom-3 right-3 flex h-16 w-16 items-center justify-center rounded-full bg-white/20 text-3xl shadow-[inset_0_0_0_1px_rgba(255,255,255,0.2)]">
                AI
              </div>
            </section>

            {mobileSections.map((section) => (
              <section key={section.id}>
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-[1.05rem] font-black text-[#11162b]">{section.label}</h2>
                  <button
                    type="button"
                    onClick={() => onSearch?.(section.label)}
                    className="text-xs font-bold text-[#6257ff]"
                  >
                    {mobileCatalogCopy.viewAll}
                  </button>
                </div>
                <div className="mt-3 grid gap-4">
                  {section.items.slice(0, mobileCategory === 'all' ? 4 : 8).map((product) => {
                    const preview = getToolDirectoryPreview(product, { locale });

                    return (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => onProductClick(product.id)}
                        className="text-left"
                      >
                        <div className="flex items-start gap-3">
                          <ToolLogo name={product.name} imageUrl={preview.imageUrl} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="truncate text-sm font-black text-[#11162b]">
                                  {product.name}
                                </div>
                                <div className="mt-0.5 text-xs font-semibold text-[#8a93a8]">{product.category?.name || preview.categoryLabel}</div>
                              </div>
                              <Rating value={product.rating > 0 ? product.rating.toFixed(1) : '4.8'} />
                            </div>
                            <p className="mt-1 line-clamp-1 text-xs font-medium text-[#7a8499]">{preview.primarySpec}</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </section>
      </div>

      <div className="hidden space-y-6 lg:block">
        <section className="rounded-[var(--navtoai-radius-xl)] border border-[var(--navtoai-line)] bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(244,246,255,0.96))] p-6 shadow-[var(--navtoai-shadow-sm)] sm:p-8">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_18rem] xl:items-start">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full bg-[var(--navtoai-primary-soft)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--navtoai-primary-strong)]">
                <Sparkles className="h-4 w-4 text-[var(--navtoai-primary)]" />
                {eyebrow || copy.catalog.toolsEyebrow}
              </div>
              <h1 className="mt-4 max-w-4xl text-[clamp(2rem,4vw,3.6rem)] font-black leading-[0.96] tracking-[-0.06em] text-[var(--navtoai-ink)]">
                {title}
              </h1>
              <p className="mt-3 max-w-3xl text-base leading-7 text-[var(--navtoai-copy)]">{description}</p>
            </div>

            <div className="rounded-[var(--navtoai-radius-lg)] border border-[var(--navtoai-line)] bg-[linear-gradient(180deg,var(--navtoai-surface),var(--navtoai-bg-alt))] p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--navtoai-copy-soft)]">
                {copy.common.overview}
              </p>
              <div className="mt-3 text-3xl font-black tracking-[-0.05em] text-[var(--navtoai-ink)]">
                {totalProducts}
              </div>
              <p className="mt-2 text-sm text-[var(--navtoai-copy)]">
                {copy.common.listings} · {copy.common.directoryFirst}
              </p>
              {searchQueryLabel ? (
                <div className="mt-4 rounded-[1rem] bg-white px-4 py-3 text-sm text-[var(--navtoai-copy)] shadow-[var(--navtoai-shadow-xs)]">
                  {copy.common.queryLabel}: <span className="font-semibold text-[var(--navtoai-ink)]">{searchQueryLabel}</span>
                </div>
              ) : (
                <div className="mt-4 rounded-[1rem] bg-white px-4 py-3 text-sm text-[var(--navtoai-copy)] shadow-[var(--navtoai-shadow-xs)]">
                  {copy.common.curatedBrief}
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto_auto]">
            {canSearch ? (
              <form onSubmit={submitSearch} className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--navtoai-copy-soft)]" />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder={copy.catalog.toolsSearchPlaceholder}
                  className="h-12 w-full rounded-[1rem] border border-[var(--navtoai-line)] bg-white pl-11 pr-4 text-sm text-[var(--navtoai-ink)] outline-none shadow-[var(--navtoai-shadow-xs)] placeholder:text-[var(--navtoai-copy-soft)]"
                />
              </form>
            ) : (
              <div className="flex h-12 items-center rounded-[1rem] border border-[var(--navtoai-line)] bg-white px-4 text-sm text-[var(--navtoai-copy)] shadow-[var(--navtoai-shadow-xs)]">
                {searchQueryLabel
                  ? `${copy.common.queryLabel}: ${searchQueryLabel}`
                  : copy.common.directoryFirst}
              </div>
            )}

            <select
              value={sortBy}
              onChange={(event: React.ChangeEvent<HTMLSelectElement>) => onSortChange(event.target.value)}
              className="h-12 rounded-[1rem] border border-[var(--navtoai-line)] bg-white px-4 text-sm font-medium text-[var(--navtoai-ink)] outline-none shadow-[var(--navtoai-shadow-xs)]"
            >
              <option value="createdAt">{copy.common.newest}</option>
              <option value="price">{copy.common.price}</option>
              <option value="name">{copy.common.name}</option>
            </select>

            <div className="flex items-center rounded-[1rem] border border-[var(--navtoai-line)] bg-white p-1 shadow-[var(--navtoai-shadow-xs)]">
              <button
                type="button"
                onClick={() => onViewModeChange('grid')}
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-[0.85rem] transition-colors',
                  viewMode === 'grid'
                    ? 'bg-[var(--navtoai-primary)] text-white'
                    : 'text-[var(--navtoai-copy)]',
                )}
              >
                <Grid3X3 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => onViewModeChange('list')}
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-[0.85rem] transition-colors',
                  viewMode === 'list'
                    ? 'bg-[var(--navtoai-primary)] text-white'
                    : 'text-[var(--navtoai-copy)]',
                )}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>

        <section>
          {featuredPlans.length > 0 ? (
            <div className="mb-6 rounded-[var(--navtoai-radius-xl)] border border-[var(--navtoai-line)] bg-[linear-gradient(135deg,rgba(239,237,255,0.96),rgba(255,255,255,0.98))] p-5 shadow-[var(--navtoai-shadow-xs)]">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--navtoai-primary-strong)]">
                    {planShelfCopy.eyebrow}
                  </p>
                  <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-[var(--navtoai-ink)]">
                    {planShelfCopy.title}
                  </h2>
                </div>
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-3">
                {featuredPlans.map((product) => {
                  const planMeta = getSubmissionPlanMeta(product, locale);
                  return (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => onProductClick(product.id)}
                      className="rounded-[var(--navtoai-radius-lg)] border border-[var(--navtoai-line)] bg-white p-5 text-left shadow-[var(--navtoai-shadow-xs)] transition-transform duration-300 hover:-translate-y-0.5"
                    >
                      <div className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--navtoai-primary-strong)]">
                        {planMeta?.kindLabel || 'Plan'}
                      </div>
                      <h3 className="mt-3 text-xl font-black tracking-[-0.04em] text-[var(--navtoai-ink)]">
                        {product.name}
                      </h3>
                      <p className="mt-3 text-sm leading-6 text-[var(--navtoai-copy)]">
                        {planMeta?.audience || product.description}
                      </p>
                      <div className="mt-4 text-2xl font-black tracking-[-0.05em] text-[var(--navtoai-ink)]">
                        {Number(product.price || 0) > 0 ? `$${Number(product.price || 0).toFixed(0)}` : copy.common.free}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {products.length === 0 ? (
            <div className="rounded-[var(--navtoai-radius-xl)] border border-dashed border-[var(--navtoai-line)] bg-[var(--navtoai-surface)] p-16 text-center text-[var(--navtoai-copy)]">
              {copy.common.noResults}
            </div>
          ) : (
            <div
              className={cn(
                'grid gap-4',
                viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3' : 'grid-cols-1',
              )}
            >
              {products.map((product) => {
                const preview = getToolDirectoryPreview(product, { locale });

                return (
                  <article
                    key={product.id}
                    className={cn(
                      'overflow-hidden rounded-[var(--navtoai-radius-lg)] border border-[var(--navtoai-line)] bg-[var(--navtoai-surface)] shadow-[var(--navtoai-shadow-sm)] transition-transform duration-300 hover:-translate-y-1',
                      viewMode === 'list' && 'grid gap-4 p-5 md:grid-cols-[minmax(0,1fr)_12rem] md:items-center',
                    )}
                  >
                    <div className={cn(viewMode === 'grid' ? 'p-5' : 'min-w-0')}>
                      <div className="flex items-start gap-4">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-[1rem] border border-[var(--navtoai-line)] bg-[var(--navtoai-bg-alt)] text-lg font-black text-[var(--navtoai-primary)]">
                          {preview.imageUrl === '/placeholder-product.svg' ? (
                            renderCardInitial(product.name)
                          ) : (
                            <img src={preview.imageUrl} alt={product.name} className="h-full w-full object-cover" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-[var(--navtoai-primary-soft)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--navtoai-primary-strong)]">
                              {preview.categoryLabel}
                            </span>
                            <span className="rounded-full bg-[var(--navtoai-bg-alt)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--navtoai-copy-soft)]">
                              {preview.categoryAccent}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => onProductClick(product.id)}
                            className="mt-4 text-left"
                          >
                            <h2 className="text-[1.4rem] font-black tracking-[-0.04em] text-[var(--navtoai-ink)]">
                              {product.name}
                            </h2>
                          </button>
                          <p className="mt-1 text-sm font-medium text-[var(--navtoai-copy-soft)]">
                            {preview.primarySpec}
                          </p>
                          <p className="mt-3 text-sm leading-6 text-[var(--navtoai-copy)]">
                            {preview.summary}
                          </p>
                          <div className="mt-4 flex flex-wrap gap-2">
                            {preview.tags.map((tag) => (
                              <span
                                key={tag}
                                className="rounded-full border border-[var(--navtoai-line)] px-2.5 py-1 text-[11px] font-medium text-[var(--navtoai-copy)]"
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className={cn(viewMode === 'grid' ? 'border-t border-[var(--navtoai-line)] p-5' : 'md:w-[12rem]')}>
                      <div className="rounded-[1.05rem] bg-[var(--navtoai-bg-alt)] p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--navtoai-copy-soft)]">
                          {copy.common.signal}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-[var(--navtoai-copy)]">{preview.trustLabel}</p>
                        <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-[#f4a318]">
                          <Star className="h-4 w-4 fill-current" />
                          {product.rating > 0 ? product.rating.toFixed(1) : '4.8'}
                        </div>
                        <div className="mt-4 text-2xl font-black tracking-[-0.05em] text-[var(--navtoai-ink)]">
                          {Number(product.price || 0) > 0 ? preview.pricingLabel.replace(/^From\s+/i, '') : preview.pricingLabel}
                        </div>
                        <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--navtoai-copy-soft)]">
                          {preview.pricingLabel}
                        </p>
                        <div className="mt-4 grid gap-2">
                          <button
                            type="button"
                            onClick={() => onAddToCart(product.id)}
                            className="w-full rounded-full bg-[linear-gradient(135deg,var(--navtoai-primary),var(--navtoai-primary-strong))] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-white"
                          >
                            {copy.common.addToStack}
                          </button>
                          <button
                            type="button"
                            onClick={() => onProductClick(product.id)}
                            className="w-full rounded-full border border-[var(--navtoai-line)] bg-white px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--navtoai-ink)]"
                          >
                            {copy.common.openDetail}
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
          <nav className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--navtoai-line)] bg-white text-[var(--navtoai-ink)] shadow-[var(--navtoai-shadow-xs)] disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="rounded-full border border-[var(--navtoai-line)] bg-white px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--navtoai-copy)] shadow-[var(--navtoai-shadow-xs)]">
              {copy.common.page} {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage >= totalPages}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--navtoai-line)] bg-white text-[var(--navtoai-ink)] shadow-[var(--navtoai-shadow-xs)] disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </nav>
        ) : null}
      </div>
    </MarketplaceFrame>
  );
}
