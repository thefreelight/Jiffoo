import React from 'react';
import { ArrowRight, RotateCcw, TriangleAlert } from 'lucide-react';
import type { OrderCancelledPageProps } from 'shared/src/types/theme';
import { MarketplaceFrame } from './MarketplaceFrame';
import { getNavCopy } from '../i18n';

function getCancelledCopy(locale?: string) {
  const copy = getNavCopy(locale);

  if (copy.locale === 'zh-Hant') {
    return {
      title: '這次結帳已取消。',
      body: '你的訂單沒有被扣款，你可以返回購物車調整後再重新提交。',
      returnToCart: '返回購物車',
      continueShopping: '繼續探索',
    };
  }

  if (copy.locale === 'zh-Hans') {
    return {
      title: '这次结账已取消。',
      body: '订单没有被扣款，你可以回到购物车调整后再重新提交。',
      returnToCart: '返回购物车',
      continueShopping: '继续探索',
    };
  }

  return {
    title: 'This checkout was cancelled.',
    body: 'Nothing was charged. You can return to your cart, adjust the order, and try again.',
    returnToCart: 'Back to cart',
    continueShopping: 'Keep browsing',
  };
}

export const OrderCancelledPage = React.memo(function OrderCancelledPage({
  locale,
  config,
  onReturnToCart,
  onContinueShopping,
}: OrderCancelledPageProps) {
  const content = getCancelledCopy(locale);

  return (
    <MarketplaceFrame locale={locale} config={config}>
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        <div className="max-w-xl rounded-[var(--navtoai-radius-xl)] border border-[var(--navtoai-line)] bg-[var(--navtoai-surface)] p-10 text-center shadow-[var(--navtoai-shadow-sm)]">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[1.6rem] bg-[rgba(255,219,162,0.28)] text-[#d18a1c]">
            <TriangleAlert className="h-10 w-10" />
          </div>
          <h1 className="mt-6 text-[clamp(2rem,4vw,3rem)] font-black tracking-[-0.06em] text-[var(--navtoai-ink)]">
            {content.title}
          </h1>
          <p className="mx-auto mt-4 max-w-md text-base leading-7 text-[var(--navtoai-copy)]">{content.body}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={onReturnToCart}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,var(--navtoai-primary),var(--navtoai-primary-strong))] px-5 py-3 text-sm font-semibold text-white"
            >
              <RotateCcw className="h-4 w-4" />
              {content.returnToCart}
            </button>
            <button
              type="button"
              onClick={onContinueShopping}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-[var(--navtoai-line)] bg-white px-5 py-3 text-sm font-semibold text-[var(--navtoai-ink)]"
            >
              {content.continueShopping}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </MarketplaceFrame>
  );
});
