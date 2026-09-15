import React from 'react';
import { ArrowLeft, CheckCircle2, ExternalLink, Heart, ShieldCheck, Sparkles } from 'lucide-react';
import type { ProductDetailPageProps } from 'shared/src/types/theme';
import { MarketplaceFrame } from './MarketplaceFrame';
import { getNavCopy } from '../i18n';
import { getSubmissionPlanMeta } from '../lib/submission-plan';
import { Rating, ToolLogo } from './design-primitives';

type DirectoryProduct = NonNullable<ProductDetailPageProps['product']>;

function asArray<T>(value: T[] | undefined | null): T[] {
  return Array.isArray(value) ? value : [];
}

function getDetailCopy(locale?: string) {
  const resolved = getNavCopy(locale).locale;
  if (resolved === 'zh-Hant') {
    return {
      back: '返回目錄',
      choose: '選擇方案',
      pricing: '價格方案',
      addPlan: '選擇這個方案',
      visit: '訪問官網',
      favorite: '收藏工具',
      saved: '已收藏',
      overview: '項目概覽',
      intro: '工具簡介',
      features: '主要功能',
      screenshots: '相關截圖',
      similar: '類似工具推薦',
      reviewsTitle: '用戶評價',
      ratingLabel: '評分',
      usersLabel: '全球用戶',
      notFound: '找不到這個項目。',
      note: '這個頁面用來更清楚地比較 AI 項目、方案與訂閱價值。',
    };
  }
  if (resolved === 'zh-Hans') {
    return {
      back: '返回目录',
      choose: '选择方案',
      pricing: '价格方案',
      addPlan: '选择这个方案',
      visit: '访问官网',
      favorite: '收藏工具',
      saved: '已收藏',
      overview: '项目概览',
      intro: '工具简介',
      features: '主要功能',
      screenshots: '相关截图',
      similar: '类似工具推荐',
      reviewsTitle: '用户评价',
      ratingLabel: '评分',
      usersLabel: '全球用户',
      notFound: '找不到这个项目。',
      note: '这个页面用来更清楚地比较 AI 项目、方案和订阅价值。',
    };
  }
  return {
    back: 'Back to directory',
    choose: 'Choose an option',
    pricing: 'Pricing plans',
    addPlan: 'Choose this plan',
    visit: 'Visit website',
    favorite: 'Save tool',
    saved: 'Saved',
    overview: 'Project overview',
    intro: 'Tool intro',
    features: 'Core features',
    screenshots: 'Screenshots',
    similar: 'Similar tools',
    reviewsTitle: 'User reviews',
    ratingLabel: 'Rating',
    usersLabel: 'Users',
    notFound: 'This project could not be found.',
    note: 'This page is optimized for clearer AI project evaluation, plan comparison, and purchase readiness.',
  };
}

function formatCurrency(value: number, locale?: string): string {
  const resolved = getNavCopy(locale).locale;
  return new Intl.NumberFormat(resolved === 'en' ? 'en-US' : 'zh-CN', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value >= 100 ? 0 : 2,
  }).format(value);
}

function getProductImage(product: DirectoryProduct | undefined | null): string {
  const images = asArray(product?.images);
  if (!images.length) return '/placeholder-product.svg';
  const main = images.find((item) => item.isMain);
  return main?.url || images[0]?.url || '/placeholder-product.svg';
}

function getWebsiteUrl(product: DirectoryProduct): string | null {
  const typeData = (product as { typeData?: Record<string, unknown> }).typeData;
  const url = typeData?.websiteUrl ?? typeData?.website ?? typeData?.url;
  return typeof url === 'string' && /^https?:\/\//i.test(url) ? url : null;
}

function getStats(product: DirectoryProduct, locale?: string) {
  const copy = getDetailCopy(locale);
  const rating = Number(product.rating) > 0 ? Number(product.rating).toFixed(1) : '4.8';
  const users =
    Number(product.reviewCount) > 0 ? `${Number(product.reviewCount).toLocaleString('en-US')}+` : '100M+';
  return [
    { label: copy.ratingLabel, value: rating },
    { label: copy.usersLabel, value: users },
  ];
}

function FavoriteButton({ product, className }: { product: DirectoryProduct; className: string }) {
  const copy = getDetailCopy();
  const [saved, setSaved] = React.useState(false);
  return (
    <button
      type="button"
      aria-pressed={saved}
      onClick={() => setSaved((value) => !value)}
      className={className}
    >
      <Heart className={`h-4 w-4 ${saved ? 'fill-current' : ''}`} />
      {saved ? copy.saved : copy.favorite}
      <span className="sr-only">{product.name}</span>
    </button>
  );
}

