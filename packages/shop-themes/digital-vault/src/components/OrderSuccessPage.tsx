import React from 'react';
import { ArrowRight, CheckCircle2, Copy, ExternalLink, Loader2 } from 'lucide-react';
import type { OrderSuccessPageProps } from '../types/theme';
import { extractDeliverySections } from '../lib/digital-fulfillment';

function copyToClipboard(value: string) {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return;
  navigator.clipboard.writeText(value).catch(() => undefined);
}

export const OrderSuccessPage = React.memo(function OrderSuccessPage({
  orderNumber,
  order,
  isVerifying,
  onContinueShopping,
  onViewOrders,
}: OrderSuccessPageProps & { order?: any }) {
  const previewItems = order?.items?.slice(0, 2) || [];

  return (
    <div className="min-h-screen bg-[var(--vault-bg)] px-4 pb-16 pt-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[980px]">
        <section className="rounded-[var(--vault-radius-lg)] border border-[var(--vault-line)] bg-[var(--vault-surface)] p-6 text-center shadow-[var(--vault-shadow-soft)] sm:p-10">
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-[2rem] bg-[color:color-mix(in_oklab,var(--vault-success)_18%,white)] text-[var(--vault-success)]">
            {isVerifying ? <Loader2 className="h-10 w-10 animate-spin" /> : <CheckCircle2 className="h-10 w-10" />}
          </div>

          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.22em] text-[var(--vault-copy-soft)]">
            {isVerifying ? 'Verifying payment' : 'Order confirmed'}
          </p>
          <h1 className="mt-4 text-[clamp(2.2rem,5vw,4.2rem)] font-black leading-[1.02] tracking-[-0.045em] text-[var(--vault-ink)]">
            {isVerifying ? 'Finishing your order center.' : 'Your order is now in the order center.'}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-[var(--vault-copy)]">
            {isVerifying
              ? 'The storefront is confirming payment and checking whether any delivery artifacts are already available.'
              : 'If fulfillment is instant, you may already see codes, accounts, or download links below. If not, this order remains the source of truth once delivery lands.'}
          </p>

          <div className="mx-auto mt-8 inline-flex items-center gap-3 rounded-xl border border-[var(--vault-line)] bg-[var(--vault-surface-alt)] px-5 py-3 text-sm text-[var(--vault-ink)]">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--vault-copy-soft)]">
              Order reference
            </span>
            <code className="font-black">{orderNumber}</code>
            <button
              onClick={() => copyToClipboard(orderNumber)}
              className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--vault-primary)]"
            >
              <Copy className="h-3.5 w-3.5" />
              Copy
            </button>
          </div>
        </section>

        {previewItems.length ? (
          <section className="mt-6 grid gap-4">
            {previewItems.map((item: any) => {
              const sections = extractDeliverySections(item.fulfillmentData);
              const fields = [...sections.codes, ...sections.credentials, ...sections.links].slice(0, 3);
              return (
                <article
                  key={item.id}
                  className="rounded-[var(--vault-radius-lg)] border border-[var(--vault-line)] bg-[var(--vault-surface)] p-6 shadow-[var(--vault-shadow-soft)]"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--vault-copy-soft)]">
                    Delivered item
                  </p>
                  <h2 className="mt-3 text-2xl font-bold tracking-tight text-[var(--vault-ink)]">
                    {item.productName}
                  </h2>

                  {fields.length ? (
                    <div className="mt-5 grid gap-3 md:grid-cols-3">
                      {fields.map((field) => (
                        <div
                          key={`${item.id}-${field.label}-${field.value}`}
                          className="rounded-xl border border-[var(--vault-line)] bg-[var(--vault-surface-alt)] p-4"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--vault-copy-soft)]">
                              {field.label}
                            </p>
                            {'href' in field && field.href ? (
                              <a
                                href={field.href}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--vault-primary)]"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                                Open
                              </a>
                            ) : (
                              <button
                                onClick={() => copyToClipboard(field.value)}
                                className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--vault-primary)]"
                              >
                                <Copy className="h-3.5 w-3.5" />
                                Copy
                              </button>
                            )}
                          </div>
                          <p className="mt-3 break-all text-sm font-semibold text-[var(--vault-ink)]">
                            {field.value}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-5 rounded-xl border border-dashed border-[var(--vault-line)] bg-[var(--vault-surface-alt)] p-4 text-sm text-[var(--vault-copy)]">
                      Fulfillment is still syncing. Open the order center to refresh and view the complete delivery panel.
                    </div>
                  )}
                </article>
              );
            })}
          </section>
        ) : null}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            onClick={onViewOrders}
            className="inline-flex min-h-14 items-center justify-center gap-2 rounded-xl bg-[var(--vault-primary)] px-7 text-sm font-semibold text-white transition-colors hover:bg-[var(--vault-primary-strong)]"
          >
            Open order center
            <ArrowRight className="h-4 w-4" />
          </button>
          <button
            onClick={onContinueShopping}
            className="inline-flex min-h-14 items-center justify-center gap-2 rounded-xl border border-[var(--vault-line)] bg-[var(--vault-surface)] px-7 text-sm font-medium text-[var(--vault-ink)] transition-colors hover:bg-[var(--vault-primary-soft)]"
          >
            Continue shopping
          </button>
        </div>
      </div>
    </div>
  );
});
