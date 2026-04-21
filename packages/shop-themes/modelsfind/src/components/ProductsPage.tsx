import React from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  Grid3X3,
  Heart,
  List,
  Loader2,
  MessageCircleMore,
  Search,
  Share2,
  SlidersHorizontal,
  Sparkles,
  WandSparkles,
} from 'lucide-react';
import type { Product, ProductImage } from 'shared/src/types/product';
import type { ProductsPageProps } from 'shared/src/types/theme';
import {
  conciergePrompts,
  heroRegions,
  previewPortraits,
  resolveModelsfindSiteConfig,
  resolvePreviewPortraitForProduct,
} from '../site';

function getProductImage(product: Product, index = 0): string {
  const portrait = resolvePreviewPortraitForProduct(product, index);
  const mainImage = product.images?.find((image) => image.isMain) || product.images?.[0];
  const imageUrl = (mainImage as ProductImage | undefined)?.url;
  const looksGenericProduct =
    product.category?.name?.toLowerCase() === 'private directory' ||
    /(yoga|skincare|watch|headphones|desk lamp|t-shirt)/i.test(product.name || '');

  return looksGenericProduct ? portrait.image : imageUrl || portrait.image || '/placeholder-product.svg';
}

function getProductRegion(product: Product, index = 0): string {
  const portrait = resolvePreviewPortraitForProduct(product, index);
  const regionTag = product.tags?.find((tag) =>
    heroRegions.some((region) => tag.toLowerCase().includes(region.toLowerCase()))
  );

  return regionTag || portrait.cities || portrait.region || 'Private directory';
}

function getProductSubtitle(product: Product, index = 0): string {
  const portrait = resolvePreviewPortraitForProduct(product, index);
  return product.tags?.slice(0, 2).join(' • ') || portrait.mood || 'Editorial profile';
}

function getProductStatus(product: Product): string {
  const available = product.inventory?.available ?? 0;
  return available > 0 ? 'Verified' : 'Request only';
}

