import React from 'react';
import { Heart, Menu, Search, Sparkles, WandSparkles } from 'lucide-react';
import type { HomePageProps } from 'shared/src/types/theme';
import {
  conciergePrompts,
  conciergeSuggestions,
  desktopNavItems,
  frameNavItems,
  heroRegions,
  isExternalHref,
  previewPortraits,
  resolveModelsfindSiteConfig,
} from '../site';

function ProfileCard({
  name,
  mood,
  image,
  badge,
  onClick,
}: {
  name: string;
  mood: string;
  image: string;
  badge?: string;
  onClick: () => void;
}) {
  return (
    <article className="group overflow-hidden rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(18,15,22,0.96)] transition-transform duration-300 hover:-translate-y-1">
      <button type="button" onClick={onClick} className="block w-full text-left">
        <div className="relative aspect-[0.82] overflow-hidden md:aspect-[0.76]">
          <img
            src={image}
            alt={name}
            className="h-full w-full object-cover grayscale transition-transform duration-500 group-hover:scale-[1.03]"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,7,10,0.04),rgba(8,7,10,0.78))]" />
          {badge ? (
            <div className="absolute right-3 top-3 rounded-full bg-[rgba(29,24,34,0.92)] px-2.5 py-1 text-[9px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy)]">
              {badge}
            </div>
          ) : null}
        </div>
      </button>

      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="[font-family:var(--modelsfind-display)] text-[1.25rem] leading-none tracking-[-0.04em] text-[var(--modelsfind-ink)]">
              {name}
            </h3>
            <p className="mt-1 text-[11px] text-[var(--modelsfind-copy-soft)]">{mood}</p>
          </div>
          <Heart className="mt-0.5 h-3.5 w-3.5 text-[var(--modelsfind-primary)]" />
        </div>

        <button
          type="button"
          onClick={onClick}
          className="mt-3 inline-flex min-h-9 w-full items-center justify-center rounded-full border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.02)] px-3 text-[9px] font-semibold uppercase tracking-[0.24em] text-[var(--modelsfind-copy)] transition-colors hover:border-[var(--modelsfind-primary)] hover:text-[var(--modelsfind-ink)] md:min-h-8"
        >
          Reserve
        </button>
      </div>
    </article>
  );
}

