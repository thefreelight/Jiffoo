import React from 'react';
import { ArrowRight, Compass } from 'lucide-react';
import type { CategoriesPageProps } from 'shared/src/types/theme';

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
    <div className="modelsfind-shell min-h-screen px-4 pb-24 pt-20 [font-family:var(--modelsfind-body)] text-[var(--modelsfind-ink)] sm:px-6 sm:pt-24 lg:px-8">
      <div className="mx-auto max-w-[1040px]">
        <div className="modelsfind-frame overflow-hidden rounded-[2rem] border border-[var(--modelsfind-line-strong)] bg-[rgba(10,8,12,0.96)]">
          <section className="border-b border-[var(--modelsfind-line)] px-5 py-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--modelsfind-copy)]">
              <Compass className="h-4 w-4 text-[var(--modelsfind-primary)]" />
              Regions
            </div>
            <h1 className="mt-4 [font-family:var(--modelsfind-display)] text-[clamp(2.4rem,5vw,4.4rem)] leading-[0.92] tracking-[-0.05em] text-[var(--modelsfind-ink)]">
              Browse the archive by region, curation lane, and visual mood.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--modelsfind-copy)]">
              Use regions as the fastest way to narrow a large portrait archive before moving into individual profile boards.
            </p>
          </section>

          {error ? (
            <div className="border-b border-[var(--modelsfind-line)] px-5 py-4 text-sm text-[var(--modelsfind-copy)]">
              {error}
            </div>
          ) : null}

          <section className="px-5 py-5">
            {categories.length === 0 ? (
              <div className="rounded-[1.2rem] border border-dashed border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.02)] p-16 text-center text-[var(--modelsfind-copy)]">
                No regions available yet.
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {categories.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => onCategoryClick(category.id)}
                    className="group rounded-[1.2rem] border border-[var(--modelsfind-line)] bg-[rgba(19,15,22,0.92)] p-5 text-left transition-transform duration-300 hover:-translate-y-1"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--modelsfind-primary)]">
                        {category.productCount} profiles
                      </p>
                      <ArrowRight className="h-4 w-4 text-[var(--modelsfind-copy-soft)] transition-transform duration-300 group-hover:translate-x-1" />
                    </div>
                    <h2 className="mt-3 [font-family:var(--modelsfind-display)] text-[2rem] leading-none tracking-[-0.04em] text-[var(--modelsfind-ink)]">
                      {category.name}
                    </h2>
                    <p className="mt-3 text-sm leading-7 text-[var(--modelsfind-copy)]">
                      {category.description || 'Browse a tighter lane of the portrait archive with cleaner editorial grouping.'}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </section>

          {onNavigateToHome ? (
            <div className="border-t border-[var(--modelsfind-line)] px-5 py-4">
              <button
                type="button"
                onClick={onNavigateToHome}
                className="rounded-full border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--modelsfind-copy)]"
              >
                Back home
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
});
