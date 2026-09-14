import React from 'react';
import { Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import type { CartPageProps } from 'shared/src/types/theme';
import { MarketplaceFrame } from './MarketplaceFrame';
import { getNavCopy } from '../i18n';
import { getSubmissionPlanMetaByName } from '../lib/submission-plan';

function getCartCopy(locale?: string) {
  const copy = getNavCopy(locale);

  if (copy.locale === 'zh-Hant') {
    return {
      title: '你的購物車',
      empty: '目前還沒有任何項目。',
      continue: '繼續探索',
      checkout: '前往結帳',
      remove: '移除',
      subtotal: '小計',
      tax: '稅費',
      shipping: '運費',
      discount: '折扣',
      total: '總計',
    };
  }

  if (copy.locale === 'zh-Hans') {
    return {
      title: '你的购物车',
      empty: '购物车里还没有任何项目。',
      continue: '继续探索',
      checkout: '去结账',
      remove: '移除',
      subtotal: '小计',
      tax: '税费',
      shipping: '运费',
      discount: '优惠',
      total: '合计',
    };
  }

  return {
    title: 'Your cart',
    empty: 'Your cart is still empty.',
    continue: 'Keep browsing',
    checkout: 'Checkout',
    remove: 'Remove',
    subtotal: 'Subtotal',
    tax: 'Tax',
    shipping: 'Shipping',
    discount: 'Discount',
    total: 'Total',
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

export const CartPage = React.memo(function CartPage({
  cart,
  isLoading,
  locale,
  config,
  onUpdateQuantity,
  onRemoveItem,
  onCheckout,
  onContinueShopping,
}: CartPageProps) {
  const content = getCartCopy(locale);

  if (isLoading) {
    return (
      <MarketplaceFrame locale={locale} config={config}>
        <div className="rounded-[var(--navtoai-radius-xl)] border border-[var(--navtoai-line)] bg-[var(--navtoai-surface)] p-10 text-center text-[var(--navtoai-copy)]">
          {getNavCopy(locale).common.loading}
        </div>
      </MarketplaceFrame>
    );
  }

  return (
    <MarketplaceFrame locale={locale} config={config}>
      <div className="space-y-6">
        <section className="rounded-[var(--navtoai-radius-xl)] border border-[var(--navtoai-line)] bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(244,246,255,0.96))] p-6 shadow-[var(--navtoai-shadow-sm)]">
          <div className="inline-flex items-center gap-2 rounded-full bg-[var(--navtoai-primary-soft)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--navtoai-primary-strong)]">
            <ShoppingBag className="h-4 w-4 text-[var(--navtoai-primary)]" />
            {content.title}
          </div>
          <h1 className="mt-4 text-[clamp(2rem,4vw,3.4rem)] font-black tracking-[-0.06em] text-[var(--navtoai-ink)]">
            {content.title}
          </h1>
        </section>

        {cart.items.length === 0 ? (
          <div className="rounded-[var(--navtoai-radius-xl)] border border-dashed border-[var(--navtoai-line)] bg-[var(--navtoai-surface)] p-16 text-center">
            <p className="text-base text-[var(--navtoai-copy)]">{content.empty}</p>
            <button
              type="button"
              onClick={onContinueShopping}
              className="mt-6 inline-flex items-center rounded-full bg-[linear-gradient(135deg,var(--navtoai-primary),var(--navtoai-primary-strong))] px-5 py-3 text-sm font-semibold text-white"
            >
              {content.continue}
            </button>
          </div>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
            <section className="grid gap-4">
              {cart.items.map((item) => {
                const planMeta = getSubmissionPlanMetaByName(item.productName, locale);

                return (
                  <article
                    key={item.id}
                    className="rounded-[var(--navtoai-radius-lg)] border border-[var(--navtoai-line)] bg-[var(--navtoai-surface)] p-5 shadow-[var(--navtoai-shadow-sm)]"
                  >
                  <div className="grid gap-4 md:grid-cols-[5rem_minmax(0,1fr)_auto] md:items-center">
                    <div className="h-20 w-20 overflow-hidden rounded-[1rem] border border-[var(--navtoai-line)] bg-[var(--navtoai-bg-alt)]">
                      {item.productImage ? (
                        <img src={item.productImage} alt={item.productName} className="h-full w-full object-cover" />
                      ) : null}
                    </div>
                    <div className="min-w-0">
                      {planMeta ? (
                        <span className="inline-flex rounded-full bg-[var(--navtoai-primary-soft)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--navtoai-primary-strong)]">
                          {planMeta.kindLabel}
                        </span>
                      ) : null}
                      <h2 className="text-lg font-black tracking-[-0.03em] text-[var(--navtoai-ink)]">{item.productName}</h2>
                      <p className="mt-1 text-sm text-[var(--navtoai-copy-soft)]">{item.variantName || item.productId}</p>
                      {planMeta ? <p className="mt-2 text-xs leading-6 text-[var(--navtoai-copy)]">{planMeta.paymentNote}</p> : null}
                      <p className="mt-2 text-sm font-semibold text-[var(--navtoai-ink)]">{formatCurrency(item.price, locale)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void onUpdateQuantity(item.id, Math.max(1, item.quantity - 1))}
                        className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--navtoai-line)] bg-white text-[var(--navtoai-ink)]"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="min-w-[2rem] text-center text-sm font-semibold text-[var(--navtoai-ink)]">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => void onUpdateQuantity(item.id, Math.min(item.maxQuantity, item.quantity + 1))}
                        className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--navtoai-line)] bg-white text-[var(--navtoai-ink)]"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void onRemoveItem(item.id)}
                        className="ml-2 flex h-10 w-10 items-center justify-center rounded-full border border-[var(--navtoai-line)] bg-white text-[var(--navtoai-copy-soft)]"
                        aria-label={content.remove}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  </article>
                );
              })}
            </section>

            <aside className="rounded-[var(--navtoai-radius-lg)] border border-[var(--navtoai-line)] bg-[var(--navtoai-surface)] p-5 shadow-[var(--navtoai-shadow-sm)]">
              <div className="grid gap-3 text-sm text-[var(--navtoai-copy)]">
                <SummaryRow label={content.subtotal} value={formatCurrency(cart.subtotal, locale)} />
                <SummaryRow label={content.tax} value={formatCurrency(cart.tax, locale)} />
                <SummaryRow label={content.shipping} value={formatCurrency(cart.shipping, locale)} />
                <SummaryRow label={content.discount} value={`-${formatCurrency(cart.discount, locale)}`} />
              </div>
              <div className="mt-4 border-t border-[var(--navtoai-line)] pt-4">
                <SummaryRow strong label={content.total} value={formatCurrency(cart.total, locale)} />
              </div>
              <button
                type="button"
                onClick={onCheckout}
                className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--navtoai-primary),var(--navtoai-primary-strong))] px-5 text-sm font-semibold text-white"
              >
                {content.checkout}
              </button>
              <button
                type="button"
                onClick={onContinueShopping}
                className="mt-3 inline-flex min-h-12 w-full items-center justify-center rounded-full border border-[var(--navtoai-line)] bg-white px-5 text-sm font-semibold text-[var(--navtoai-ink)]"
              >
                {content.continue}
              </button>
            </aside>
          </div>
        )}
      </div>
    </MarketplaceFrame>
  );
});

function SummaryRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={strong ? 'font-semibold text-[var(--navtoai-ink)]' : ''}>{label}</span>
      <span className={strong ? 'text-lg font-black text-[var(--navtoai-ink)]' : 'font-semibold text-[var(--navtoai-ink)]'}>
        {value}
      </span>
    </div>
  );
}