function formatPrice(value: number): string {
  if (!value) {
    return 'Private rate';
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function MobileReelCard({
  product,
  region,
  image,
  onProductClick,
}: {
  product: Product;
  region: string;
  image: string;
  onProductClick: (productId: string) => void;
}) {
  const portrait = resolvePreviewPortraitForProduct(product);
  const displayName = portrait.name;

  return (
    <article className="modelsfind-vignette relative h-[calc(100dvh-5.8rem)] snap-start overflow-hidden bg-[rgba(8,8,10,0.98)]">
      <button type="button" onClick={() => onProductClick(product.id)} className="absolute inset-0">
        <img src={image} alt={displayName} className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(14,14,16,0.22),rgba(14,14,16,0.04)_26%,rgba(0,0,0,0.82)_100%)]" />
      </button>

      <div className="pointer-events-none absolute inset-0 flex flex-col justify-end px-6 pb-32">
        <div className="flex items-end justify-between gap-4">
          <div className="max-w-[70%]">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--modelsfind-line-strong)] bg-[rgba(255,122,251,0.12)] px-3 py-1">
              <span className="h-2 w-2 rounded-full bg-[var(--modelsfind-primary)]" />
              <span className="text-[10px] uppercase tracking-[0.14rem] text-[var(--modelsfind-primary)]">
                {getProductStatus(product) === 'Verified' ? 'Available tonight' : 'Request only'}
              </span>
            </div>
            <h2 className="mt-4 [font-family:var(--modelsfind-display)] text-[3.4rem] font-bold leading-[0.86] tracking-[-0.06em] text-white">
              {displayName}
            </h2>
            <div className="mt-2 inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]">
              <span>{region}</span>
            </div>
            <p className="mt-4 max-w-[16rem] text-sm leading-6 text-[color-mix(in_srgb,var(--modelsfind-copy)_90%,white)]">
              {product.description || `${displayName} is staged for editorial booking, private requests, and a faster shortlist flow.`}
            </p>
          </div>

          <div className="pointer-events-auto mb-3 flex flex-col items-center gap-5">
            <button
              type="button"
              onClick={() => onProductClick(product.id)}
              className="relative rounded-full bg-[linear-gradient(135deg,var(--modelsfind-primary),var(--modelsfind-primary-strong))] p-[2px]"
              aria-label="Open profile"
            >
              <img src={image} alt={displayName} className="h-14 w-14 rounded-full border-2 border-[rgba(8,8,10,0.95)] object-cover" />
              <span className="absolute -bottom-1 left-1/2 flex h-5 w-5 -translate-x-1/2 items-center justify-center rounded-full border-2 border-[rgba(8,8,10,0.95)] bg-[var(--modelsfind-primary)] text-[10px] font-bold text-[#210025]">
                +
              </span>
            </button>

            <button
              type="button"
              onClick={() => onProductClick(product.id)}
              className="flex flex-col items-center gap-1"
              aria-label="Save profile"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[rgba(255,255,255,0.08)] backdrop-blur-md">
                <Heart className="h-5 w-5 text-[var(--modelsfind-primary)]" />
              </div>
              <span className="text-[10px] font-bold text-white/70">2.4K</span>
            </button>

            <button
              type="button"
              onClick={() => onProductClick(product.id)}
              className="flex flex-col items-center gap-1"
              aria-label="Reserve"
            >
              <div className="modelsfind-mobile-cta flex h-14 w-14 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--modelsfind-primary),var(--modelsfind-primary-strong))] text-[#210025]">
                <Bookmark className="h-5 w-5" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-[0.08rem] text-[var(--modelsfind-primary)]">Reserve</span>
            </button>

            <button
              type="button"
              onClick={() => onProductClick(product.id)}
              className="flex flex-col items-center gap-1"
              aria-label="Share"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[rgba(255,255,255,0.08)] backdrop-blur-md">
                <Share2 className="h-5 w-5 text-white" />
              </div>
              <span className="text-[10px] font-bold text-white/65">Share</span>
            </button>
          </div>
        </div>

        <div className="pointer-events-none absolute bottom-24 left-1/2 flex -translate-x-1/2 flex-col items-center gap-1 opacity-40">
          <ArrowRight className="h-4 w-4 rotate-90" />
          <span className="text-[9px] uppercase tracking-[0.2em]">Swipe for more</span>
        </div>
      </div>
    </article>
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
  config,
  onSortChange,
  onViewModeChange,
  onPageChange,
  onProductClick,
  onSearch,
}: ProductsPageProps) {
  const site = resolveModelsfindSiteConfig(config);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [activeRegion, setActiveRegion] = React.useState<string>(heroRegions[0]);

  const heroImage = products[0] ? getProductImage(products[0], 0) : previewPortraits[0].image;

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
          <p className="mt-4 text-[11px] uppercase tracking-[0.28em] text-[var(--modelsfind-copy-soft)]">Loading directory</p>
        </div>
      </div>
    );
  }

  return (
    <div className="modelsfind-shell min-h-screen pb-32 pt-0 [font-family:var(--modelsfind-body)] text-[var(--modelsfind-ink)] md:px-6 md:pt-24 lg:px-8">
      <div className="md:hidden">
        <header className="modelsfind-mobile-topbar fixed inset-x-0 top-0 z-[75] flex h-16 items-center justify-between px-6">
          <button
            type="button"
            onClick={() => handleRegionClick(activeRegion)}
            className="inline-flex items-center gap-3 text-[var(--modelsfind-primary)]"
          >
            <Grid3X3 className="h-4 w-4" />
            <span className="[font-family:var(--modelsfind-display)] text-[1.35rem] italic tracking-[0.18em] uppercase">
              {site.brandName}
            </span>
          </button>
          <button
            type="button"
            onClick={() => onSearch?.(activeRegion)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--modelsfind-primary)]"
            aria-label="Search models"
          >
            <Search className="h-4 w-4" />
          </button>
        </header>

        <main className="h-[calc(100dvh-1.2rem)] snap-y snap-mandatory overflow-y-auto">
          {products.slice(0, 6).map((product, index) => (
            <MobileReelCard
              key={product.id}
              product={product}
              region={getProductRegion(product, index)}
              image={getProductImage(product, index)}
              onProductClick={onProductClick}
            />
          ))}
        </main>
      </div>

      <div className="hidden md:block">
      <div className="mx-auto max-w-[1560px] xl:flex">
        <aside className="modelsfind-frame hidden w-[16rem] shrink-0 rounded-l-[2rem] rounded-r-none border-r border-[var(--modelsfind-line)] xl:flex xl:min-h-[calc(100vh-8rem)] xl:flex-col xl:px-8 xl:py-8">
          <div>
            <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--modelsfind-copy-soft)]">Regions</p>
            <h2 className="mt-2 [font-family:var(--modelsfind-display)] text-[2.1rem] leading-none tracking-[-0.04em] text-[var(--modelsfind-primary)]">
              Global talent
            </h2>
          </div>

          <div className="mt-8 grid gap-2.5">
            {heroRegions.map((region) => (
              <button
                key={region}
                type="button"
                onClick={() => handleRegionClick(region)}
                className={[
                  'rounded-[1rem] border px-4 py-4 text-left text-[11px] uppercase tracking-[0.18em] transition-all',
                  activeRegion === region
                    ? 'border-[var(--modelsfind-line-strong)] bg-[rgba(255,255,255,0.06)] text-[var(--modelsfind-primary)]'
                    : 'border-[var(--modelsfind-line)] text-[var(--modelsfind-copy-soft)] hover:border-[var(--modelsfind-line-strong)] hover:text-[var(--modelsfind-ink)]',
                ].join(' ')}
              >
                {region}
              </button>
            ))}
          </div>

          <div className="modelsfind-panel mt-8 rounded-[1.4rem] border border-[var(--modelsfind-line)] p-5">
            <p className="text-[10px] uppercase tracking-[0.24em] text-[var(--modelsfind-primary)]">Indexed now</p>
            <p className="mt-3 [font-family:var(--modelsfind-display)] text-[3rem] leading-none tracking-[-0.05em] text-white">
              {totalProducts}
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--modelsfind-copy)]">
              Live profiles available for booking-led storefronts and private shortlist reviews.
            </p>
          </div>

          <div className="modelsfind-panel mt-auto rounded-[1.4rem] border border-[var(--modelsfind-line)] p-5">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--modelsfind-primary-soft)] text-[var(--modelsfind-primary)]">
              <WandSparkles className="h-4 w-4" />
            </div>
            <p className="mt-4 text-[10px] uppercase tracking-[0.24em] text-[var(--modelsfind-copy-soft)]">AI concierge</p>
            <p className="mt-2 text-sm leading-6 text-[var(--modelsfind-copy)]">
              Use natural language to jump from mood to shortlist without giving up the editorial presentation.
            </p>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <div className="modelsfind-frame overflow-hidden rounded-[2rem] border border-[var(--modelsfind-line-strong)] xl:rounded-l-none xl:border-l-0">
            <div className="p-4 md:p-6 xl:p-8">
              <section className="modelsfind-hero overflow-hidden rounded-[1.8rem] border border-[var(--modelsfind-line)]">
                <img
                  src={heroImage}
                  alt={site.headline}
                  className="absolute inset-0 h-full w-full object-cover grayscale opacity-45"
                />
                <div className="relative z-10 grid min-h-[24rem] gap-6 px-6 pb-8 pt-10 md:px-10 md:pb-10 md:pt-12 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-end">
                  <div className="max-w-[40rem]">
                    <p className="text-[10px] uppercase tracking-[0.32em] text-[var(--modelsfind-primary)]">{site.eyebrow}</p>
                    <h1 className="mt-4 [font-family:var(--modelsfind-display)] text-[clamp(2.8rem,6vw,5rem)] leading-[0.92] tracking-[-0.05em] text-white">
                      {site.headline}
                    </h1>
                    <p className="mt-4 max-w-[32rem] text-sm leading-7 text-[var(--modelsfind-copy)]">
                      Showing {totalProducts} profiles tuned for fast browse, discreet booking requests, and high-contrast editorial presentation.
                    </p>
                  </div>

                  <div className="modelsfind-panel rounded-[1.5rem] border border-[var(--modelsfind-line)] p-5">
                    <p className="text-[9px] uppercase tracking-[0.2em] text-[var(--modelsfind-copy-soft)]">Active region</p>
                    <p className="mt-2 [font-family:var(--modelsfind-display)] text-[2rem] leading-none tracking-[-0.04em] text-white">
                      {activeRegion}
                    </p>
                    <p className="mt-3 text-sm leading-6 text-[var(--modelsfind-copy)]">
                      Sort by newest arrivals, name, or price while keeping the same cinematic card rhythm.
                    </p>
                  </div>
                </div>
              </section>

              <section className="mt-6 xl:hidden">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-[var(--modelsfind-copy-soft)]">Selected regions</p>
                  <div className="h-px flex-1 bg-[var(--modelsfind-line)]" />
                </div>
                <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                  {heroRegions.map((region) => (
                    <button
                      key={region}
                      type="button"
                      onClick={() => handleRegionClick(region)}
                      className={[
                        'whitespace-nowrap rounded-full border px-4 py-2.5 text-[10px] uppercase tracking-[0.18em]',
                        activeRegion === region
                          ? 'border-[var(--modelsfind-line-strong)] bg-[var(--modelsfind-primary-soft)] text-[var(--modelsfind-primary)]'
                          : 'border-[var(--modelsfind-line)] text-[var(--modelsfind-copy)]',
                      ].join(' ')}
                    >
                      {region}
                    </button>
                  ))}
                </div>
              </section>

              <section className="modelsfind-panel mt-6 rounded-[1.6rem] border border-[var(--modelsfind-line)] p-4 md:p-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                  <form onSubmit={handleSearchSubmit} className="relative flex-1">
                    <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--modelsfind-copy-soft)]" />
                    <input
                      type="search"
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Search models, moods, cities, or looks"
                      className="modelsfind-field h-12 w-full rounded-full border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.05)] pl-11 pr-4 text-sm text-[var(--modelsfind-ink)] placeholder:text-[var(--modelsfind-copy-soft)]"
                    />
                  </form>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="inline-flex h-12 items-center gap-2 rounded-full border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.04)] px-4 text-[10px] uppercase tracking-[0.22em] text-[var(--modelsfind-copy)]">
                      <SlidersHorizontal className="h-4 w-4 text-[var(--modelsfind-primary)]" />
                      {totalProducts} indexed
                    </div>

                    <select
                      value={sortBy}
                      onChange={(event) => onSortChange(event.target.value)}
                      className="modelsfind-field h-12 rounded-full border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.04)] px-4 text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-ink)]"
                    >
                      <option value="createdAt">Newest</option>
                      <option value="name">Name</option>
                      <option value="price">Price</option>
                    </select>

                    <div className="inline-flex items-center rounded-full border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.04)] p-1">
                      <button
                        type="button"
                        onClick={() => onViewModeChange('grid')}
                        className={[
                          'flex h-10 w-10 items-center justify-center rounded-full transition-colors',
                          viewMode === 'grid'
                            ? 'bg-[var(--modelsfind-primary)] text-[#140d16]'
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
                          'flex h-10 w-10 items-center justify-center rounded-full transition-colors',
                          viewMode === 'list'
                            ? 'bg-[var(--modelsfind-primary)] text-[#140d16]'
                            : 'text-[var(--modelsfind-copy)] hover:text-[var(--modelsfind-ink)]',
                        ].join(' ')}
                        aria-label="List view"
                      >
                        <List className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </section>

              {products.length === 0 ? (
                <div className="mt-6 rounded-[1.8rem] border border-dashed border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-6 py-16 text-center">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-[var(--modelsfind-primary)]">No profiles found</p>
                  <h2 className="mt-4 [font-family:var(--modelsfind-display)] text-[2.6rem] leading-none tracking-[-0.04em] text-white">
                    Try a tighter region or a softer mood query.
                  </h2>
                  <p className="mx-auto mt-4 max-w-[28rem] text-sm leading-7 text-[var(--modelsfind-copy)]">
                    The directory stays intentionally selective. Switch region lanes or use a broader mood search to surface more profiles.
                  </p>
                </div>
              ) : (
                <div
                  className={[
                    'mt-8 gap-5',
                    viewMode === 'grid' ? 'grid md:grid-cols-2 2xl:grid-cols-3' : 'grid gap-4',
                  ].join(' ')}
                >
                  {products.map((product, index) => {
                    const portrait = resolvePreviewPortraitForProduct(product, index);
                    const status = getProductStatus(product);
                    const image = getProductImage(product, index);
                    const region = getProductRegion(product, index);
                    const displayName = portrait.name;
                    const displaySubtitle = getProductSubtitle(product, index);

                    return (
                      <article
                        key={product.id}
                        className={[
                          'group overflow-hidden border border-[var(--modelsfind-line)] bg-[rgba(20,16,24,0.92)] transition-all duration-500 hover:-translate-y-1',
                          viewMode === 'grid'
                            ? 'rounded-[1.5rem]'
                            : 'grid rounded-[1.6rem] md:grid-cols-[18rem_minmax(0,1fr)]',
                          viewMode === 'grid' && index % 2 === 1 ? 'md:translate-y-6' : '',
                        ].join(' ')}
                      >
                        <button
                          type="button"
                          onClick={() => onProductClick(product.id)}
                          className="block w-full text-left"
                        >
                          <div
                            className={
                              viewMode === 'grid'
                                ? 'relative aspect-[0.76] overflow-hidden'
                                : 'relative h-full min-h-[17rem] overflow-hidden'
                            }
                          >
                            <img
                              src={image}
                              alt={displayName}
                              className="h-full w-full object-cover grayscale transition-all duration-700 group-hover:scale-[1.03] group-hover:grayscale-0"
                            />
                            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,6,10,0.08),rgba(7,6,10,0.82))]" />
                            <div className="absolute left-4 right-4 top-4 flex items-center justify-between gap-3">
                              <span className="rounded-full border border-[var(--modelsfind-line-strong)] bg-[rgba(15,12,18,0.7)] px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--modelsfind-primary)]">
                                {region}
                              </span>
                              <Heart className="h-4 w-4 text-[var(--modelsfind-primary)] opacity-70 transition-opacity group-hover:opacity-100" />
                            </div>
                            {viewMode === 'grid' ? (
                              <div className="absolute bottom-0 left-0 right-0 p-4">
                                <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]">{displaySubtitle}</p>
                                <h3 className="mt-2 [font-family:var(--modelsfind-display)] text-[2rem] leading-none tracking-[-0.04em] text-white">
                                  {displayName}
                                </h3>
                              </div>
                            ) : null}
                          </div>
                        </button>

                        <div className="flex flex-col justify-between p-4 md:p-5">
                          <div>
                            {viewMode === 'list' ? (
                              <>
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div>
                                    <p className="text-[10px] uppercase tracking-[0.24em] text-[var(--modelsfind-primary)]">{status}</p>
                                    <h3 className="mt-2 [font-family:var(--modelsfind-display)] text-[2.8rem] leading-none tracking-[-0.05em] text-white">
                                      {displayName}
                                    </h3>
                                  </div>
                                  <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--modelsfind-copy-soft)]">
                                    {formatPrice(product.price)}
                                  </p>
                                </div>
                                <p className="mt-4 max-w-[38rem] text-sm leading-7 text-[var(--modelsfind-copy)]">
                                  {product.description || 'Cinematic profile prepared for booking-first storefront presentation.'}
                                </p>
                              </>
                            ) : (
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--modelsfind-primary)]">{status}</p>
                                  <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]">
                                    {displaySubtitle}
                                  </p>
                                </div>
                                <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]">
                                  {formatPrice(product.price)}
                                </p>
                              </div>
                            )}

                            <div className="mt-5 flex flex-wrap gap-2">
                              {[
                                status,
                                product.reviewCount ? `${product.reviewCount} reviews` : 'Newly staged',
                                product.inventory?.available ? `${product.inventory.available} slots` : 'By request',
                              ].map((item) => (
                                <span
                                  key={item}
                                  className="rounded-full border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.04)] px-3 py-1 text-[9px] uppercase tracking-[0.16em] text-[var(--modelsfind-copy)]"
                                >
                                  {item}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div className="mt-5 flex gap-2">
                            <button
                              type="button"
                              onClick={() => onProductClick(product.id)}
                              className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--modelsfind-primary),var(--modelsfind-primary-strong))] px-4 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#140d16] shadow-[0_0_24px_var(--modelsfind-glow)]"
                            >
                              View profile
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}

              <section className="mt-8 grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
                <div className="modelsfind-panel rounded-[1.6rem] border border-[var(--modelsfind-line)] p-5">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-[var(--modelsfind-primary)]">AI concierge</p>
                  <h2 className="mt-3 [font-family:var(--modelsfind-display)] text-[2.3rem] leading-none tracking-[-0.04em] text-white">
                    Search like a stylist, not a spreadsheet.
                  </h2>
                  <p className="mt-3 max-w-[36rem] text-sm leading-7 text-[var(--modelsfind-copy)]">
                    Use a mood sentence and let the directory respond with a sharper shortlist. This keeps the concierge concept alive inside a real browse flow.
                  </p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {conciergePrompts.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => {
                          setSearchQuery(prompt);
                          onSearch?.(prompt);
                        }}
                        className="rounded-full border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.04)] px-4 py-2 text-left text-[10px] uppercase tracking-[0.16em] text-[var(--modelsfind-copy)] transition-colors hover:border-[var(--modelsfind-line-strong)] hover:text-[var(--modelsfind-ink)]"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>

                {totalPages > 1 ? (
                  <div className="modelsfind-panel flex flex-col justify-between rounded-[1.6rem] border border-[var(--modelsfind-line)] p-5">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.24em] text-[var(--modelsfind-copy-soft)]">Pagination</p>
                      <p className="mt-3 [font-family:var(--modelsfind-display)] text-[2.3rem] leading-none tracking-[-0.04em] text-white">
                        {currentPage}
                      </p>
                      <p className="mt-2 text-sm text-[var(--modelsfind-copy)]">of {totalPages} pages staged</p>
                    </div>
                    <div className="mt-6 grid gap-2">
                      <button
                        type="button"
                        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.04)] px-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--modelsfind-copy)] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <ArrowLeft className="h-4 w-4" />
                        Previous
                      </button>
                      <button
                        type="button"
                        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage === totalPages}
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.04)] px-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--modelsfind-copy)] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Next
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="modelsfind-panel rounded-[1.6rem] border border-[var(--modelsfind-line)] p-5">
                    <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--modelsfind-primary-soft)] text-[var(--modelsfind-primary)]">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <p className="mt-4 text-[10px] uppercase tracking-[0.24em] text-[var(--modelsfind-copy-soft)]">Directory state</p>
                    <p className="mt-3 [font-family:var(--modelsfind-display)] text-[2.2rem] leading-none tracking-[-0.04em] text-white">
                      Single lane
                    </p>
                    <p className="mt-3 text-sm leading-6 text-[var(--modelsfind-copy)]">
                      The current query fits on one page, so operators can stay focused without pagination friction.
                    </p>
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
});