function MobileModelCard({
  name,
  mood,
  location,
  image,
  className,
  onClick,
}: {
  name: string;
  mood: string;
  location: string;
  image: string;
  className?: string;
  onClick: () => void;
}) {
  return (
    <article className={['flex flex-col gap-3', className || ''].join(' ')}>
      <button type="button" onClick={onClick} className="block w-full text-left">
        <div className="relative aspect-[3/4] overflow-hidden rounded-[1.2rem] bg-[rgba(19,19,21,0.96)]">
          <img src={image} alt={name} className="h-full w-full object-cover grayscale transition-transform duration-700 hover:scale-[1.04]" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,8,12,0.04),rgba(10,8,12,0.82))]" />
          <div className="absolute bottom-3 left-3 right-3">
            <p className="[font-family:var(--modelsfind-display)] text-[1.3rem] italic leading-none text-white">{name}</p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-[var(--modelsfind-copy-soft)]">{location}</p>
          </div>
        </div>
      </button>
      <button
        type="button"
        onClick={onClick}
        className="inline-flex min-h-11 w-full items-center justify-center rounded-[0.9rem] border border-[var(--modelsfind-line-strong)] bg-[rgba(38,38,40,0.78)] px-3 text-[9px] font-extrabold uppercase tracking-[0.24em] text-[var(--modelsfind-primary)] transition-colors hover:bg-[var(--modelsfind-primary)] hover:text-[#17091a]"
      >
        Reserve
      </button>
    </article>
  );
}

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
    [onNavigate],
  );

  const heroPortrait = previewPortraits[0];
  const collection = previewPortraits.slice(0, 6);

  return (
    <div className="modelsfind-shell min-h-screen pb-24 pt-0 [font-family:var(--modelsfind-body)] text-[var(--modelsfind-ink)] md:px-6 md:pt-10 lg:px-8">
      <div className="mx-auto max-w-[1240px]">
        <div className="md:hidden">
          <div className="relative">
            <header className="modelsfind-mobile-topbar fixed inset-x-0 top-0 z-[70] flex h-16 items-center justify-between px-6">
              <button
                type="button"
                onClick={() => openHref('/')}
                className="inline-flex items-center gap-3 text-[var(--modelsfind-primary)]"
              >
                <Menu className="h-4 w-4 text-[var(--modelsfind-copy-soft)]" />
                <span className="[font-family:var(--modelsfind-display)] text-[1.45rem] italic tracking-[-0.03em]">
                  {site.brandName}
                </span>
              </button>
              <button
                type="button"
                onClick={() => openHref('/products')}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--modelsfind-copy)]"
                aria-label="Search models"
              >
                <Search className="h-4 w-4" />
              </button>
            </header>

            <main className="pb-10 pt-0">
              <section className="modelsfind-vignette relative h-[46rem] overflow-hidden">
                <img
                  src={heroPortrait.image}
                  alt={heroPortrait.name}
                  className="absolute inset-0 h-full w-full object-cover grayscale brightness-[0.72]"
                />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(14,14,16,0.42),transparent_22%,rgba(10,8,12,0.92)_88%)]" />
                <div className="absolute bottom-12 left-0 w-full px-6">
                  <p className="text-[10px] uppercase tracking-[0.3em] text-[var(--modelsfind-primary)]">Est. 2026</p>
                  <h1 className="mt-3 max-w-[14rem] [font-family:var(--modelsfind-display)] text-[3.55rem] font-bold italic leading-[0.88] tracking-[-0.06em] text-white">
                    {site.brandName} Elite
                  </h1>
                  <p className="mt-3 max-w-[18rem] text-sm leading-6 text-[var(--modelsfind-copy)]">
                    Bringing the premium end of high-fashion companionship into a fully curated mobile surface.
                  </p>
                  <button
                    type="button"
                    onClick={() => openHref(site.primaryCtaHref)}
                    className="modelsfind-mobile-cta mt-6 inline-flex min-h-12 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--modelsfind-primary),var(--modelsfind-primary-strong))] px-8 text-[10px] font-bold uppercase tracking-[0.22em] text-[#210025]"
                  >
                    Explore Collection
                  </button>
                </div>
              </section>

              <section className="mt-8 px-6">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-[var(--modelsfind-copy-soft)]">Selected regions</p>
                  <div className="h-px flex-1 bg-[color-mix(in_srgb,var(--modelsfind-line)_70%,transparent)]" />
                </div>
                <div className="mt-4 flex gap-3 overflow-x-auto pb-3">
                  {heroRegions.map((region, index) => (
                    <button
                      key={region}
                      type="button"
                      onClick={() => openHref(`/products?region=${encodeURIComponent(region)}`)}
                      className={[
                        'whitespace-nowrap rounded-full border px-5 py-2.5 text-[10px] font-semibold uppercase tracking-[0.18em]',
                        index === 0
                          ? 'border-[var(--modelsfind-primary)] bg-[var(--modelsfind-primary-soft)] text-[var(--modelsfind-primary)]'
                          : 'border-[color-mix(in_srgb,var(--modelsfind-line)_90%,transparent)] text-[var(--modelsfind-copy-soft)]',
                      ].join(' ')}
                    >
                      {region}
                    </button>
                  ))}
                </div>
              </section>

              <section className="mt-2 px-6">
                <button
                  type="button"
                  onClick={() => openHref(site.docsHref)}
                  className="modelsfind-mobile-surface relative w-full overflow-hidden rounded-[1.6rem] border border-[color-mix(in_srgb,var(--modelsfind-line)_70%,transparent)] px-5 py-5 text-left"
                >
                  <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-[var(--modelsfind-primary-soft)] blur-3xl" />
                  <div className="relative flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-[1rem] bg-[linear-gradient(135deg,var(--modelsfind-primary),var(--modelsfind-primary-strong))] text-[#210025] shadow-[0_0_18px_rgba(255,122,251,0.35)]">
                      <WandSparkles className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--modelsfind-primary)]">AI Concierge</p>
                      <h2 className="[font-family:var(--modelsfind-display)] text-[1.2rem] italic text-white">Ask AI for your perfect match</h2>
                    </div>
                  </div>
                </button>
              </section>

              <section className="mt-10 px-6">
                <div className="grid grid-cols-2 gap-4">
                  {collection.slice(0, 4).map((portrait, index) => (
                    <MobileModelCard
                      key={portrait.name}
                      name={portrait.name}
                      mood={portrait.mood}
                      location={portrait.cities || portrait.region}
                      image={portrait.image}
                      className={index % 2 === 1 ? 'translate-y-8' : index === 2 ? 'mt-4' : ''}
                      onClick={() => openHref('/products')}
                    />
                  ))}
                </div>
              </section>
            </main>
          </div>
        </div>

        <div className="hidden md:block">
          <div className="modelsfind-frame overflow-hidden rounded-[2.25rem] border border-[var(--modelsfind-line-strong)] bg-[rgba(10,8,12,0.96)]">
          <div className="hidden items-center gap-6 border-b border-[var(--modelsfind-line)] px-5 py-4 md:flex">
            <button
              type="button"
              onClick={() => openHref('/')}
              className="[font-family:var(--modelsfind-display)] text-[1.05rem] font-semibold tracking-[0.02em] text-[var(--modelsfind-primary)]"
            >
              {site.brandName}
            </button>

            <nav className="flex items-center gap-5">
              {frameNavItems.map((item, index) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => openHref(item === 'Models' ? '/products' : item === 'Booking' ? '/checkout' : '/help')}
                  className={[
                    'text-[11px] uppercase tracking-[0.24em] transition-colors',
                    index === 0
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
              className="[font-family:var(--modelsfind-display)] text-[1.05rem] font-semibold italic tracking-[0.02em] text-[var(--modelsfind-primary)]"
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
            <aside className="hidden border-r border-[var(--modelsfind-line)] bg-[rgba(18,15,21,0.9)] px-4 py-5 md:block">
              <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--modelsfind-copy-soft)]">Regions</p>
              <div className="mt-4 grid gap-3">
                {heroRegions.slice(0, 4).map((region, index) => (
                  <button
                    key={region}
                    type="button"
                    onClick={() => openHref(`/products?region=${encodeURIComponent(region)}`)}
                    className={[
                      'rounded-[1rem] border px-3 py-4 text-left text-[11px] uppercase tracking-[0.18em] transition-colors',
                      index === 0
                        ? 'border-[var(--modelsfind-primary)] bg-[rgba(232,79,218,0.16)] text-[var(--modelsfind-primary)]'
                        : 'border-[var(--modelsfind-line)] text-[var(--modelsfind-copy-soft)] hover:text-[var(--modelsfind-copy)]',
                    ].join(' ')}
                  >
                    {region}
                  </button>
                ))}
              </div>
            </aside>

            <div className="p-4 md:p-5">
              <section className="modelsfind-portrait relative min-h-[18rem] overflow-hidden rounded-[1.6rem] border border-[var(--modelsfind-line)] bg-[rgba(10,8,12,0.94)] md:min-h-[20rem]">
                <img
                  src={heroPortrait.image}
                  alt={heroPortrait.name}
                  className="absolute inset-0 h-full w-full object-cover grayscale"
                />
                <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(8,7,10,0.76),rgba(8,7,10,0.22)_58%,rgba(8,7,10,0.58))]" />
                <div className="relative z-10 flex h-full flex-col justify-end px-5 pb-5 pt-8 md:px-8 md:pb-8">
                  <p className="text-[10px] uppercase tracking-[0.3em] text-[var(--modelsfind-copy-soft)]">Est. 2026</p>
                  <h1 className="mt-3 max-w-[12rem] [font-family:var(--modelsfind-display)] text-[clamp(2.3rem,8vw,5.8rem)] font-semibold leading-[0.88] tracking-[-0.05em] text-[var(--modelsfind-ink)] md:mt-4 md:max-w-[18rem]">
                    {site.headline}
                  </h1>
                  <p className="mt-3 max-w-[15rem] text-[13px] leading-6 text-[var(--modelsfind-copy)] md:max-w-[30rem] md:text-sm md:leading-7">
                    {site.subheadline}
                  </p>

                  <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => openHref(site.primaryCtaHref)}
                      className="inline-flex min-h-11 items-center justify-center rounded-full bg-[linear-gradient(145deg,color-mix(in_oklab,var(--modelsfind-primary)_82%,white),color-mix(in_oklab,var(--modelsfind-primary)_72%,black))] px-5 text-[11px] font-semibold uppercase tracking-[0.22em] text-white"
                    >
                      {site.primaryCtaLabel}
                    </button>
                    <button
                      type="button"
                      onClick={() => openHref(site.secondaryCtaHref)}
                      className="inline-flex min-h-11 items-center justify-center rounded-full border border-[var(--modelsfind-line-strong)] bg-[rgba(20,16,22,0.68)] px-5 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--modelsfind-ink)]"
                    >
                      {site.secondaryCtaLabel}
                    </button>
                  </div>
                </div>
              </section>

              <section className="mt-5 md:hidden">
                <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--modelsfind-copy-soft)]">Selected regions</p>
                <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                  {heroRegions.map((region, index) => (
                    <button
                      key={region}
                      type="button"
                      onClick={() => openHref(`/products?region=${encodeURIComponent(region)}`)}
                      className={[
                        'whitespace-nowrap rounded-full border px-3 py-2 text-[10px] uppercase tracking-[0.18em]',
                        index === 0
                          ? 'border-[var(--modelsfind-primary)] bg-[rgba(232,79,218,0.16)] text-[var(--modelsfind-primary)]'
                          : 'border-[var(--modelsfind-line)] text-[var(--modelsfind-copy)]',
                      ].join(' ')}
                    >
                      {region}
                    </button>
                  ))}
                </div>
              </section>

              <section className="mt-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                  <div>
                    <h2 className="[font-family:var(--modelsfind-display)] text-[2rem] leading-none tracking-[-0.04em] text-[var(--modelsfind-ink)] md:text-[2.45rem]">
                      The Collection
                    </h2>
                    <p className="mt-2 text-xs text-[var(--modelsfind-copy-soft)]">Showing 72 elite editorials across China</p>
                  </div>

                  <div className="hidden items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-[var(--modelsfind-copy-soft)] md:flex">
                    <Sparkles className="h-3.5 w-3.5 text-[var(--modelsfind-primary)]" />
                    Curated nightly
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
                  {collection.map((portrait, index) => (
                    <div key={portrait.name} className="relative">
                      <ProfileCard
                        name={portrait.name}
                        mood={portrait.mood}
                        image={portrait.image}
                        badge={index === 2 ? 'Private Match' : portrait.badge}
                        onClick={() => openHref('/products')}
                      />
                      {index === 2 ? (
                        <div className="pointer-events-none absolute -left-24 top-12 hidden rounded-[1rem] border border-[var(--modelsfind-line-strong)] bg-[rgba(24,18,30,0.94)] px-4 py-3 shadow-[var(--modelsfind-card-shadow)] lg:block">
                          <div className="inline-flex items-center gap-2 text-[9px] uppercase tracking-[0.2em] text-[var(--modelsfind-primary)]">
                            <WandSparkles className="h-3.5 w-3.5" />
                            AI concierge
                          </div>
                          <p className="mt-2 text-[11px] uppercase tracking-[0.16em] text-white">Find your ideal match</p>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </section>

              <section className="mt-6 rounded-[1.2rem] border border-[var(--modelsfind-line)] bg-[rgba(31,23,34,0.82)] p-4 md:hidden">
                <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-[var(--modelsfind-primary)]">
                  <WandSparkles className="h-3.5 w-3.5" />
                  AI Concierge
                </div>
                <p className="mt-2 text-sm italic leading-6 text-[var(--modelsfind-ink)]">
                  Ask AI for your perfect match
                </p>
                <p className="mt-3 text-xs leading-6 text-[var(--modelsfind-copy)]">
                  Personalize your shortlist by city, mood, or event brief before sending a reservation.
                </p>
                <button
                  type="button"
                  onClick={() => openHref('/help')}
                  className="mt-4 inline-flex min-h-10 items-center justify-center rounded-full bg-[rgba(232,79,218,0.14)] px-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--modelsfind-primary)]"
                >
                  Open concierge
                </button>
              </section>

              <section className="mt-8 hidden border-t border-[var(--modelsfind-line)] pt-6 md:block">
                <div className="grid gap-4 lg:grid-cols-[15rem_minmax(0,1fr)]">
                  <div className="rounded-[1.2rem] border border-[var(--modelsfind-line)] bg-[rgba(20,16,24,0.92)] p-4">
                    <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-[var(--modelsfind-primary)]">
                      <WandSparkles className="h-4 w-4" />
                      AI Concierge
                    </div>
                    <p className="mt-3 text-sm leading-6 text-[var(--modelsfind-copy)]">
                      Ask AI for your perfect match.
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    {conciergeSuggestions.map((suggestion) => (
                      <article
                        key={suggestion.name}
                        className="rounded-[1.2rem] border border-[var(--modelsfind-line)] bg-[rgba(18,15,22,0.92)] p-3"
                      >
                        <img
                          src={suggestion.image}
                          alt={suggestion.name}
                          className="h-44 w-full rounded-[0.9rem] object-cover grayscale"
                        />
                        <p className="mt-3 [font-family:var(--modelsfind-display)] text-[1.5rem] text-white">{suggestion.name}</p>
                        <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-[var(--modelsfind-copy-soft)]">
                          {suggestion.role} · {suggestion.city}
                        </p>
                      </article>
                    ))}
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
});
