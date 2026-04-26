import React from 'react';
import { ArrowRight, FolderKanban, Orbit } from 'lucide-react';
import type { CategoriesPageProps } from 'shared/src/types/theme';
import { MarketplaceFrame } from './MarketplaceFrame';
import { getNavCopy } from '../i18n';

export const CategoriesPage = React.memo(function CategoriesPage({
  categories,
  isLoading,
  locale,
  config,
  onCategoryClick,
  onNavigateToHome,
}: CategoriesPageProps) {
  const copy = getNavCopy(locale);

  if (isLoading) {
    return (
      <MarketplaceFrame activeItem="models" locale={locale} config={config}>
        <div className="rounded-[var(--navtoai-radius-xl)] border border-[var(--navtoai-line)] bg-[var(--navtoai-surface)] p-10 text-center text-[var(--navtoai-copy)]">
          {copy.common.loading}
        </div>
      </MarketplaceFrame>
    );
  }

  return (
    <MarketplaceFrame activeItem="models" locale={locale} config={config}>
      <div className="space-y-6">
        <section className="rounded-[var(--navtoai-radius-xl)] border border-[var(--navtoai-line)] bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(243,246,255,0.96))] p-6 shadow-[var(--navtoai-shadow-sm)] sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-[var(--navtoai-primary-soft)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--navtoai-primary-strong)]">
                <Orbit className="h-4 w-4 text-[var(--navtoai-primary)]" />
                {copy.categories.eyebrow}
              </div>
              <h1 className="mt-4 text-[clamp(2rem,4vw,3.6rem)] font-black leading-[0.96] tracking-[-0.06em] text-[var(--navtoai-ink)]">
                {copy.categories.title}
              </h1>
              <p className="mt-3 text-base leading-7 text-[var(--navtoai-copy)]">{copy.categories.description}</p>
            </div>
            <button
              type="button"
              onClick={onNavigateToHome}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--navtoai-line)] bg-white px-5 py-3 text-sm font-semibold text-[var(--navtoai-ink)] shadow-[var(--navtoai-shadow-xs)]"
            >
              {copy.categories.backHome}
            </button>
          </div>
        </section>

        <section>
          {categories.length === 0 ? (
            <div className="rounded-[var(--navtoai-radius-xl)] border border-dashed border-[var(--navtoai-line)] bg-[var(--navtoai-surface)] p-16 text-center text-[var(--navtoai-copy)]">
              {copy.categories.empty}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {categories.map((category, index) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => onCategoryClick(category.id)}
                  className="group overflow-hidden rounded-[var(--navtoai-radius-lg)] border border-[var(--navtoai-line)] bg-[var(--navtoai-surface)] text-left shadow-[var(--navtoai-shadow-sm)] transition-transform duration-300 hover:-translate-y-1"
                >
                  <div className="relative h-40 overflow-hidden border-b border-[var(--navtoai-line)] bg-[linear-gradient(135deg,rgba(105,104,255,0.18),rgba(123,201,255,0.12),rgba(244,246,255,0.8))]">
                    {category.image ? (
                      <img src={category.image} alt={category.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="flex h-16 w-16 items-center justify-center rounded-[1.3rem] bg-white text-[var(--navtoai-primary)] shadow-[var(--navtoai-shadow-xs)]">
                          <FolderKanban className="h-7 w-7" />
                        </div>
                      </div>
                    )}
                    <div className="absolute left-4 top-4 rounded-full bg-white/84 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--navtoai-primary-strong)] backdrop-blur">
                      {`${index + 1}`}
                    </div>
                  </div>
                  <div className="p-5">
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="text-xl font-black tracking-[-0.03em] text-[var(--navtoai-ink)]">
                        {category.name}
                      </h2>
                      <span className="rounded-full bg-[var(--navtoai-bg-alt)] px-3 py-1 text-[11px] font-semibold text-[var(--navtoai-copy-soft)]">
                        {category.productCount} {copy.common.toolsUnit}
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-[var(--navtoai-copy)]">
                      {category.description || copy.categories.description}
                    </p>
                    <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[var(--navtoai-primary)]">
                      {copy.categories.openCategory}
                      <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </MarketplaceFrame>
  );
});
