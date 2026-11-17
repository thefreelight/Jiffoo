import React from 'react';
import { ArrowRight, Globe2 } from 'lucide-react';
import type { CategoriesPageProps } from 'shared/src/types/theme';

export const CategoriesPage = React.memo(function CategoriesPage({
  categories,
  isLoading,
  error,
  onCategoryClick,
  onNavigateToHome,
}: CategoriesPageProps) {
  if (isLoading) {
    return <div className="min-h-screen bg-[var(--esim-bg)]" />;
  }

  return (
    <div className="min-h-screen bg-[var(--esim-bg)] px-4 pb-16 pt-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1280px]">
        <section className="rounded-[var(--esim-radius-xl)] border border-[var(--esim-line)] bg-[var(--esim-bg-elevated)] p-6 shadow-[var(--esim-shadow)] sm:p-8">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-[1rem] bg-[color:color-mix(in_oklab,var(--esim-gold)_14%,transparent)] text-[var(--esim-gold)]">
              <Globe2 className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[11px] font-semibold tracking-[0.18em] text-[var(--esim-copy-soft)]">
                Region Collections
              </p>
              <h1 className="mt-2 text-[clamp(2.2rem,5vw,4rem)] leading-[0.94] tracking-[-0.05em] text-[var(--esim-ink)]">
                Browse BOKMOO plans by destination and travel region.
              </h1>
            </div>
          </div>
        </section>

        {error ? (
          <div className="mt-6 rounded-[var(--esim-radius-xl)] border border-[var(--esim-line)] bg-[var(--esim-bg-elevated)] p-6 text-[var(--esim-copy)] shadow-[var(--esim-shadow)]">
            {error}
          </div>
        ) : null}

        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => onCategoryClick(category.id)}
              className="group rounded-[var(--esim-radius-xl)] border border-[var(--esim-line)] bg-[var(--esim-bg-elevated)] p-6 text-left shadow-[var(--esim-shadow)] transition-transform duration-300 hover:-translate-y-1"
              type="button"
            >
              <p className="text-[11px] font-semibold tracking-[0.18em] text-[var(--esim-gold)]">
                {category.productCount} plans
              </p>
              <h2 className="mt-4 text-2xl leading-[1.02] tracking-[-0.04em] text-[var(--esim-ink)]">
                {category.name}
              </h2>
              <p className="mt-3 text-sm leading-6 text-[var(--esim-copy)]">
                {category.description || 'Group destination-ready plans into clearer regional entry points.'}
              </p>
              <span className="mt-4 inline-flex items-center gap-2 text-[11px] font-semibold tracking-[0.18em] text-[var(--esim-gold)]">
                View category
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </span>
            </button>
          ))}
        </section>

        {categories.length === 0 ? (
          <div className="mt-6 rounded-[var(--esim-radius-xl)] border border-dashed border-[var(--esim-line)] bg-[var(--esim-bg-elevated)] p-16 text-center text-[var(--esim-copy)]">
            No region collections are available yet.
          </div>
        ) : null}

        {onNavigateToHome ? (
          <div className="mt-8">
            <button
              onClick={onNavigateToHome}
              className="rounded-full border border-[var(--esim-line)] bg-[var(--esim-bg-elevated)] px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--esim-copy)]"
              type="button"
            >
              Back home
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
});
