import React from 'react';
import { ArrowLeft, BadgeCheck, ShieldCheck } from 'lucide-react';
import type { OrderDetailPageProps } from 'shared/src/types/theme';
import { MarketplaceFrame } from './MarketplaceFrame';
import { getNavCopy } from '../i18n';
import { getSubmissionPlanMetaByName } from '../lib/submission-plan';

function getDetailCopy(locale?: string) {
  const resolved = getNavCopy(locale).locale;
  if (resolved === 'zh-Hant') {
    return { back: '返回訂單', notFound: '找不到這筆訂單。', cancel: '取消訂單', total: '總計', address: '配送資訊' };
  }
  if (resolved === 'zh-Hans') {
    return { back: '返回订单', notFound: '找不到这笔订单。', cancel: '取消订单', total: '合计', address: '收货信息' };
  }
  return { back: 'Back to orders', notFound: 'Order not found.', cancel: 'Cancel order', total: 'Total', address: 'Shipping details' };
}

function formatCurrency(value: number, locale?: string): string {
  const resolved = getNavCopy(locale).locale;
  return new Intl.NumberFormat(resolved === 'en' ? 'en-US' : 'zh-CN', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value >= 100 ? 0 : 2,
  }).format(value);
}

export const OrderDetailPage = React.memo(function OrderDetailPage({
  order,
  isLoading,
  locale,
  config,
  onBack,
  onBackToOrders,
  onCancelOrder,
}: OrderDetailPageProps) {
  const copy = getDetailCopy(locale);
  const goBack = onBack || onBackToOrders;

  if (isLoading) {
    return (
      <MarketplaceFrame locale={locale} config={config}>
        <div className="rounded-[var(--navtoai-radius-xl)] border border-[var(--navtoai-line)] bg-[var(--navtoai-surface)] p-10 text-center text-[var(--navtoai-copy)]">
          {getNavCopy(locale).common.loading}
        </div>
      </MarketplaceFrame>
    );
  }

  if (!order) {
    return (
      <MarketplaceFrame locale={locale} config={config}>
        <div className="flex min-h-[70vh] items-center justify-center px-4">
          <div className="max-w-lg rounded-[var(--navtoai-radius-xl)] border border-[var(--navtoai-line)] bg-[var(--navtoai-surface)] p-10 text-center shadow-[var(--navtoai-shadow-sm)]">
            <h1 className="text-2xl font-black tracking-[-0.05em] text-[var(--navtoai-ink)]">{copy.notFound}</h1>
            {goBack ? (
              <button type="button" onClick={goBack} className="mt-6 inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,var(--navtoai-primary),var(--navtoai-primary-strong))] px-5 py-3 text-sm font-semibold text-white">
                <ArrowLeft className="h-4 w-4" />
                {copy.back}
              </button>
            ) : null}
          </div>
        </div>
      </MarketplaceFrame>
    );
  }

  return (
    <MarketplaceFrame locale={locale} config={config}>
      <div className="space-y-6">
        {goBack ? (
          <button type="button" onClick={goBack} className="inline-flex items-center gap-2 rounded-full border border-[var(--navtoai-line)] bg-white px-4 py-2 text-sm font-semibold text-[var(--navtoai-copy)]">
            <ArrowLeft className="h-4 w-4" />
            {copy.back}
          </button>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_20rem]">
          <section className="space-y-4">
            <article className="rounded-[var(--navtoai-radius-xl)] border border-[var(--navtoai-line)] bg-[var(--navtoai-surface)] p-6 shadow-[var(--navtoai-shadow-sm)]">
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[var(--navtoai-primary-soft)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--navtoai-primary-strong)]">
                      {order.status}
                    </span>
                    <span className="rounded-full bg-[var(--navtoai-bg-alt)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--navtoai-copy-soft)]">
                      {order.paymentStatus}
                    </span>
                  </div>
                  <h1 className="mt-4 text-[clamp(2rem,4vw,3.4rem)] font-black tracking-[-0.06em] text-[var(--navtoai-ink)]">
                    #{order.id.slice(-8).toUpperCase()}
                  </h1>
                  <p className="mt-3 text-sm text-[var(--navtoai-copy)]">{new Date(order.createdAt).toLocaleString()}</p>
                </div>
                {onCancelOrder && ['PENDING', 'PAID'].includes(order.status.toUpperCase()) ? (
                  <button type="button" onClick={() => void onCancelOrder()} className="inline-flex min-h-12 items-center justify-center rounded-full border border-[var(--navtoai-line)] bg-white px-5 text-sm font-semibold text-[var(--navtoai-copy)]">
                    {copy.cancel}
                  </button>
                ) : null}
              </div>
            </article>

            {order.items.map((item) => {
              const planMeta = getSubmissionPlanMetaByName(item.productName, locale);

              return (
              <article key={item.id} className="rounded-[var(--navtoai-radius-xl)] border border-[var(--navtoai-line)] bg-[var(--navtoai-surface)] p-6 shadow-[var(--navtoai-shadow-sm)]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    {planMeta ? (
                      <span className="inline-flex rounded-full bg-[var(--navtoai-primary-soft)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--navtoai-primary-strong)]">
                        {planMeta.kindLabel}
                      </span>
                    ) : null}
                    <h2 className="text-xl font-black tracking-[-0.04em] text-[var(--navtoai-ink)]">{item.productName}</h2>
                    <p className="mt-2 text-sm text-[var(--navtoai-copy)]">
                      {item.quantity} x {formatCurrency(item.unitPrice, locale)}
                    </p>
                    {item.variantName ? <p className="mt-1 text-sm text-[var(--navtoai-copy-soft)]">{item.variantName}</p> : null}
                    {planMeta ? <p className="mt-2 text-xs leading-6 text-[var(--navtoai-copy)]">{planMeta.paymentNote}</p> : null}
                  </div>
                  <span className="rounded-full bg-[var(--navtoai-bg-alt)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--navtoai-copy-soft)]">
                    {item.fulfillmentStatus || order.status}
                  </span>
                </div>
                {item.fulfillmentData ? (
                  <div className="mt-4 rounded-[1rem] bg-[var(--navtoai-bg-alt)] p-4 text-sm leading-6 text-[var(--navtoai-copy)]">
                    <pre className="overflow-x-auto whitespace-pre-wrap break-words text-xs">{JSON.stringify(item.fulfillmentData, null, 2)}</pre>
                  </div>
                ) : null}
              </article>
              );
            })}
          </section>

          <aside className="space-y-4">
            <article className="rounded-[var(--navtoai-radius-xl)] border border-[var(--navtoai-line)] bg-[var(--navtoai-surface)] p-5 shadow-[var(--navtoai-shadow-sm)]">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--navtoai-copy-soft)]">{copy.total}</div>
              <div className="mt-2 text-3xl font-black tracking-[-0.05em] text-[var(--navtoai-ink)]">{formatCurrency(order.totalAmount, locale)}</div>
            </article>
            {order.shippingAddress ? (
              <article className="rounded-[var(--navtoai-radius-xl)] border border-[var(--navtoai-line)] bg-[var(--navtoai-surface)] p-5 shadow-[var(--navtoai-shadow-sm)]">
                <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--navtoai-copy-soft)]">
                  <ShieldCheck className="h-4 w-4 text-[var(--navtoai-primary)]" />
                  {copy.address}
                </div>
                <div className="mt-4 text-sm leading-7 text-[var(--navtoai-copy)]">
                  {order.shippingAddress.firstName || ''} {order.shippingAddress.lastName || ''}<br />
                  {order.shippingAddress.addressLine1 || ''}<br />
                  {order.shippingAddress.city}, {order.shippingAddress.state || ''} {order.shippingAddress.postalCode || ''}<br />
                  {order.shippingAddress.country}
                </div>
              </article>
            ) : null}
          </aside>
        </div>
      </div>
    </MarketplaceFrame>
  );
});
