import React from 'react';
import { ArrowLeft, CheckCircle2, ExternalLink, Heart, Minus, Plus, ShieldCheck, ShoppingBag, Sparkles } from 'lucide-react';
import type { ProductDetailPageProps } from 'shared/src/types/theme';
import { MarketplaceFrame } from './MarketplaceFrame';
import { getNavCopy } from '../i18n';
import { getSubmissionPlanMeta } from '../lib/submission-plan';
import { Rating, ToolLogo } from './design-primitives';

function getDetailCopy(locale?: string) {
  const resolved = getNavCopy(locale).locale;
  if (resolved === 'zh-Hant') {
    return {
      back: '返回目錄',
      choose: '選擇方案',
      quantity: '數量',
      add: '加入清單',
      addPlan: '選擇這個方案',
      visit: '訪問官網',
      favorite: '收藏工具',
      overview: '項目概覽',
      intro: '工具簡介',
      features: '主要功能',
      screenshots: '相關截圖',
      similar: '類似工具推薦',
      reviewsTitle: '用戶評價',
      specs: '規格資訊',
      notFound: '找不到這個項目。',
      note: '這個頁面用來更清楚地比較 AI 項目、方案與訂閱價值。',
    };
  }
  if (resolved === 'zh-Hans') {
    return {
      back: '返回目录',
      choose: '选择方案',
      quantity: '数量',
      add: '加入清单',
      addPlan: '选择这个方案',
      visit: '访问官网',
      favorite: '收藏工具',
      overview: '项目概览',
      intro: '工具简介',
      features: '主要功能',
      screenshots: '相关截图',
      similar: '类似工具推荐',
      reviewsTitle: '用户评价',
      specs: '规格信息',
      notFound: '找不到这个项目。',
      note: '这个页面用来更清楚地比较 AI 项目、方案和订阅价值。',
    };
  }
  return {
    back: 'Back to directory',
    choose: 'Choose an option',
    quantity: 'Quantity',
    add: 'Add to stack',
    addPlan: 'Choose this plan',
    visit: 'Visit website',
    favorite: 'Save tool',
    overview: 'Project overview',
    intro: 'Tool intro',
    features: 'Core features',
    screenshots: 'Screenshots',
    similar: 'Similar tools',
    reviewsTitle: 'User reviews',
    specs: 'Specifications',
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

type ProductDetail = NonNullable<ProductDetailPageProps['product']>;

function getProductImages(product: ProductDetailPageProps['product']): ProductDetail['images'] {
  return Array.isArray(product?.images) ? product.images : [];
}

function getProductVariants(product: ProductDetailPageProps['product']): ProductDetail['variants'] {
  return Array.isArray(product?.variants) ? product.variants : [];
}

function getProductSpecifications(product: ProductDetailPageProps['product']): ProductDetail['specifications'] {
  return Array.isArray(product?.specifications) ? product.specifications : [];
}

function getProductTags(product: ProductDetailPageProps['product']): ProductDetail['tags'] {
  return Array.isArray(product?.tags) ? product.tags : [];
}

function getProductImage(product: ProductDetailPageProps['product']): string {
  const images = getProductImages(product);
  if (!images.length) return '/placeholder-product.svg';
  const main = images.find((item) => item.isMain);
  return main?.url || images[0]?.url || '/placeholder-product.svg';
}

function MobileProductDetailView({
  product,
  locale,
  quantity,
  onProductBack,
  onAddToCart,
  onQuantityChange,
  onVariantChange,
  selectedVariant,
}: {
  product: NonNullable<ProductDetailPageProps['product']>;
  locale?: string;
  quantity: number;
  onProductBack: () => void;
  onAddToCart: () => Promise<void>;
  onQuantityChange: (quantity: number) => void;
  onVariantChange: (variantId: string) => void;
  selectedVariant?: string;
}) {
  const copy = getDetailCopy(locale);
  const planMeta = getSubmissionPlanMeta(product, locale);
  const image = getProductImage(product);
  const images = getProductImages(product);
  const specifications = getProductSpecifications(product);
  const tags = getProductTags(product);
  const variants = getProductVariants(product);
  const activeVariant = variants.find((variant) => variant.id === selectedVariant) || variants[0] || null;
  const unitPrice = Number(activeVariant?.price ?? product.price ?? 0);
  const detailLocale = getNavCopy(locale).locale;
  const stats = [
    {
      label: detailLocale === 'en' ? 'Rating' : detailLocale === 'zh-Hant' ? '評分' : '评分',
      value: product.rating > 0 ? product.rating.toFixed(1) : '4.8',
    },
    {
      label: detailLocale === 'en' ? 'Reviews' : detailLocale === 'zh-Hant' ? '評價' : '评价',
      value: product.reviewCount > 0 ? `${product.reviewCount}+` : '100M+',
    },
  ];
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
            <p className="mt-1 text-sm font-semibold text-[#6f7890]">{product.category?.name || (planMeta?.kindLabel ?? 'OpenAI')}</p>
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
            <div className="mt-1 text-xs font-semibold text-[#8a93a8]">{detailLocale === 'en' ? 'Users' : detailLocale === 'zh-Hant' ? '全球用戶' : '全球用户'}</div>
          </div>
        </div>

        <div className="mt-7 grid gap-3">
          <button
            type="button"
            onClick={() => void onAddToCart()}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-[0.7rem] bg-[#6257ff] text-sm font-bold text-white shadow-[0_16px_32px_-24px_rgba(98,87,255,0.72)]"
          >
            {planMeta ? copy.addPlan : copy.visit}
            <ExternalLink className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onProductBack}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-[0.7rem] border border-[#dcd9ff] bg-white text-sm font-bold text-[#6257ff]"
          >
            <Heart className="h-4 w-4" />
            {copy.favorite}
          </button>
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

      <section className="border-t border-[#edf0f8] pt-6">
        <h2 className="text-[1.12rem] font-black text-[#11162b]">{copy.screenshots}</h2>
        <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
          {(images.length ? images : [{ id: 'fallback', url: image, alt: product.name, order: 0, isMain: true }]).slice(0, 3).map((item) => (
            <div key={item.id} className="h-28 min-w-[6.8rem] overflow-hidden rounded-[0.65rem] bg-[#10162f]">
              <img src={item.url} alt={item.alt || product.name} className="h-full w-full object-cover" />
            </div>
          ))}
        </div>
      </section>

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

  const specifications = getProductSpecifications(product);
  const variants = getProductVariants(product);
  const activeVariant = variants.find((variant) => variant.id === selectedVariant) || variants[0] || null;
  const unitPrice = Number(activeVariant?.price ?? product.price ?? 0);
  const image = getProductImage(product);
  const planMeta = getSubmissionPlanMeta(product, locale);

  return (
    <MarketplaceFrame locale={locale} config={config}>
      <MobileProductDetailView
        product={product}
        locale={locale}
        quantity={quantity}
        onProductBack={onBack}
        onAddToCart={onAddToCart}
        onQuantityChange={onQuantityChange}
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
          <section className="rounded-[var(--navtoai-radius-xl)] border border-[var(--navtoai-line)] bg-[var(--navtoai-surface)] shadow-[var(--navtoai-shadow-sm)]">
            <div className="overflow-hidden border-b border-[var(--navtoai-line)] bg-[linear-gradient(135deg,rgba(106,108,255,0.14),rgba(123,201,255,0.1),rgba(255,255,255,0.5))]">
              <img src={image} alt={product.name} className="aspect-[1.24/1] w-full object-cover" />
            </div>

            <div className="p-6 sm:p-8">
              <div className="inline-flex items-center gap-2 rounded-full bg-[var(--navtoai-primary-soft)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--navtoai-primary-strong)]">
                <Sparkles className="h-4 w-4 text-[var(--navtoai-primary)]" />
                {planMeta?.kindLabel || product.category?.name || 'AI'}
              </div>
              <h1 className="mt-5 text-[clamp(2.2rem,4vw,3.8rem)] font-black leading-[0.96] tracking-[-0.06em] text-[var(--navtoai-ink)]">
                {product.name}
              </h1>
              <p className="mt-4 text-base leading-8 text-[var(--navtoai-copy)]">
                {product.description || copy.overview}
              </p>

              {specifications.length ? (
                <section className="mt-8">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--navtoai-copy-soft)]">
                    {copy.specs}
                  </p>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {specifications.slice(0, 8).map((spec) => (
                      <div key={`${spec.group || 'spec'}-${spec.name}`} className="rounded-[1rem] bg-[var(--navtoai-bg-alt)] p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--navtoai-copy-soft)]">
                          {spec.group || spec.name}
                        </p>
                        <p className="mt-2 text-sm font-semibold text-[var(--navtoai-ink)]">
                          {spec.group ? `${spec.name}: ${spec.value}` : spec.value}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

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
            </div>
          </section>

          <aside className="space-y-4">
            <section className="rounded-[var(--navtoai-radius-xl)] border border-[var(--navtoai-line)] bg-[var(--navtoai-surface)] p-6 shadow-[var(--navtoai-shadow-sm)]">
              <div className="text-4xl font-black tracking-[-0.06em] text-[var(--navtoai-ink)]">
                {formatCurrency(unitPrice, locale)}
              </div>
              {product.originalPrice && product.originalPrice > unitPrice ? (
                <div className="mt-2 text-lg text-[var(--navtoai-copy-soft)] line-through">
                  {formatCurrency(product.originalPrice, locale)}
                </div>
              ) : null}

              {variants.length ? (
                <div className="mt-6">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--navtoai-copy-soft)]">
                    {copy.choose}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {variants.map((variant) => {
                      const active = activeVariant?.id === variant.id;
                      return (
                        <button
                          key={variant.id}
                          type="button"
                          onClick={() => onVariantChange(variant.id)}
                          className={[
                            'rounded-full border px-4 py-2 text-sm font-semibold transition-colors',
                            active
                              ? 'border-[var(--navtoai-primary)] bg-[var(--navtoai-primary-soft)] text-[var(--navtoai-primary-strong)]'
                              : 'border-[var(--navtoai-line)] bg-white text-[var(--navtoai-copy)]',
                          ].join(' ')}
                        >
                          {variant.name || variant.value}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              <div className="mt-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--navtoai-copy-soft)]">
                  {copy.quantity}
                </p>
                <div className="mt-3 flex items-center justify-between rounded-full border border-[var(--navtoai-line)] bg-[var(--navtoai-bg-alt)] px-3 py-2">
                  <button type="button" onClick={() => onQuantityChange(Math.max(1, quantity - 1))} className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--navtoai-copy)]">
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="text-lg font-black text-[var(--navtoai-ink)]">{quantity}</span>
                  <button type="button" onClick={() => onQuantityChange(Math.min(10, quantity + 1))} className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--navtoai-copy)]">
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => void onAddToCart()}
                className="mt-6 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,var(--navtoai-primary),var(--navtoai-primary-strong))] px-5 text-sm font-semibold text-white shadow-[var(--navtoai-glow)]"
              >
                <ShoppingBag className="h-4 w-4" />
                {planMeta ? copy.addPlan : copy.add}
              </button>
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
