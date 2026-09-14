import React from 'react';
import { ArrowRight, Clock3, ShoppingBag } from 'lucide-react';
import type { OrdersPageProps } from 'shared/src/types/theme';
import { MarketplaceFrame } from './MarketplaceFrame';
import { getNavCopy } from '../i18n';
import { getSubmissionPlanMetaByName } from '../lib/submission-plan';

function getOrdersCopy(locale?: string) {
  const resolved = getNavCopy(locale).locale;
  if (resolved === 'zh-Hant') {
    return {
      title: '訂單與提交記錄',
      empty: '目前還沒有任何訂單。',
      open: '查看訂單',
      cancel: '取消',
      previous: '上一頁',
      next: '下一頁',
      page: '第',
      total: '總計',
      plan: '提交方案',
    };
  }
  if (resolved === 'zh-Hans') {
    return {
      title: '订单与提交记录',
      empty: '目前还没有任何订单。',
      open: '查看订单',
      cancel: '取消',
      previous: '上一页',
      next: '下一页',
      page: '第',
      total: '合计',
      plan: '提交方案',
    };
  }
  return {
    title: 'Orders and submissions',
    empty: 'There are no orders yet.',
    open: 'Open order',
    cancel: 'Cancel',
    previous: 'Previous',
    next: 'Next',
    page: 'Page',
    total: 'Total',
    plan: 'Submission plan',
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

export const OrdersPage = React.memo(function OrdersPage({
  orders,
  isLoading,
  error,
  currentPage,
  totalPages,
  locale,
  config,
  onPageChange,
  onOrderClick,
  onCancelOrder,
}: OrdersPageProps) {
  const copy = getOrdersCopy(locale);

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
        <section className="rounded-[var(--navtoai-radius-xl)] border border-[var(--navtoai-line)] bg-[var(--navtoai-surface)] p-6 shadow-[var(--navtoai-shadow-sm)] sm:p-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-[var(--navtoai-primary-soft)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--navtoai-primary-strong)]">
            <ShoppingBag className="h-4 w-4 text-[var(--navtoai-primary)]" />
            {copy.title}
          </div>
          <h1 className="mt-4 text-[clamp(2rem,4vw,3.4rem)] font-black tracking-[-0.06em] text-[var(--navtoai-ink)]">
            {copy.title}
          </h1>
        </section>

        {error ? (
          <div className="rounded-[var(--navtoai-radius-xl)] border border-red-200 bg-red-50 p-5 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {orders.length === 0 ? (
          <div className="rounded-[var(--navtoai-radius-xl)] border border-dashed border-[var(--navtoai-line)] bg-[var(--navtoai-surface)] p-16 text-center text-[var(--navtoai-copy)]">
            {copy.empty}
          </div>
        ) : (
          <div className="grid gap-4">
            {orders.map((order) => {
              const canCancel = ['PENDING', 'PAID'].includes(order.status.toUpperCase());
              const containsPlan = order.items.some((item) => getSubmissionPlanMetaByName(item.productName, locale));
              return (
                <article
                  key={order.id}
                  className="rounded-[var(--navtoai-radius-lg)] border border-[var(--navtoai-line)] bg-[var(--navtoai-surface)] p-5 shadow-[var(--navtoai-shadow-sm)]"
                >
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-[var(--navtoai-primary-soft)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--navtoai-primary-strong)]">
                          {order.status}
                        </span>
                        <span className="rounded-full bg-[var(--navtoai-bg-alt)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--navtoai-copy-soft)]">
                          {order.paymentStatus}
                        </span>
                        {containsPlan ? (
                          <span className="rounded-full bg-[var(--navtoai-primary-soft)]/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--navtoai-primary-strong)]">
                            {copy.plan}
                          </span>
                        ) : null}
                      </div>
                      <h2 className="mt-4 text-2xl font-black tracking-[-0.04em] text-[var(--navtoai-ink)]">
                        #{order.id.slice(-8).toUpperCase()}
                      </h2>
                      <div className="mt-3 inline-flex items-center gap-2 text-sm text-[var(--navtoai-copy)]">
                        <Clock3 className="h-4 w-4" />
                        {new Date(order.createdAt).toLocaleString()}
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <div className="rounded-[1rem] bg-[var(--navtoai-bg-alt)] px-4 py-3 text-right">
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--navtoai-copy-soft)]">{copy.total}</div>
                        <div className="mt-1 text-2xl font-black tracking-[-0.04em] text-[var(--navtoai-ink)]">
                          {formatCurrency(order.totalAmount, locale)}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onOrderClick(order.id)}
                        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,var(--navtoai-primary),var(--navtoai-primary-strong))] px-5 text-sm font-semibold text-white"
                      >
                        {copy.open}
                        <ArrowRight className="h-4 w-4" />
                      </button>
                      {canCancel ? (
                        <button
                          type="button"
                          onClick={() => void onCancelOrder(order.id)}
                          className="inline-flex min-h-12 items-center justify-center rounded-full border border-[var(--navtoai-line)] bg-white px-5 text-sm font-semibold text-[var(--navtoai-copy)]"
                        >
                          {copy.cancel}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {totalPages > 1 ? (
          <nav className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1}
              className="rounded-full border border-[var(--navtoai-line)] bg-white px-5 py-3 text-sm font-semibold text-[var(--navtoai-copy)] disabled:opacity-40"
            >
              {copy.previous}
            </button>
            <span className="rounded-full border border-[var(--navtoai-line)] bg-white px-5 py-3 text-sm font-semibold text-[var(--navtoai-copy)]">
              {copy.page} {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage >= totalPages}
              className="rounded-full border border-[var(--navtoai-line)] bg-white px-5 py-3 text-sm font-semibold text-[var(--navtoai-copy)] disabled:opacity-40"
            >
              {copy.next}
            </button>
          </nav>
        ) : null}
      </div>
    </MarketplaceFrame>
  );
});
