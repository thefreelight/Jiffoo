import React from 'react';
import { ArrowRight, FolderKanban } from 'lucide-react';
import type { CategoriesPageProps } from 'shared/src/types/theme';

export const CategoriesPage = React.memo(function CategoriesPage({
  categories,
  isLoading,
  error,
  onCategoryClick,
  onNavigateToHome,
}: CategoriesPageProps) {
  if (isLoading) {
    return <div className="min-h-screen bg-[var(--vault-bg)]" />;
  }

  return (
    <div className="min-h-screen bg-[var(--vault-bg)] px-4 pb-16 pt-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1280px]">
        <section className="rounded-[var(--vault-radius-lg)] border border-[var(--vault-line)] bg-[var(--vault-surface)] p-6 shadow-[var(--vault-shadow)] sm:p-8">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-[1rem] bg-[var(--vault-primary-soft)] text-[var(--vault-primary)]">
              <FolderKanban className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--vault-copy-soft)]">
                Catalog map
              </p>
              <h1 className="mt-2 text-[clamp(2.2rem,5vw,4rem)] font-black leading-[0.94] tracking-[-0.05em] text-[var(--vault-ink)]">
                Browse the storefront by delivery-focused category.
              </h1>
            </div>
          </div>
        </section>

        {error ? (
          <div className="mt-6 rounded-[var(--vault-radius-lg)] border border-[var(--vault-line)] bg-[var(--vault-surface)] p-6 text-[var(--vault-copy)] shadow-[var(--vault-shadow)]">
            {error}
          </div>
        ) : null}

        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => onCategoryClick(category.id)}
              className="group rounded-[var(--vault-radius-lg)] border border-[var(--vault-line)] bg-[var(--vault-surface)] p-6 text-left shadow-[var(--vault-shadow)] transition-transform duration-300 hover:-translate-y-1"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--vault-copy-soft)]">
                {category.productCount} items
              </p>
              <h2 className="mt-4 text-2xl font-black tracking-[-0.04em] text-[var(--vault-ink)]">
                {category.name}
              </h2>
              <p className="mt-3 text-sm leading-6 text-[var(--vault-copy)]">
                {category.description || 'Digital goods grouped for faster discovery and cleaner browsing.'}
              </p>
              <span className="mt-4 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--vault-primary)]">
                Open category
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </span>
            </button>
          ))}
        </section>

        {categories.length === 0 ? (
          <div className="mt-6 rounded-[var(--vault-radius-lg)] border border-dashed border-[var(--vault-line)] bg-[var(--vault-surface)] p-16 text-center text-[var(--vault-copy)]">
            No categories available yet.
          </div>
        ) : null}

        {onNavigateToHome ? (
          <div className="mt-8">
            <button
              onClick={onNavigateToHome}
              className="rounded-full border border-[var(--vault-line)] bg-[var(--vault-surface)] px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--vault-copy)]"
            >
              Back home
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
});
