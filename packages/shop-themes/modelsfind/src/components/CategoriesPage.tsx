import React from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Compass,
  Sparkles,
  WandSparkles,
} from 'lucide-react';
import type { CategoriesPageProps } from 'shared/src/types/theme';
import { conciergePrompts, heroRegions } from '../site';

function getFallbackCategoryImage(index: number): string {
  const fallbacks = [
    'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=1200&q=80',
  ] as const;

  return fallbacks[index % fallbacks.length];
}

export const CategoriesPage = React.memo(function CategoriesPage({
  categories,
  isLoading,
  error,
  onCategoryClick,
  onNavigateToHome,
}: CategoriesPageProps) {
  if (isLoading) {
    return <div className="modelsfind-shell min-h-screen" />;
  }

  return (
    <div className="modelsfind-shell min-h-screen px-4 pb-32 pt-20 [font-family:var(--modelsfind-body)] text-[var(--modelsfind-ink)] sm:px-6 sm:pt-24 lg:px-8">
      <div className="mx-auto max-w-[1560px]">
        {onNavigateToHome ? (
          <button
            type="button"
            onClick={onNavigateToHome}
            className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--modelsfind-copy)]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back home
          </button>
        ) : null}

        <div className="mt-4 xl:flex">
          <aside className="modelsfind-frame hidden w-[16rem] shrink-0 rounded-l-[2rem] rounded-r-none border-r border-[var(--modelsfind-line)] xl:flex xl:min-h-[calc(100vh-8rem)] xl:flex-col xl:px-8 xl:py-8">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--modelsfind-copy-soft)]">Region lanes</p>
              <h2 className="mt-2 [font-family:var(--modelsfind-display)] text-[2rem] leading-none tracking-[-0.04em] text-[var(--modelsfind-primary)]">
                Discovery map
              </h2>
            </div>

            <div className="mt-8 grid gap-2">
              {heroRegions.map((region, index) => (
                <div
                  key={region}
                  className={[
                    'rounded-[1rem] border px-4 py-4 text-[11px] uppercase tracking-[0.18em]',
                    index === 0
                      ? 'border-[var(--modelsfind-line-strong)] bg-[rgba(255,255,255,0.06)] text-[var(--modelsfind-primary)]'
                      : 'border-[var(--modelsfind-line)] text-[var(--modelsfind-copy-soft)]',
                  ].join(' ')}
                >
                  {region}
                </div>
              ))}
            </div>

            <div className="modelsfind-panel mt-auto rounded-[1.4rem] border border-[var(--modelsfind-line)] p-5">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--modelsfind-primary-soft)] text-[var(--modelsfind-primary)]">
                <Compass className="h-4 w-4" />
              </div>
              <p className="mt-4 text-[10px] uppercase tracking-[0.24em] text-[var(--modelsfind-copy-soft)]">Inside this page</p>
              <p className="mt-3 text-sm leading-6 text-[var(--modelsfind-copy)]">
                Use region lanes as the fastest way to narrow the private archive before switching into mood-driven search or direct booking.
              </p>
            </div>
          </aside>

          <div className="min-w-0 flex-1">
            <div className="modelsfind-frame overflow-hidden rounded-[2rem] border border-[var(--modelsfind-line-strong)] xl:rounded-l-none xl:border-l-0">
              <div className="p-4 md:p-6 xl:p-8">
                <section className="modelsfind-hero overflow-hidden rounded-[1.8rem] border border-[var(--modelsfind-line)]">
                  <img
                    src={categories[0]?.image || getFallbackCategoryImage(0)}
                    alt="Region archive"
                    className="absolute inset-0 h-full w-full object-cover grayscale opacity-40"
                  />
                  <div className="relative z-10 grid min-h-[24rem] gap-6 px-6 pb-8 pt-10 md:px-10 md:pb-10 md:pt-12 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-end">
                    <div className="max-w-[40rem]">
                      <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-[var(--modelsfind-primary)]">
                        <Compass className="h-4 w-4" />
                        Region archive
                      </div>
                      <h1 className="mt-4 [font-family:var(--modelsfind-display)] text-[clamp(2.9rem,6vw,5.2rem)] leading-[0.92] tracking-[-0.05em] text-white">
                        Browse the private archive by region and curation lane.
                      </h1>
                      <p className="mt-4 max-w-[34rem] text-sm leading-7 text-[var(--modelsfind-copy)]">
                        This page behaves like a mobile-first routing map: lead with region, then hand off to the tighter directory or concierge flow.
                      </p>
                    </div>

                    <div className="modelsfind-panel rounded-[1.5rem] border border-[var(--modelsfind-line)] p-5">
                      <p className="text-[9px] uppercase tracking-[0.2em] text-[var(--modelsfind-copy-soft)]">Available lanes</p>
                      <p className="mt-2 [font-family:var(--modelsfind-display)] text-[2.4rem] leading-none tracking-[-0.04em] text-white">
                        {categories.length}
                      </p>
                      <p className="mt-3 text-sm leading-6 text-[var(--modelsfind-copy)]">
                        Region-led entry points tuned for operators who need to move from browse to shortlist without losing the editorial mood.
                      </p>
                    </div>
                  </div>
                </section>

                {error ? (
                  <div className="mt-6 rounded-[1.4rem] border border-red-500/20 bg-red-500/5 px-5 py-4 text-sm text-red-200">
                    {error}
                  </div>
                ) : null}

                <section className="mt-8">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.24em] text-[var(--modelsfind-primary)]">Navigation lanes</p>
                      <h2 className="[font-family:var(--modelsfind-display)] text-[2rem] leading-none tracking-[-0.04em] text-white">
                        Region-led entry points
                      </h2>
                    </div>
                    <div className="hidden items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)] md:flex">
                      <Sparkles className="h-4 w-4 text-[var(--modelsfind-primary)]" />
                      Mobile-first routing
                    </div>
                  </div>

                  {categories.length === 0 ? (
                    <div className="mt-6 rounded-[1.6rem] border border-dashed border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.02)] p-16 text-center text-[var(--modelsfind-copy)]">
                      No regions available yet.
                    </div>
                  ) : (
                    <div className="mt-6 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                      {categories.map((category, index) => (
                        <button
                          key={category.id}
                          type="button"
                          onClick={() => onCategoryClick(category.id)}
                          className="group overflow-hidden rounded-[1.5rem] border border-[var(--modelsfind-line)] bg-[rgba(20,16,24,0.92)] text-left transition-transform duration-500 hover:-translate-y-1"
                        >
                          <div className="relative aspect-[1.05] overflow-hidden">
                            <img
                              src={category.image || getFallbackCategoryImage(index)}
                              alt={category.name}
                              className="h-full w-full object-cover grayscale transition-all duration-700 group-hover:scale-[1.05] group-hover:grayscale-0"
                            />
                            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,7,10,0.08),rgba(8,7,10,0.86))]" />
                            <div className="absolute left-4 right-4 top-4 flex items-center justify-between gap-3">
                              <span className="rounded-full border border-[var(--modelsfind-line-strong)] bg-[rgba(15,12,18,0.7)] px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--modelsfind-primary)]">
                                {category.productCount} profiles
                              </span>
                              {category.featured ? (
                                <span className="rounded-full bg-[var(--modelsfind-primary-soft)] px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-[var(--modelsfind-primary)]">
                                  Featured
                                </span>
                              ) : null}
                            </div>

                            <div className="absolute bottom-0 left-0 right-0 p-4">
                              <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]">
                                Region lane {String(index + 1).padStart(2, '0')}
                              </p>
                              <h3 className="mt-2 [font-family:var(--modelsfind-display)] text-[2rem] leading-none tracking-[-0.04em] text-white">
                                {category.name}
                              </h3>
                            </div>
                          </div>

                          <div className="p-4">
                            <p className="text-sm leading-7 text-[var(--modelsfind-copy)]">
                              {category.description || 'Browse a tighter lane of the private archive with cleaner editorial grouping.'}
                            </p>
                            <div className="mt-4 inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--modelsfind-copy)] transition-colors group-hover:text-[var(--modelsfind-primary)]">
                              Open lane
                              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </section>

                <section className="mt-8 rounded-[1.6rem] border border-[var(--modelsfind-line)] bg-[rgba(17,14,20,0.92)] p-5">
                  <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-[var(--modelsfind-primary)]">
                    <WandSparkles className="h-4 w-4" />
                    Concierge prompts
                  </div>
                  <p className="mt-3 max-w-[38rem] text-sm leading-7 text-[var(--modelsfind-copy)]">
                    Borrowing from the mobile AI concierge board, these quick phrases can later become tappable filters or pre-filled assistant prompts.
                  </p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {conciergePrompts.map((prompt) => (
                      <div
                        key={prompt}
                        className="rounded-full border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.04)] px-4 py-2 text-[10px] uppercase tracking-[0.16em] text-[var(--modelsfind-copy)]"
                      >
                        {prompt}
                      </div>
                    ))}
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
