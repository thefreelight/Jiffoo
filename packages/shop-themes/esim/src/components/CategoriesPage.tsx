import React from 'react';
import { ArrowRight, Globe2 } from 'lucide-react';
import type { CategoriesPageProps } from 'shared/src/types/theme';
import { type ThemeCopy, pickCopy } from '../site';

export const CategoriesPage = React.memo(function CategoriesPage({
  categories,
  locale,
  isLoading,
  error,
  onCategoryClick,
  onNavigateToHome,
}: CategoriesPageProps) {
  const t = (copy: ThemeCopy) => pickCopy(locale, copy);
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
                {t({ en: 'Region Collections', hans: '地区合集', hant: '地區合輯' })}
              </p>
              <h1 className="mt-2 text-[clamp(2.2rem,5vw,4rem)] leading-[0.94] tracking-[-0.05em] text-[var(--esim-ink)]">
                {t({ en: 'Browse BOKMOO plans by destination and travel region.', hans: '按目的地和旅行地区浏览 BOKMOO 套餐。', hant: '按目的地和旅行地區瀏覽 BOKMOO 方案。' })}
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
                {pickCopy(locale, {
                  en: category.productCount === 1 ? '1 plan' : `${category.productCount} plans`,
                  hans: `${category.productCount} 个套餐`,
                  hant: `${category.productCount} 個方案`,
                  ja: category.productCount === 1 ? '1 プラン' : `プラン ${category.productCount} 件`,
                  ko: category.productCount === 1 ? '플랜 1개' : `플랜 ${category.productCount}개`,
                  fr: category.productCount === 1 ? '1 forfait' : `${category.productCount} forfaits`,
                  de: category.productCount === 1 ? '1 Tarif' : `${category.productCount} Tarife`,
                })}
              </p>
              <h2 className="mt-4 text-2xl leading-[1.02] tracking-[-0.04em] text-[var(--esim-ink)]">
                {category.name}
              </h2>
              <p className="mt-3 text-sm leading-6 text-[var(--esim-copy)]">
                {category.description || t({ en: 'Group destination-ready plans into clearer regional entry points.', hans: '把各目的地的套餐整理成清晰的地区入口。', hant: '把各目的地的方案整理成清晰的地區入口。' })}
              </p>
              <span className="mt-4 inline-flex items-center gap-2 text-[11px] font-semibold tracking-[0.18em] text-[var(--esim-gold)]">
                {t({ en: 'View category', hans: '查看分类', hant: '查看分類' })}
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </span>
            </button>
          ))}
        </section>

        {categories.length === 0 ? (
          <div className="mt-6 rounded-[var(--esim-radius-xl)] border border-dashed border-[var(--esim-line)] bg-[var(--esim-bg-elevated)] p-16 text-center text-[var(--esim-copy)]">
            {t({ en: 'No region collections are available yet.', hans: '暂无地区合集。', hant: '尚無地區合輯。' })}
          </div>
        ) : null}

        {onNavigateToHome ? (
          <div className="mt-8">
            <button
              onClick={onNavigateToHome}
              className="rounded-full border border-[var(--esim-line)] bg-[var(--esim-bg-elevated)] px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--esim-copy)]"
              type="button"
            >
              {t({ en: 'Back home', hans: '返回首页', hant: '返回首頁' })}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
});
