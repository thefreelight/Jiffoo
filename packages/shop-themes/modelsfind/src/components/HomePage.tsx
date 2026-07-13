import React from 'react';
import {
  Compass,
  Heart,
  Search,
  Sparkles,
  WandSparkles,
} from 'lucide-react';
import type { HomePageProps } from 'shared/src/types/theme';
import { heroRegions, isExternalHref, previewPortraits, resolveModelsfindSiteConfig } from '../site';

const desktopNav = ['Collection', 'Boards', 'Services', 'Access'] as const;

export const HomePage = React.memo(function HomePage({ config, onNavigate }: HomePageProps) {
  const site = resolveModelsfindSiteConfig(config);

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

  const heroPortrait = previewPortraits[0];
  const featuredGrid = previewPortraits.slice(0, 6);

  return (
    <div className="modelsfind-shell min-h-screen px-4 pb-24 pt-20 [font-family:var(--modelsfind-body)] text-[var(--modelsfind-ink)] sm:px-6 sm:pt-24 lg:px-8">
      <div className="mx-auto max-w-[1040px]">
        <div className="modelsfind-frame overflow-hidden rounded-[2rem] border border-[var(--modelsfind-line-strong)] bg-[rgba(10,8,12,0.96)]">
          <div className="hidden items-center gap-6 border-b border-[var(--modelsfind-line)] px-5 py-4 md:flex">
            <button
              type="button"
              onClick={() => openHref('/')}
              className="[font-family:var(--modelsfind-display)] text-[1.1rem] font-semibold tracking-[-0.03em] text-[var(--modelsfind-primary)]"
            >
              {site.brandName}
            </button>

            <nav className="flex items-center gap-5">
              {desktopNav.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => openHref(item === 'Collection' ? '/products' : item === 'Access' ? '/auth/register' : '/')}
                  className={[
                    'text-[11px] uppercase tracking-[0.2em] transition-colors',
                    item === 'Collection'
                      ? 'text-[var(--modelsfind-primary)]'
                      : 'text-[var(--modelsfind-copy-soft)] hover:text-[var(--modelsfind-copy)]',
                  ].join(' ')}
                >
                  {item}
                </button>
              ))}
            </nav>

            <div className="ml-auto flex min-w-[17rem] items-center gap-2 rounded-full border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.02)] px-4 py-2">
              <Search className="h-4 w-4 text-[var(--modelsfind-copy-soft)]" />
              <span className="text-xs text-[var(--modelsfind-copy-soft)]">Search models</span>
            </div>
          </div>

          <div className="flex items-center justify-between border-b border-[var(--modelsfind-line)] px-4 py-3 md:hidden">
            <button
              type="button"
              onClick={() => openHref('/')}
              className="[font-family:var(--modelsfind-display)] text-base font-semibold tracking-[-0.03em] text-[var(--modelsfind-primary)]"
            >
              {site.brandName}
            </button>
            <button
              type="button"
              onClick={() => openHref('/products')}
              className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--modelsfind-copy)]"
              aria-label="Search models"
            >
              <Search className="h-4 w-4" />
            </button>
          </div>

          <div className="grid md:grid-cols-[10.5rem_minmax(0,1fr)]">
            <aside className="hidden border-r border-[var(--modelsfind-line)] bg-[rgba(20,16,22,0.72)] px-4 py-5 md:block">
              <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--modelsfind-copy-soft)]">Regions</p>
              <div className="mt-4 grid gap-2">
                {heroRegions.map((region, index) => (
                  <button
                    key={region}
                    type="button"
                    onClick={() => openHref(`/products?region=${encodeURIComponent(region)}`)}
                    className={[
                      'rounded-[0.9rem] border px-3 py-3 text-left text-[11px] uppercase tracking-[0.18em] transition-colors',
                      index === 0
                        ? 'border-[var(--modelsfind-primary)] bg-[var(--modelsfind-primary-soft)] text-[var(--modelsfind-ink)]'
                        : 'border-[var(--modelsfind-line)] text-[var(--modelsfind-copy-soft)] hover:text-[var(--modelsfind-copy)]',
                    ].join(' ')}
                  >
                    {region}
                  </button>
                ))}
              </div>
            </aside>

            <div className="p-4 md:p-5">
              <div className="modelsfind-portrait relative min-h-[26rem] overflow-hidden rounded-[1.45rem] border border-[var(--modelsfind-line)] bg-[rgba(12,10,14,0.94)] md:min-h-[22rem]">
                <img
                  src={heroPortrait.image}
                  alt={heroPortrait.name}
                  className="absolute inset-0 h-full w-full object-cover object-center saturate-[1.08] contrast-[1.06]"
                />
                <div className="relative z-10 flex h-full flex-col justify-end px-5 pb-5 pt-8 sm:px-7 sm:pb-7">
                  <p className="text-[10px] uppercase tracking-[0.32em] text-[var(--modelsfind-copy-soft)]">Est. 2026</p>
                  <h1 className="mt-3 max-w-[18rem] [font-family:var(--modelsfind-display)] text-[clamp(3rem,7vw,5.2rem)] font-semibold leading-[0.9] tracking-[-0.05em] text-[var(--modelsfind-ink)]">
                    {site.brandName}
                  </h1>
                  <p className="mt-2 max-w-[26rem] text-sm leading-6 text-[var(--modelsfind-copy)]">
                    Defining a refined home for curated model profiles and premium appointment requests.
                  </p>

                  <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
                    <button
                      type="button"
                      onClick={() => openHref('/products')}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[linear-gradient(145deg,color-mix(in_oklab,var(--modelsfind-primary)_82%,white),color-mix(in_oklab,var(--modelsfind-primary)_72%,black))] px-5 text-[11px] font-semibold uppercase tracking-[0.22em] text-white"
                    >
                      Explore collection
                    </button>
                    <button
                      type="button"
                      onClick={() => openHref('/auth/register')}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[var(--modelsfind-line-strong)] bg-[rgba(20,16,22,0.68)] px-5 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--modelsfind-ink)]"
                    >
                      Request access
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-6 md:hidden">
                <p className="text-[10px] uppercase tracking-[0.24em] text-[var(--modelsfind-copy-soft)]">Selected regions</p>
                <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                  {heroRegions.map((region, index) => (
                    <button
                      key={region}
                      type="button"
                      onClick={() => openHref(`/products?region=${encodeURIComponent(region)}`)}
                      className={[
                        'whitespace-nowrap rounded-full border px-3 py-2 text-[10px] uppercase tracking-[0.18em]',
                        index === 0
                          ? 'border-[var(--modelsfind-primary)] bg-[var(--modelsfind-primary-soft)] text-[var(--modelsfind-ink)]'
                          : 'border-[var(--modelsfind-line)] text-[var(--modelsfind-copy)]',
                      ].join(' ')}
                    >
                      {region}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <h2 className="[font-family:var(--modelsfind-display)] text-[2rem] leading-none tracking-[-0.04em] text-[var(--modelsfind-ink)] md:text-[2.35rem]">
                    Featured Models
                  </h2>
                  <p className="mt-2 text-xs text-[var(--modelsfind-copy-soft)]">Showing 72 elite editorials across China</p>
                </div>

                <div className="hidden items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-[var(--modelsfind-copy-soft)] md:flex">
                  <Compass className="h-3.5 w-3.5 text-[var(--modelsfind-primary)]" />
                  Curated nightly
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
                {featuredGrid.map((portrait, index) => (
                  <article
                    key={portrait.name}
                    className="group overflow-hidden rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(19,15,22,0.92)]"
                  >
                    <button
                      type="button"
                      onClick={() => openHref('/products')}
                      className="block w-full text-left"
                    >
                      <div className="relative aspect-[0.78] overflow-hidden">
                        <img
                          src={portrait.image}
                          alt={portrait.name}
                          className="h-full w-full object-cover saturate-[1.08] contrast-[1.05] transition-transform duration-500 group-hover:scale-[1.03]"
                        />
                        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,8,12,0.04),rgba(10,8,12,0.72))]" />
                        {index === 2 ? (
                          <div className="absolute right-2 top-2 rounded-full bg-[rgba(30,24,34,0.92)] px-2 py-1 text-[9px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy)]">
                            Private match
                          </div>
                        ) : null}
                      </div>
                    </button>

                    <div className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="[font-family:var(--modelsfind-display)] text-[1.25rem] leading-none tracking-[-0.04em] text-[var(--modelsfind-ink)]">
                            {portrait.name}
                          </h3>
                          <p className="mt-1 text-[11px] text-[var(--modelsfind-copy-soft)]">{portrait.mood}</p>
                        </div>
                        <Heart className="mt-0.5 h-3.5 w-3.5 text-[var(--modelsfind-primary)]" />
                      </div>

                      <button
                        type="button"
                        onClick={() => openHref('/products')}
                        className="mt-3 inline-flex min-h-8 w-full items-center justify-center rounded-full border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.02)] px-3 text-[9px] font-semibold uppercase tracking-[0.24em] text-[var(--modelsfind-copy)] transition-colors hover:border-[var(--modelsfind-primary)] hover:text-[var(--modelsfind-ink)]"
                      >
                        Reserve
                      </button>
                    </div>
                  </article>
                ))}
              </div>

              <div className="mt-5 rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(31,23,34,0.82)] p-4 md:max-w-[18rem]">
                <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-[var(--modelsfind-primary)]">
                  <WandSparkles className="h-3.5 w-3.5" />
                  AI concierge
                </div>
                <p className="mt-2 text-sm italic leading-6 text-[var(--modelsfind-ink)]">
                  Ask AI for your ideal board
                </p>
              </div>
            </div>
          </div>

          <div className="hidden border-t border-[var(--modelsfind-line)] px-5 py-4 text-center text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)] md:block">
            Privacy policy
            <span className="mx-3 text-[var(--modelsfind-line-strong)]">•</span>
            Terms of service
            <span className="mx-3 text-[var(--modelsfind-line-strong)]">•</span>
            Contact
            <span className="mx-3 text-[var(--modelsfind-line-strong)]">•</span>
            Membership
          </div>
        </div>
      </div>
    </div>
  );
});