function MobileProductDetailView({
  product,
  locale,
  onProductBack,
  onAddToCart,
  onVariantChange,
  selectedVariant,
}: {
  product: DirectoryProduct;
  locale?: string;
  onProductBack: () => void;
  onAddToCart: () => Promise<void>;
  onVariantChange: (variantId: string) => void;
  selectedVariant?: string;
}) {
  const copy = getDetailCopy(locale);
  const planMeta = getSubmissionPlanMeta(product, locale);
  const image = getProductImage(product);
  const variants = asArray(product.variants);
  const tags = asArray(product.tags);
  const specifications = asArray(product.specifications);
  const images = asArray(product.images);
  const activeVariant =
    variants.find((variant) => variant.id === selectedVariant) || variants[0] || null;
  const detailLocale = getNavCopy(locale).locale;
  const stats = getStats(product, locale);
  const websiteUrl = getWebsiteUrl(product);
  const featureRows = planMeta
    ? planMeta.benefits
    : specifications.slice(0, 5).map((spec) => `${spec.name}: ${spec.value}`);

  return (
    <div className="space-y-7 pb-3 lg:hidden">
      <section className="pt-6">
        <div className="flex items-start gap-4">
          <ToolLogo name={product.name} imageUrl={image} size="xl" />
          <div className="min-w-0 flex-1 pt-1">
            <h1 className="text-[1.55rem] font-black leading-tight text-[#11162b]">{product.name}</h1>
            <p className="mt-1 text-sm font-semibold text-[#6f7890]">{product.category?.name || (planMeta?.kindLabel ?? 'AI')}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {(tags.length ? tags.slice(0, 2) : [planMeta?.kindLabel || 'AI']).map((tag) => (
                <span key={tag} className="rounded-full bg-[#f0f2ff] px-2.5 py-1 text-[0.68rem] font-bold text-[#6257ff]">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-7 grid grid-cols-2 divide-x divide-[#edf0f8] text-center">
          <div>
            <Rating value={stats[0].value} />
            <div className="mt-1 text-xs font-semibold text-[#8a93a8]">{stats[0].label}</div>
          </div>
          <div>
            <div className="text-base font-black text-[#11162b]">{stats[1].value}</div>
            <div className="mt-1 text-xs font-semibold text-[#8a93a8]">{stats[1].label}</div>
          </div>
        </div>

        <div className="mt-7 grid gap-3">
          {planMeta ? (
            <button
              type="button"
              onClick={() => void onAddToCart()}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-[0.7rem] bg-[#6257ff] text-sm font-bold text-white shadow-[0_16px_32px_-24px_rgba(98,87,255,0.72)]"
            >
              {copy.addPlan}
              <ExternalLink className="h-4 w-4" />
            </button>
          ) : websiteUrl ? (
            <a
              href={websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-[0.7rem] bg-[#6257ff] text-sm font-bold text-white shadow-[0_16px_32px_-24px_rgba(98,87,255,0.72)]"
            >
              {copy.visit}
              <ExternalLink className="h-4 w-4" />
            </a>
          ) : (
            <button
              type="button"
              onClick={onProductBack}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-[0.7rem] bg-[#6257ff] text-sm font-bold text-white shadow-[0_16px_32px_-24px_rgba(98,87,255,0.72)]"
            >
              {copy.visit}
              <ExternalLink className="h-4 w-4" />
            </button>
          )}
          <FavoriteButton
            product={product}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-[0.7rem] border border-[#dcd9ff] bg-white text-sm font-bold text-[#6257ff]"
          />
        </div>
      </section>

      <section className="border-t border-[#edf0f8] pt-6">
        <h2 className="text-[1.12rem] font-black text-[#11162b]">{copy.intro}</h2>
        <p className="mt-4 text-sm font-medium leading-7 text-[#667086]">{product.description || copy.overview}</p>
        {variants.length ? (
          <div className="mt-5 flex flex-wrap gap-2">
            {variants.map((variant) => (
              <button
                key={variant.id}
                type="button"
                onClick={() => onVariantChange(variant.id)}
                className={[
                  'rounded-full border px-4 py-2 text-xs font-bold',
                  activeVariant?.id === variant.id
                    ? 'border-[#6257ff] bg-[#f0f2ff] text-[#6257ff]'
                    : 'border-[#edf0f8] bg-white text-[#657086]',
                ].join(' ')}
              >
                {variant.name || variant.value}
              </button>
            ))}
          </div>
        ) : null}
      </section>

      <section className="border-t border-[#edf0f8] pt-6">
        <h2 className="text-[1.12rem] font-black text-[#11162b]">{copy.features}</h2>
        <div className="mt-4 grid gap-4">
          {(featureRows.length ? featureRows : [
            detailLocale === 'en' ? 'Natural language conversations' : '自然语言对话',
            detailLocale === 'en' ? 'Content creation' : '内容创作',
            detailLocale === 'en' ? 'Coding assistance' : '代码编程',
            detailLocale === 'en' ? 'Multilingual support' : '多语言支持',
            detailLocale === 'en' ? 'Knowledge Q&A' : '知识问答',
          ]).slice(0, 5).map((row) => (
            <div key={row} className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#6257ff]" />
              <div>
                <div className="text-sm font-black text-[#11162b]">{row.split(':')[0]}</div>
                <div className="mt-1 text-xs font-medium leading-5 text-[#8a93a8]">{row.includes(':') ? row.split(':').slice(1).join(':').trim() : copy.note}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {images.length ? (
        <section className="border-t border-[#edf0f8] pt-6">
          <h2 className="text-[1.12rem] font-black text-[#11162b]">{copy.screenshots}</h2>
          <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
            {images.slice(0, 3).map((item) => (
              <div key={item.id} className="h-28 min-w-[6.8rem] overflow-hidden rounded-[0.65rem] bg-[#10162f]">
                <img src={item.url} alt={item.alt || product.name} className="h-full w-full object-cover" />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="border-t border-[#edf0f8] pt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-[1.12rem] font-black text-[#11162b]">{copy.similar}</h2>
          <span className="text-xs font-bold text-[#6257ff]">{getNavCopy(locale).common.browseAll}</span>
        </div>
        <div className="mt-4 grid gap-4">
          {['Claude 3', 'Gemini', 'Perplexity'].map((name, index) => (
            <div key={name} className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3">
              <ToolLogo name={name} size="sm" />
              <div className="min-w-0">
                <div className="truncate text-sm font-black text-[#11162b]">{name}</div>
                <div className="truncate text-xs font-semibold text-[#8a93a8]">{index === 0 ? 'Anthropic' : index === 1 ? 'Google' : 'Perplexity AI'}</div>
              </div>
              <Rating value={index === 0 ? '4.8' : index === 1 ? '4.6' : '4.5'} compact />
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-[#edf0f8] pt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-[1.12rem] font-black text-[#11162b]">{copy.reviewsTitle}</h2>
          <span className="text-xs font-bold text-[#6257ff]">{getNavCopy(locale).common.browseAll}</span>
        </div>
        <div className="mt-4 grid gap-3">
          {[
            { name: detailLocale === 'en' ? 'Mina' : '张小明', time: detailLocale === 'en' ? '2 days ago' : '2 天前' },
            { name: detailLocale === 'en' ? 'Lee' : '李晓华', time: detailLocale === 'en' ? '1 week ago' : '1 周前' },
          ].map((review) => (
            <article key={review.name} className="rounded-[0.8rem] border border-[#edf0f8] bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="h-8 w-8 rounded-full bg-[#eef0ff]" />
                  <div className="text-sm font-black text-[#11162b]">{review.name}</div>
                </div>
                <span className="text-xs font-medium text-[#9aa3b5]">{review.time}</span>
              </div>
              <div className="mt-2"><Rating value="5.0" compact /></div>
              <p className="mt-2 text-xs font-medium leading-6 text-[#667086]">
                {detailLocale === 'en'
                  ? 'Clean, useful, and easy to evaluate. It made tool selection much faster.'
                  : '非常强大的 AI 工具，回答准确，逻辑清晰，强烈推荐！'}
              </p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

export const ProductDetailPage = React.memo(function ProductDetailPage({
  product,
  isLoading,
  selectedVariant,
  quantity,
  locale,
  config,
  onVariantChange,
  onQuantityChange,
  onAddToCart,
  onBack,
}: ProductDetailPageProps) {
  const copy = getDetailCopy(locale);

  if (isLoading) {
    return (
      <MarketplaceFrame locale={locale} config={config}>
        <div className="rounded-[var(--navtoai-radius-xl)] border border-[var(--navtoai-line)] bg-[var(--navtoai-surface)] p-10 text-center text-[var(--navtoai-copy)]">
          {getNavCopy(locale).common.loading}
        </div>
      </MarketplaceFrame>
    );
  }

  if (!product) {
    return (
      <MarketplaceFrame locale={locale} config={config}>
        <div className="flex min-h-[70vh] items-center justify-center px-4">
          <div className="max-w-lg rounded-[var(--navtoai-radius-xl)] border border-[var(--navtoai-line)] bg-[var(--navtoai-surface)] p-10 text-center shadow-[var(--navtoai-shadow-sm)]">
            <h1 className="text-2xl font-black tracking-[-0.05em] text-[var(--navtoai-ink)]">{copy.notFound}</h1>
            <button
              type="button"
              onClick={onBack}
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,var(--navtoai-primary),var(--navtoai-primary-strong))] px-5 py-3 text-sm font-semibold text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              {copy.back}
            </button>
          </div>
        </div>
      </MarketplaceFrame>
    );
  }

  const specifications = asArray(product.specifications);
  const variants = asArray(product.variants);
  const tags = asArray(product.tags);
  const image = getProductImage(product);
  const planMeta = getSubmissionPlanMeta(product, locale);
  const websiteUrl = getWebsiteUrl(product);
  const stats = getStats(product, locale);
  const featureRows = planMeta
    ? planMeta.benefits
    : specifications.slice(0, 5).map((spec) => `${spec.name}: ${spec.value}`);

  return (
    <MarketplaceFrame locale={locale} config={config}>
      <MobileProductDetailView
        product={product}
        locale={locale}
        onProductBack={onBack}
        onAddToCart={onAddToCart}
        onVariantChange={onVariantChange}
        selectedVariant={selectedVariant}
      />

      <div className="hidden space-y-6 lg:block">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-full border border-[var(--navtoai-line)] bg-white px-4 py-2 text-sm font-semibold text-[var(--navtoai-copy)]"
        >
          <ArrowLeft className="h-4 w-4" />
          {copy.back}
        </button>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(22rem,0.72fr)]">
          <section className="rounded-[var(--navtoai-radius-xl)] border border-[var(--navtoai-line)] bg-[var(--navtoai-surface)] p-6 shadow-[var(--navtoai-shadow-sm)] sm:p-8">
            <div className="flex items-start gap-5">
              <ToolLogo name={product.name} imageUrl={image} size="xl" />
              <div className="min-w-0 flex-1">
                <div className="inline-flex items-center gap-2 rounded-full bg-[var(--navtoai-primary-soft)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--navtoai-primary-strong)]">
                  <Sparkles className="h-4 w-4 text-[var(--navtoai-primary)]" />
                  {planMeta?.kindLabel || product.category?.name || 'AI'}
                </div>
                <h1 className="mt-4 text-[clamp(2rem,3.6vw,3.2rem)] font-black leading-[1.02] tracking-[-0.05em] text-[var(--navtoai-ink)]">
                  {product.name}
                </h1>
                <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
                  <span className="flex items-center gap-2">
                    <Rating value={stats[0].value} compact />
                    <span className="text-sm font-bold text-[var(--navtoai-ink)]">{stats[0].value}</span>
                    <span className="text-xs font-semibold text-[var(--navtoai-copy-soft)]">{stats[0].label}</span>
                  </span>
                  <span className="text-sm font-semibold text-[var(--navtoai-copy)]">
                    {stats[1].value} <span className="text-xs text-[var(--navtoai-copy-soft)]">{stats[1].label}</span>
                  </span>
                  {tags.length ? (
                    <span className="flex flex-wrap gap-2">
                      {tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="rounded-full bg-[var(--navtoai-bg-alt)] px-3 py-1 text-xs font-bold text-[var(--navtoai-primary-strong)]">
                          #{tag}
                        </span>
                      ))}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <p className="mt-6 text-base leading-8 text-[var(--navtoai-copy)]">
              {product.description || copy.overview}
            </p>

            <section className="mt-8">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--navtoai-copy-soft)]">
                {copy.features}
              </p>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {(featureRows.length ? featureRows : [
                  getNavCopy(locale).locale === 'en' ? 'Natural language conversations' : '自然语言对话',
                  getNavCopy(locale).locale === 'en' ? 'Content creation' : '内容创作',
                  getNavCopy(locale).locale === 'en' ? 'Coding assistance' : '代码编程',
                  getNavCopy(locale).locale === 'en' ? 'Multilingual support' : '多语言支持',
                ]).slice(0, 6).map((row) => (
                  <div key={row} className="flex items-start gap-3 rounded-[1rem] bg-[var(--navtoai-bg-alt)] p-4">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[var(--navtoai-primary)]" />
                    <div className="min-w-0">
                      <div className="text-sm font-black text-[var(--navtoai-ink)]">{row.split(':')[0]}</div>
                      <div className="mt-1 text-xs font-medium leading-5 text-[var(--navtoai-copy-soft)]">
                        {row.includes(':') ? row.split(':').slice(1).join(':').trim() : copy.note}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {planMeta ? (
              <section className="mt-8 rounded-[1.2rem] bg-[var(--navtoai-bg-alt)] p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--navtoai-primary-strong)]">
                  {planMeta.kindLabel}
                </p>
                <p className="mt-3 text-sm leading-7 text-[var(--navtoai-copy)]">{planMeta.reviewNote}</p>
                <p className="mt-3 text-sm leading-7 text-[var(--navtoai-copy)]">{planMeta.paymentNote}</p>
                <div className="mt-4 grid gap-2">
                  {planMeta.benefits.map((benefit) => (
                    <div key={benefit} className="rounded-[1rem] bg-white px-4 py-3 text-sm font-medium text-[var(--navtoai-ink)]">
                      {benefit}
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </section>

          <aside className="space-y-4">
            <section className="rounded-[var(--navtoai-radius-xl)] border border-[var(--navtoai-line)] bg-[var(--navtoai-surface)] p-6 shadow-[var(--navtoai-shadow-sm)]">
              {planMeta ? (
                <button
                  type="button"
                  onClick={() => void onAddToCart()}
                  className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,var(--navtoai-primary),var(--navtoai-primary-strong))] px-5 text-sm font-semibold text-white shadow-[var(--navtoai-glow)]"
                >
                  {copy.addPlan}
                  <ExternalLink className="h-4 w-4" />
                </button>
              ) : websiteUrl ? (
                <a
                  href={websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,var(--navtoai-primary),var(--navtoai-primary-strong))] px-5 text-sm font-semibold text-white shadow-[var(--navtoai-glow)]"
                >
                  {copy.visit}
                  <ExternalLink className="h-4 w-4" />
                </a>
              ) : (
                <button
                  type="button"
                  onClick={onBack}
                  className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,var(--navtoai-primary),var(--navtoai-primary-strong))] px-5 text-sm font-semibold text-white shadow-[var(--navtoai-glow)]"
                >
                  {copy.visit}
                  <ExternalLink className="h-4 w-4" />
                </button>
              )}
              <FavoriteButton
                product={product}
                className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-[var(--navtoai-line)] bg-white px-5 text-sm font-semibold text-[var(--navtoai-primary-strong)]"
              />

              {variants.length ? (
                <div className="mt-6">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--navtoai-copy-soft)]">
                    {copy.pricing}
                  </p>
                  <div className="mt-3 grid gap-2">
                    {variants.slice(0, 4).map((variant) => (
                      <div
                        key={variant.id}
                        className="flex items-center justify-between rounded-[1rem] bg-[var(--navtoai-bg-alt)] px-4 py-3"
                      >
                        <span className="text-sm font-bold text-[var(--navtoai-ink)]">{variant.name || variant.value}</span>
                        <span className="text-sm font-black text-[var(--navtoai-primary-strong)]">
                          {Number(variant.price ?? 0) > 0 ? formatCurrency(Number(variant.price ?? 0), locale) : copyFree(locale)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </section>

            <section className="rounded-[var(--navtoai-radius-xl)] border border-[var(--navtoai-line)] bg-[var(--navtoai-surface)] p-6 shadow-[var(--navtoai-shadow-sm)]">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-[1rem] bg-[var(--navtoai-primary-soft)] text-[var(--navtoai-primary)]">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <p className="text-sm leading-6 text-[var(--navtoai-copy)]">
                  {copy.note}
                </p>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </MarketplaceFrame>
  );
});

function copyFree(locale?: string): string {
  const resolved = getNavCopy(locale).locale;
  if (resolved === 'zh-Hant') return '免費';
  if (resolved === 'zh-Hans') return '免费';
  return 'Free';
}
