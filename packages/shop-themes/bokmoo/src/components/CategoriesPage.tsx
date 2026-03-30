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
    return <div className="min-h-screen bg-[var(--bokmoo-bg)]" />;
  }

  return (
    <div className="min-h-screen bg-[var(--bokmoo-bg)] px-4 pb-16 pt-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1280px]">
        <section className="rounded-[var(--bokmoo-radius-xl)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] p-6 shadow-[var(--bokmoo-shadow)] sm:p-8">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-[1rem] bg-[color:color-mix(in_oklab,var(--bokmoo-gold)_14%,transparent)] text-[var(--bokmoo-gold)]">
              <Globe2 className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-copy-soft)]">
                Destination map
              </p>
              <h1 className="mt-2 text-[clamp(2.2rem,5vw,4rem)] leading-[0.94] tracking-[-0.05em] text-[var(--bokmoo-ink)]">
                Browse Bokmoo by destination family and travel region.
              </h1>
            </div>
          </div>
        </section>

        {error ? (
          <div className="mt-6 rounded-[var(--bokmoo-radius-xl)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] p-6 text-[var(--bokmoo-copy)] shadow-[var(--bokmoo-shadow)]">
            {error}
          </div>
        ) : null}

        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => onCategoryClick(category.id)}
              className="group rounded-[var(--bokmoo-radius-xl)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] p-6 text-left shadow-[var(--bokmoo-shadow)] transition-transform duration-300 hover:-translate-y-1"
              type="button"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-gold)]">
                {category.productCount} plans
              </p>
              <h2 className="mt-4 text-2xl leading-[1.02] tracking-[-0.04em] text-[var(--bokmoo-ink)]">
                {category.name}
              </h2>
              <p className="mt-3 text-sm leading-6 text-[var(--bokmoo-copy)]">
                {category.description || 'Destination-ready bundles collected into one cleaner planning surface.'}
              </p>
              <span className="mt-4 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-gold)]">
                Open region
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </span>
            </button>
          ))}
        </section>

        {categories.length === 0 ? (
          <div className="mt-6 rounded-[var(--bokmoo-radius-xl)] border border-dashed border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] p-16 text-center text-[var(--bokmoo-copy)]">
            No categories available yet.
          </div>
        ) : null}

        {onNavigateToHome ? (
          <div className="mt-8">
            <button
              onClick={onNavigateToHome}
              className="rounded-full border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-copy)]"
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
