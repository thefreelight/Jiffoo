import React from 'react';
import {
  ArrowRight,
  Bell,
  ChevronRight,
  CircleUserRound,
  Compass,
  Grid2X2,
  List,
  MapPin,
  MoreHorizontal,
  QrCode,
  Search,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Wifi,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { FEATURED_PLANS, getPlanDisplay, type PlanDisplay } from '../lib/plan-display';
import { ProductCard } from '../ui/ProductCard';
import type { Product, ProductsPageProps } from '../types';

const regionFilters = ['Popular', 'Nearby', 'Asia', 'Europe', 'Global'];
const dataOptions = ['3GB', '5GB', '10GB', '20GB', 'Unlimited'];
const durations = ['7 days', '15 days', '30 days', '90 days'];

const popularDestinations = [
  { name: 'Tokyo', country: 'Japan', code: 'TYO', helper: '5GB from $4.50', query: 'tokyo japan' },
  { name: 'Seoul', country: 'South Korea', code: 'SEL', helper: 'Fast 5G coverage', query: 'seoul korea' },
  { name: 'Paris', country: 'France', code: 'PAR', helper: 'Europe plans ready', query: 'paris france europe' },
  { name: 'Singapore', country: 'Singapore', code: 'SIN', helper: 'Instant QR delivery', query: 'singapore' },
];

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
  onAddToCart,
  onProductClick,
}: ProductsPageProps) {
  const brandName = config?.brand?.name?.trim() || 'Yevbi';

  if (isLoading) {
    return (
      <main className="relative z-[60] -mt-20 min-h-screen bg-white text-[#071d49] lg:z-auto lg:mt-0 lg:bg-[#edf6ff]">
        <MobileExploreSkeleton brandName={brandName} />
        <DesktopProductsSkeleton />
      </main>
    );
  }

  const pages = getVisiblePages(currentPage, totalPages);

  return (
    <main className="relative z-[60] -mt-20 min-h-screen bg-white text-[#071d49] lg:z-auto lg:mt-0 lg:bg-[#edf6ff]">
      <MobileExplore
        brandName={brandName}
        products={products}
        totalProducts={totalProducts}
        onProductClick={onProductClick}
      />

      <section className="hidden min-h-screen bg-[linear-gradient(180deg,#f4f9ff_0%,#eaf4ff_48%,#f8fbff_100%)] px-8 pb-24 pt-12 lg:block xl:px-12">
        <div className="mx-auto max-w-[var(--esim-container)]">
          <div className="grid gap-8 overflow-hidden rounded-[2.25rem] border border-[#d7e8ff] bg-white p-8 shadow-[0_28px_80px_rgba(16,88,178,0.12)] xl:grid-cols-[1fr_0.78fr] xl:p-10">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-[#eaf4ff] px-4 py-2 text-xs font-extrabold uppercase tracking-[0.18em] text-[#1262d9]">
                <Sparkles className="h-4 w-4" />
                Web plans
              </div>
              <h1 className="mt-5 max-w-3xl text-5xl font-black leading-[0.96] tracking-[-0.055em] text-[#071d49] xl:text-6xl">
                Explore blue-sky eSIM plans without roaming chaos.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-[#52657f]">
                {brandName} keeps every plan crisp: destination, data, validity, carrier speed, and instant QR delivery in a clean white-card catalog.
              </p>
            </div>

            <div className="self-end rounded-[2rem] border border-[#d7e8ff] bg-[#f4f9ff] p-4">
              <label className="relative block">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6f86a6]" />
                <input
                  type="search"
                  placeholder="Search Tokyo, Paris, Global"
                  className="h-14 w-full rounded-full border border-[#cfe2ff] bg-white pl-11 pr-4 font-semibold text-[#071d49] outline-none transition focus:border-[#1167e8] focus:ring-4 focus:ring-[#dcecff]"
                />
              </label>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs font-extrabold uppercase tracking-[0.14em] text-[#42617f]">
                <span className="rounded-full bg-white px-3 py-2 shadow-sm">QR ready</span>
                <span className="rounded-full bg-white px-3 py-2 shadow-sm">5G speed</span>
                <span className="rounded-full bg-white px-3 py-2 shadow-sm">USD pricing</span>
              </div>
            </div>
          </div>

          <div className="mt-8 grid gap-7 xl:grid-cols-[18rem_1fr]">
            <aside className="h-fit rounded-[2rem] border border-[#d7e8ff] bg-white p-5 shadow-[0_18px_45px_rgba(16,88,178,0.08)] xl:sticky xl:top-28">
              <div className="mb-6 flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#eaf4ff] text-[#1167e8]">
                  <SlidersHorizontal className="h-4 w-4" />
                </span>
                <h2 className="font-extrabold text-[#071d49]">Refine</h2>
              </div>
              <FilterGroup title="Region" options={regionFilters} />
              <FilterGroup title="Data" options={dataOptions} />
              <FilterGroup title="Duration" options={durations} />
              <button type="button" className="mt-3 w-full rounded-full border border-[#cfe2ff] bg-white px-4 py-3 text-sm font-extrabold text-[#0b4eb8] transition hover:border-[#1167e8] hover:bg-[#f4f9ff]">
                Reset filters
              </button>
            </aside>

            <div>
              <div className="mb-5 flex flex-col justify-between gap-4 rounded-[1.75rem] border border-[#d7e8ff] bg-white p-4 shadow-[0_14px_36px_rgba(16,88,178,0.07)] sm:flex-row sm:items-center">
                <div>
                  <p className="text-sm font-extrabold text-[#071d49]">
                    {totalProducts || products.length} plans available
                  </p>
                  <p className="mt-1 text-xs font-semibold text-[#6b7b94]">Blue-white cards, USD prices, and instant eSIM fulfillment.</p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={sortBy}
                    onChange={(event) => onSortChange(event.target.value)}
                    className="h-11 rounded-full border border-[#cfe2ff] bg-white px-4 text-sm font-bold text-[#071d49] outline-none focus:border-[#1167e8]"
                  >
                    <option value="popular">Most popular</option>
                    <option value="price_asc">Price: low to high</option>
                    <option value="price_desc">Price: high to low</option>
                    <option value="rating">Best rated</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => onViewModeChange('grid')}
                    className={cn(
                      'flex h-11 w-11 items-center justify-center rounded-full border transition',
                      viewMode === 'grid' ? 'border-[#1167e8] bg-[#1167e8] text-white' : 'border-[#cfe2ff] text-[#6b7b94] hover:border-[#1167e8]',
                    )}
                    aria-label="Grid view"
                  >
                    <Grid2X2 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onViewModeChange('list')}
                    className={cn(
                      'flex h-11 w-11 items-center justify-center rounded-full border transition',
                      viewMode === 'list' ? 'border-[#1167e8] bg-[#1167e8] text-white' : 'border-[#cfe2ff] text-[#6b7b94] hover:border-[#1167e8]',
                    )}
                    aria-label="List view"
                  >
                    <List className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {products.length === 0 ? (
                <div className="rounded-[2rem] border border-[#d7e8ff] bg-white px-6 py-20 text-center shadow-[0_18px_45px_rgba(16,88,178,0.08)]">
                  <h3 className="text-3xl font-black tracking-[-0.04em] text-[#071d49]">No plans found</h3>
                  <p className="mt-3 text-[#6b7b94]">Try a broader destination or fewer filters.</p>
                </div>
              ) : (
                <div className={cn(viewMode === 'list' ? 'grid gap-5' : 'grid gap-5 md:grid-cols-2 2xl:grid-cols-3')}>
                  {products.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      viewMode={viewMode}
                      showWishlist={false}
                      onAddToCart={() => void onAddToCart(product.id)}
                      onClick={() => onProductClick(product.id)}
                    />
                  ))}
                </div>
              )}

              {totalPages > 1 ? (
                <div className="mt-8 flex items-center justify-center gap-2">
                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => onPageChange(currentPage - 1)}
                    className="rounded-full border border-[#cfe2ff] bg-white px-4 py-2 text-sm font-extrabold text-[#0b4eb8] disabled:opacity-40"
                  >
                    Previous
                  </button>
                  {pages.map((page) => (
                    <button
                      key={page}
                      type="button"
                      onClick={() => onPageChange(page)}
                      className={cn(
                        'flex h-10 min-w-[2.5rem] items-center justify-center rounded-full px-3 text-sm font-extrabold transition',
                        currentPage === page
                          ? 'bg-[#1167e8] text-white'
                          : 'border border-[#cfe2ff] bg-white text-[#0b4eb8]',
                      )}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={currentPage >= totalPages}
                    onClick={() => onPageChange(currentPage + 1)}
                    className="rounded-full border border-[#cfe2ff] bg-white px-4 py-2 text-sm font-extrabold text-[#0b4eb8] disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
});

function MobileExplore({
  brandName,
  products,
  totalProducts,
  onProductClick,
}: {
  brandName: string;
  products: Product[];
  totalProducts: number;
  onProductClick: (productId: string) => void;
}) {
  const featuredTarget = products.find((product) => productText(product).includes('tokyo') || productText(product).includes('japan')) || products[0];
  const recentPlans = getRecentPlans(products);

  return (
    <section className="block min-h-[100svh] bg-[#f7fbff] lg:hidden">
      <div className="mx-auto min-h-[100svh] w-full max-w-[430px] bg-white px-5 pb-32 pt-3 shadow-[0_24px_80px_rgba(8,54,126,0.08)]">
        <div className="relative flex h-9 items-center justify-between text-[13px] font-black text-[#071d49]">
          <span>9:41</span>
          <span className="absolute left-1/2 top-1.5 h-6 w-24 -translate-x-1/2 rounded-full bg-[#05070d]" aria-hidden="true" />
          <div className="flex items-center gap-1.5 text-[11px]">
            <span>5G</span>
            <span className="h-3 w-5 rounded-sm border border-[#071d49] p-0.5">
              <span className="block h-full rounded-[2px] bg-[#071d49]" />
            </span>
          </div>
        </div>

        <header className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-[1rem] bg-[#071d49] text-base font-black text-white shadow-[0_12px_24px_rgba(7,29,73,0.18)]">
              Y
            </span>
            <span className="text-[22px] font-black tracking-[-0.04em] text-[#071d49]">{brandName}</span>
          </div>
          <button
            type="button"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-[#e0ecfa] bg-white text-[#071d49] shadow-[0_10px_24px_rgba(8,54,126,0.08)]"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
          </button>
        </header>

        <section className="mt-7">
          <p className="text-[15px] font-extrabold text-[#6b7b94]">Explore</p>
          <h1 className="mt-1 text-[34px] font-black leading-[1.02] tracking-[-0.055em] text-[#071d49]">
            Where are you landing?
          </h1>
        </section>

        <label className="mt-6 flex h-14 items-center gap-3 rounded-[1.4rem] border border-[#dcecff] bg-[#f5f9ff] px-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
          <Search className="h-5 w-5 text-[#7c91ad]" />
          <input
            type="search"
            placeholder="Search destination"
            className="w-full bg-transparent text-[15px] font-bold text-[#071d49] outline-none placeholder:text-[#8ba0ba]"
          />
        </label>

        <div className="mt-4 flex gap-2.5 overflow-x-auto pb-1 scrollbar-hide" aria-label="Explore filters">
          {['Popular', 'Nearby', 'All regions'].map((pill, index) => (
            <button
              key={pill}
              type="button"
              className={cn(
                'shrink-0 rounded-full px-4 py-2.5 text-sm font-extrabold transition',
                index === 0 ? 'bg-[#1167e8] text-white shadow-[0_12px_28px_rgba(17,103,232,0.28)]' : 'bg-[#eef6ff] text-[#31557f]',
              )}
            >
              {pill}
            </button>
          ))}
        </div>

        <div className="mt-7 flex items-center justify-between">
          <h2 className="text-xl font-black tracking-[-0.04em] text-[#071d49]">Featured plan</h2>
          <span className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#6b7b94]">
            {totalProducts || products.length || 'Live'} plans
          </span>
        </div>

        <article className="mt-3 overflow-hidden rounded-[2.1rem] border border-[#d7e8ff] bg-white shadow-[0_24px_50px_rgba(16,88,178,0.14)]">
          <div className="relative h-[164px] overflow-hidden bg-[#dcecff]">
            <TokyoPlanArt />
          </div>
          <div className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[13px] font-extrabold uppercase tracking-[0.18em] text-[#1167e8]">Tokyo</p>
                <h3 className="mt-1 text-2xl font-black tracking-[-0.045em] text-[#071d49]">5GB 15 days</h3>
              </div>
              <div className="rounded-full bg-[#eef6ff] px-3 py-1.5 text-xs font-black text-[#0b4eb8]">Japan</div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <span className="flex items-center gap-2 rounded-2xl bg-[#f4f9ff] px-3 py-2 text-xs font-extrabold text-[#31557f]">
                <Wifi className="h-4 w-4 text-[#1167e8]" />
                High speed
              </span>
              <span className="flex items-center gap-2 rounded-2xl bg-[#f4f9ff] px-3 py-2 text-xs font-extrabold text-[#31557f]">
                <QrCode className="h-4 w-4 text-[#1167e8]" />
                QR delivery
              </span>
            </div>

            <div className="mt-5 flex items-center justify-between">
              <div className="flex items-end gap-1.5">
                <span className="text-[28px] font-black leading-none tracking-[-0.055em] text-[#071d49]">$4.50</span>
                <span className="pb-0.5 text-xs font-black uppercase tracking-[0.16em] text-[#6b7b94]">USD</span>
              </div>
              <button
                type="button"
                onClick={() => featuredTarget ? onProductClick(featuredTarget.id) : undefined}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1167e8] text-white shadow-[0_16px_34px_rgba(17,103,232,0.32)] transition hover:bg-[#0b4eb8]"
                aria-label="Open Tokyo plan"
              >
                <ArrowRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        </article>

        <section className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black tracking-[-0.04em] text-[#071d49]">Popular destinations</h2>
            <button type="button" className="text-sm font-extrabold text-[#1167e8]">See all</button>
          </div>
          <div className="mt-3 grid gap-3">
            {popularDestinations.map((destination) => {
              const match = findDestinationProduct(products, destination.query);
              return (
                <button
                  key={destination.code}
                  type="button"
                  onClick={() => match ? onProductClick(match.id) : undefined}
                  className="flex items-center gap-3 rounded-[1.35rem] border border-[#e0ecfa] bg-white p-3 text-left shadow-[0_10px_26px_rgba(8,54,126,0.06)] transition hover:border-[#b7d6ff] hover:bg-[#f8fbff]"
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-[1rem] bg-[#eef6ff] text-xs font-black text-[#1167e8]">
                    {destination.code}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-base font-black tracking-[-0.025em] text-[#071d49]">{destination.name}</span>
                    <span className="mt-0.5 block text-xs font-bold text-[#6b7b94]">{destination.country} · {destination.helper}</span>
                  </span>
                  <ChevronRight className="h-5 w-5 text-[#9bb0ca]" />
                </button>
              );
            })}
          </div>
        </section>

        <section className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black tracking-[-0.04em] text-[#071d49]">Recently viewed</h2>
            <span className="text-sm font-extrabold text-[#6b7b94]">Swipe</span>
          </div>
          <div className="-mx-5 mt-3 flex gap-3 overflow-x-auto px-5 pb-2 scrollbar-hide">
            {recentPlans.map((entry, index) => (
              <RecentPlanCard
                key={entry.product?.id || `${entry.plan.destination}-${index}`}
                plan={entry.plan}
                price={entry.product?.price ?? (index === 0 ? 4.5 : 6 + index)}
                onClick={() => entry.product ? onProductClick(entry.product.id) : undefined}
              />
            ))}
          </div>
        </section>
      </div>

      <MobileBottomNav />
    </section>
  );
}

function MobileBottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-[70] lg:hidden" aria-label="Mobile tabs">
      <div
        className="mx-auto max-w-[430px] px-5 pb-4"
        style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
      >
        <div className="grid grid-cols-4 rounded-[1.75rem] border border-[#d7e8ff] bg-white p-2 shadow-[0_18px_46px_rgba(8,54,126,0.16)]">
          <MobileTab icon={<Compass className="h-5 w-5" />} label="Explore" active />
          <MobileTab icon={<Smartphone className="h-5 w-5" />} label="My eSIMs" />
          <MobileTab icon={<CircleUserRound className="h-5 w-5" />} label="Profile" />
          <MobileTab icon={<MoreHorizontal className="h-5 w-5" />} label="More" />
        </div>
      </div>
    </nav>
  );
}

function MobileTab({ icon, label, active = false }: { icon: React.ReactNode; label: string; active?: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        'flex flex-col items-center justify-center gap-1 rounded-[1.1rem] px-1 py-2 text-[11px] font-black transition',
        active ? 'bg-[#eef6ff] text-[#1167e8]' : 'text-[#7c91ad] hover:bg-[#f8fbff]',
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function RecentPlanCard({ plan, price, onClick }: { plan: PlanDisplay; price: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-w-[148px] rounded-[1.55rem] border border-[#d7e8ff] bg-white p-3 text-left shadow-[0_12px_28px_rgba(8,54,126,0.08)]"
    >
      <div className="relative h-20 overflow-hidden rounded-[1.15rem] bg-gradient-to-br from-[#1c76ff] via-[#5fb1ff] to-[#d4ebff]">
        <MiniPlanArt />
      </div>
      <p className="mt-3 truncate text-sm font-black tracking-[-0.025em] text-[#071d49]">{plan.destination}</p>
      <p className="mt-1 text-xs font-extrabold text-[#6b7b94]">{plan.data} · {plan.validity}</p>
      <p className="mt-2 text-base font-black tracking-[-0.04em] text-[#1167e8]">${price.toFixed(2)}</p>
    </button>
  );
}

function FilterGroup({ title, options }: { title: string; options: string[] }) {
  return (
    <div className="mb-7">
      <h3 className="mb-3 text-xs font-extrabold uppercase tracking-[0.18em] text-[#6b7b94]">{title}</h3>
      <div className="grid gap-2">
        {options.map((option, index) => (
          <label
            key={option}
            className={cn(
              'flex cursor-pointer items-center gap-3 rounded-2xl px-3 py-2 text-sm font-bold transition',
              index === 0 ? 'bg-[#eef6ff] text-[#0b4eb8]' : 'text-[#31557f] hover:bg-[#f4f9ff]',
            )}
          >
            <input type="checkbox" className="h-4 w-4 rounded border-[#b7d6ff] text-[#1167e8] focus:ring-[#1167e8]" defaultChecked={index === 0} />
            {option}
          </label>
        ))}
      </div>
    </div>
  );
}

function MobileExploreSkeleton({ brandName }: { brandName: string }) {
  return (
    <section className="block min-h-[100svh] bg-[#f7fbff] lg:hidden">
      <div className="mx-auto min-h-[100svh] w-full max-w-[430px] bg-white px-5 pb-32 pt-3">
        <div className="relative flex h-9 items-center justify-between text-[13px] font-black text-[#071d49]">
          <span>9:41</span>
          <span className="absolute left-1/2 top-1.5 h-6 w-24 -translate-x-1/2 rounded-full bg-[#05070d]" aria-hidden="true" />
          <span>5G</span>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-[1rem] bg-[#071d49] text-base font-black text-white">Y</span>
            <span className="text-[22px] font-black tracking-[-0.04em]">{brandName}</span>
          </div>
          <span className="h-11 w-11 rounded-full bg-[#eef6ff]" />
        </div>
        <div className="mt-8 h-9 w-24 animate-pulse rounded-full bg-[#eef6ff]" />
        <div className="mt-2 h-20 animate-pulse rounded-[1.5rem] bg-[#eef6ff]" />
        <div className="mt-6 h-14 animate-pulse rounded-[1.4rem] bg-[#eef6ff]" />
        <div className="mt-6 h-[315px] animate-pulse rounded-[2.1rem] bg-[#eef6ff]" />
        <div className="mt-8 grid gap-3">
          <div className="h-16 animate-pulse rounded-[1.35rem] bg-[#eef6ff]" />
          <div className="h-16 animate-pulse rounded-[1.35rem] bg-[#eef6ff]" />
          <div className="h-16 animate-pulse rounded-[1.35rem] bg-[#eef6ff]" />
        </div>
      </div>
      <MobileBottomNav />
    </section>
  );
}

function DesktopProductsSkeleton() {
  return (
    <section className="hidden min-h-screen bg-[#edf6ff] px-8 pb-24 pt-12 lg:block xl:px-12">
      <div className="mx-auto max-w-[var(--esim-container)]">
        <div className="h-72 animate-pulse rounded-[2.25rem] bg-white shadow-[0_28px_80px_rgba(16,88,178,0.08)]" />
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          <div className="h-80 animate-pulse rounded-[2rem] bg-white" />
          <div className="h-80 animate-pulse rounded-[2rem] bg-white" />
          <div className="h-80 animate-pulse rounded-[2rem] bg-white" />
        </div>
      </div>
    </section>
  );
}

function TokyoPlanArt() {
  return (
    <svg className="h-full w-full" viewBox="0 0 390 164" fill="none" role="img" aria-label="Tokyo skyline and blue sky">
      <rect width="390" height="164" fill="url(#tokyoSky)" />
      <circle cx="310" cy="40" r="26" fill="#fff7c2" opacity="0.95" />
      <path d="M0 121C48 98 82 107 122 92C168 74 205 89 246 78C291 66 326 72 390 50V164H0V121Z" fill="#d5ecff" />
      <path d="M0 135C45 119 93 124 137 112C195 96 232 112 279 99C320 88 352 94 390 80V164H0V135Z" fill="#b9ddff" />
      <rect x="42" y="88" width="28" height="76" rx="4" fill="#0c3d8c" />
      <rect x="78" y="70" width="42" height="94" rx="5" fill="#115ad0" />
      <rect x="132" y="100" width="32" height="64" rx="4" fill="#0b4eb8" />
      <rect x="272" y="84" width="36" height="80" rx="5" fill="#0c3d8c" />
      <path d="M204 34L224 164H184L204 34Z" fill="#08306f" />
      <path d="M190 74H218M186 98H222M182 122H226" stroke="#7fbfff" strokeWidth="3" strokeLinecap="round" />
      <path d="M28 128C77 108 124 121 171 101C209 85 251 93 295 74C324 61 352 58 380 55" stroke="white" strokeWidth="4" strokeLinecap="round" opacity="0.78" />
      <path d="M28 128C77 108 124 121 171 101C209 85 251 93 295 74C324 61 352 58 380 55" stroke="#1167e8" strokeWidth="1.4" strokeDasharray="6 9" strokeLinecap="round" />
      <defs>
        <linearGradient id="tokyoSky" x1="40" y1="-3" x2="360" y2="164" gradientUnits="userSpaceOnUse">
          <stop stopColor="#5DB5FF" />
          <stop offset="0.55" stopColor="#B9E0FF" />
          <stop offset="1" stopColor="#EFF8FF" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function MiniPlanArt() {
  return (
    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 148 80" fill="none" aria-hidden="true">
      <circle cx="114" cy="18" r="13" fill="#fff7c2" />
      <path d="M0 54C23 44 43 48 63 39C88 28 110 36 148 20V80H0V54Z" fill="#d5ecff" opacity="0.92" />
      <rect x="17" y="43" width="13" height="37" rx="2" fill="#0c3d8c" />
      <rect x="35" y="32" width="20" height="48" rx="3" fill="#115ad0" />
      <path d="M82 20L94 80H70L82 20Z" fill="#08306f" />
      <path d="M7 58C30 48 55 54 75 43C94 33 114 34 142 23" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function getRecentPlans(products: Product[]): Array<{ product: Product | null; plan: PlanDisplay }> {
  if (products.length > 0) {
    return products.slice(0, 6).map((product, index) => ({
      product,
      plan: getPlanDisplay(product, index),
    }));
  }

  return FEATURED_PLANS.map((plan) => ({
    product: null,
    plan,
  }));
}

function findDestinationProduct(products: Product[], query: string): Product | undefined {
  const needles = query.split(' ').filter(Boolean);
  return products.find((product) => {
    const text = productText(product);
    return needles.some((needle) => text.includes(needle));
  });
}

function productText(product: Product): string {
  const category = product.category as Product['category'] | string | undefined;
  const categoryName = typeof category === 'string' ? category : category?.name || category?.slug || '';
  const tags = Array.isArray(product.tags) ? product.tags.join(' ') : '';
  return `${product.name || ''} ${product.description || ''} ${product.sku || ''} ${categoryName} ${tags}`.toLowerCase();
}

function getVisiblePages(currentPage: number, totalPages: number): number[] {
  const pages: number[] = [];
  const maxVisible = 5;
  let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
  const end = Math.min(totalPages, start + maxVisible - 1);

  if (end - start + 1 < maxVisible) {
    start = Math.max(1, end - maxVisible + 1);
  }

  for (let page = start; page <= end; page += 1) {
    pages.push(page);
  }

  return pages;
}

export default ProductsPage;
