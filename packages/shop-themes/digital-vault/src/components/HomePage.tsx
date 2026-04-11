import React from 'react';
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Download,
  KeyRound,
  Search,
  ShieldCheck,
  ShoppingBag,
  UserSquare2,
} from 'lucide-react';
import type { HomePageProps } from '../types/theme';
import { isExternalHref, resolveVaultSiteConfig } from '../site';

export const HomePage = React.memo(function HomePage({ config, onNavigate }: HomePageProps) {
  const site = resolveVaultSiteConfig(config);
  const [bannerIndex, setBannerIndex] = React.useState(0);
  const banners = site.heroBanners;
  const activeBanner = banners[bannerIndex] || banners[0];

  const openHref = React.useCallback(
    (href: string) => {
      if (isExternalHref(href)) {
        window.open(href, '_blank', 'noopener,noreferrer');
        return;
      }
      onNavigate?.(href);
    },
    [onNavigate]
  );

  React.useEffect(() => {
    if (banners.length <= 1) return;

    const timer = window.setInterval(() => {
      setBannerIndex((current) => (current + 1) % banners.length);
    }, 6000);

    return () => window.clearInterval(timer);
  }, [banners.length]);

  React.useEffect(() => {
    if (bannerIndex >= banners.length) {
      setBannerIndex(0);
    }
  }, [bannerIndex, banners.length]);

  const categories = [
    {
      icon: CreditCard,
      label: 'Gift cards',
      detail: 'Stored-value cards, vouchers, game balance, and prepaid codes.',
      href: '/search?q=gift%20card',
    },
    {
      icon: KeyRound,
      label: 'Redeem codes',
      detail: 'Activation keys, one-time claims, serials, and PIN delivery.',
      href: '/search?q=code',
    },
    {
      icon: UserSquare2,
      label: 'Accounts',
      detail: 'Login credentials, shared access packs, and bundled accounts.',
      href: '/search?q=account',
    },
    {
      icon: Download,
      label: 'Downloads',
      detail: 'Files, templates, installers, resources, and digital assets.',
      href: '/search?q=download',
    },
  ];

  const highlights = [
    'Stock and delivery state stay visible before payment.',
    'Guest buyers can still return to their order center.',
    'Digital fulfillment stays inside the order archive, not in scattered emails.',
  ];

  return (
    <div className="min-h-screen bg-[var(--vault-bg)] text-[var(--vault-ink)]">
      <section className="border-b border-[var(--vault-line)] px-4 pb-10 pt-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1280px]">
          <div
            className="overflow-hidden rounded-[var(--vault-radius-lg)] border border-[var(--vault-line-strong)] shadow-[var(--vault-shadow)]"
            style={{
              backgroundImage: activeBanner?.imageUrl
                ? `linear-gradient(135deg, rgba(10, 18, 32, 0.86), rgba(17, 24, 39, 0.72)), url(${activeBanner.imageUrl})`
                : 'linear-gradient(135deg,#0f172a,#111827 45%,#1d4ed8)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          >
            <div className="grid gap-8 px-6 py-8 text-white md:px-8 md:py-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(19rem,0.85fr)] lg:px-10">
              <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/90">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    {activeBanner?.badge || site.eyebrow}
                  </span>
                  {banners.length > 1 ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setBannerIndex((current) => (current - 1 + banners.length) % banners.length)}
                        className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/20 text-white transition-colors hover:bg-black/35"
                        aria-label="Previous banner"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setBannerIndex((current) => (current + 1) % banners.length)}
                        className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/20 text-white transition-colors hover:bg-black/35"
                        aria-label="Next banner"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  ) : null}
                </div>

                <div className="space-y-4">
                  <h1 className="max-w-[12ch] text-[clamp(2.2rem,5vw,4.2rem)] font-black leading-[0.98] tracking-[-0.045em]">
                    {activeBanner?.title || site.headline}
                  </h1>
                  <p className="max-w-[38rem] text-sm leading-7 text-white/78 sm:text-base">
                    {activeBanner?.subtitle || site.subheadline}
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => openHref(activeBanner?.primaryHref || site.primaryCtaHref)}
                    className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-[#111827] transition-transform hover:-translate-y-0.5"
                  >
                    <ShoppingBag className="h-4 w-4" />
                    {activeBanner?.primaryLabel || site.primaryCtaLabel}
                  </button>
                  {(activeBanner?.secondaryLabel || site.secondaryCtaLabel) && (activeBanner?.secondaryHref || site.secondaryCtaHref) ? (
                    <button
                      onClick={() => openHref(activeBanner?.secondaryHref || site.secondaryCtaHref)}
                      className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/15"
                    >
                      <ArrowRight className="h-4 w-4" />
                      {activeBanner?.secondaryLabel || site.secondaryCtaLabel}
                    </button>
                  ) : null}
                </div>

                {banners.length > 1 ? (
                  <div className="flex items-center gap-2 pt-1">
                    {banners.map((banner, index) => (
                      <button
                        key={banner.id}
                        onClick={() => setBannerIndex(index)}
                        className={index === bannerIndex ? 'h-2 w-7 rounded-full bg-white' : 'h-2 w-2 rounded-full bg-white/45'}
                        aria-label={`Open banner ${index + 1}`}
                      />
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="rounded-[var(--vault-radius-lg)] border border-white/10 bg-white/8 p-5 backdrop-blur-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">Quick access</p>
                <div className="mt-4 grid gap-3">
                  {[
                    { label: 'Browse products', href: '/products' },
                    { label: 'Track guest order', href: '/guest/orders' },
                    { label: 'Open help center', href: '/help' },
                  ].map((item) => (
                    <button
                      key={item.label}
                      onClick={() => openHref(item.href)}
                      className="flex items-center justify-between rounded-xl border border-white/10 bg-black/10 px-4 py-3 text-left text-sm font-medium text-white/84 transition-colors hover:bg-black/20"
                    >
                      <span>{item.label}</span>
                      <ArrowRight className="h-4 w-4 text-white/60" />
                    </button>
                  ))}
                </div>

                <div className="mt-5 grid gap-2 text-sm text-white/76">
                  {[
                    'Stock is visible before checkout.',
                    'Guest buyers can recover their orders later.',
                    'Delivery stays attached to the order center.',
                  ].map((item) => (
                    <div key={item} className="flex items-start gap-2">
                      <span className="mt-2 h-1.5 w-1.5 rounded-full bg-white/70" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-[var(--vault-copy)]">
            {highlights.map((item) => (
              <div key={item} className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--vault-primary)]" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1280px]">
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--vault-copy-soft)]">Browse by category</p>
              <h2 className="mt-2 text-[clamp(2rem,4vw,3.2rem)] font-black leading-[1.02] tracking-[-0.04em] text-[var(--vault-ink)]">
                Find the format you want before you get to checkout.
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--vault-copy)]">
                Keep the entry simple: choose the delivery format first, then open the products that match.
              </p>
            </div>
            <button
              onClick={() => onNavigate?.('/products')}
              className="hidden rounded-xl border border-[var(--vault-line)] bg-[var(--vault-surface)] px-4 py-3 text-sm font-medium text-[var(--vault-ink)] transition-colors hover:bg-[var(--vault-primary-soft)] md:inline-flex"
            >
              See all products
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {categories.map(({ icon: Icon, label, detail, href }) => (
              <button
                key={label}
                onClick={() => onNavigate?.(href)}
                className="group rounded-[var(--vault-radius-lg)] border border-[var(--vault-line)] bg-[var(--vault-surface)] p-5 text-left shadow-[var(--vault-shadow-soft)] transition-all hover:-translate-y-1 hover:border-[var(--vault-line-strong)] hover:shadow-[var(--vault-shadow)]"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--vault-primary-soft)] text-[var(--vault-primary)]">
                  <Icon className="h-5 w-5" />
                </div>
                <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--vault-copy-soft)]">Category</p>
                <h3 className="mt-2 text-xl font-bold tracking-tight text-[var(--vault-ink)]">{label}</h3>
                <p className="mt-2 min-h-[4.5rem] text-sm leading-6 text-[var(--vault-copy)]">{detail}</p>
                <span className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-[var(--vault-primary)]">
                  Open category
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
              </button>
            ))}
          </div>

          <div className="mt-8 rounded-[var(--vault-radius-lg)] border border-[var(--vault-line)] bg-[var(--vault-surface)] p-6 shadow-[var(--vault-shadow-soft)]">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.7fr)]">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--vault-copy-soft)]">Why this storefront is calmer</p>
                <h3 className="mt-3 text-2xl font-black tracking-[-0.04em] text-[var(--vault-ink)]">
                  Fewer surprises before checkout.
                </h3>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--vault-copy)]">
                  The catalog avoids noisy promo clutter and keeps the critical questions obvious: what format is this, how is it delivered, and where will the buyer reclaim it later.
                </p>
              </div>

              <div className="grid gap-3">
                {[
                  'Category-led browsing instead of one giant mixed grid.',
                  'Order center stays the single archive for delivery data.',
                  'Guest lookup remains available without creating friction.',
                ].map((item) => (
                  <div key={item} className="rounded-xl border border-[var(--vault-line)] bg-[var(--vault-surface-alt)] px-4 py-3 text-sm leading-6 text-[var(--vault-copy)]">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
});
