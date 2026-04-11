import React from 'react';
import { ArrowRight, Compass, FolderKanban } from 'lucide-react';
import type { CategoriesPageProps } from 'shared/src/types/theme';

export const CategoriesPage = React.memo(function CategoriesPage({
  categories,
  isLoading,
  onCategoryClick,
  onNavigateToHome,
}: CategoriesPageProps) {
  if (isLoading) {
    return <div className="min-h-screen bg-[var(--navtoai-bg)]" />;
  }

  return (
    <div className="min-h-screen bg-[var(--navtoai-bg)] px-4 pb-16 pt-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1280px]">
        <section className="rounded-[var(--navtoai-radius-lg)] border border-[var(--navtoai-line)] bg-[linear-gradient(135deg,color-mix(in_oklab,var(--navtoai-primary-soft)_84%,white),var(--navtoai-surface))] p-6 shadow-[var(--navtoai-shadow)] sm:p-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--navtoai-line)] bg-[var(--navtoai-surface)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--navtoai-copy)]">
            <Compass className="h-4 w-4 text-[var(--navtoai-primary)]" />
            Categories
          </div>
          <h1 className="mt-5 text-[clamp(2.2rem,5vw,4.4rem)] font-black leading-[0.94] tracking-[-0.05em] text-[var(--navtoai-ink)]">
            Browse the AI directory by use-case lane and operating mode.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--navtoai-copy)]">
            Categories help buyers narrow the field before they compare pricing, detail pages, or fulfillment terms.
          </p>
          <button
            type="button"
            onClick={onNavigateToHome}
            className="mt-8 inline-flex items-center gap-2 rounded-full border border-[var(--navtoai-line)] bg-[var(--navtoai-surface)] px-5 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--navtoai-ink)]"
          >
            Back home
          </button>
        </section>

        <section className="mt-8">
          {categories.length === 0 ? (
            <div className="rounded-[var(--navtoai-radius-lg)] border border-dashed border-[var(--navtoai-line)] bg-[var(--navtoai-surface)] p-16 text-center text-[var(--navtoai-copy)]">
              No categories are available yet.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => onCategoryClick(category.id)}
                  className="group rounded-[var(--navtoai-radius-lg)] border border-[var(--navtoai-line)] bg-[var(--navtoai-surface)] p-6 text-left shadow-[var(--navtoai-shadow)] transition-transform duration-300 hover:-translate-y-1"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-[1rem] bg-[var(--navtoai-primary-soft)] text-[var(--navtoai-primary)]">
                    <FolderKanban className="h-6 w-6" />
                  </div>
                  <div className="mt-5 flex items-center justify-between gap-4">
                    <h2 className="text-xl font-black tracking-[-0.03em] text-[var(--navtoai-ink)]">
                      {category.name}
                    </h2>
                    <span className="rounded-full bg-[color:color-mix(in_oklab,var(--navtoai-accent)_18%,white)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--navtoai-ink)]">
                      {category.productCount} tools
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-[var(--navtoai-copy)]">
                    {category.description || 'Browse a tighter segment of the directory with clearer use-case grouping.'}
                  </p>
                  <span className="mt-5 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--navtoai-primary)]">
                    Open category
                    <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
});
