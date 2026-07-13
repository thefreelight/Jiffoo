import React from 'react';
import { ArrowRight, CheckCircle2, Copy, ExternalLink, Loader2, ShieldCheck } from 'lucide-react';
import type { OrderSuccessPageProps } from 'shared/src/types/theme';
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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,color-mix(in_oklab,var(--vault-primary-soft)_88%,white),transparent_28%),linear-gradient(180deg,var(--vault-bg),color-mix(in_oklab,var(--vault-bg)_94%,white))] px-4 pb-16 pt-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[980px]">
        <section className="rounded-[var(--vault-radius-lg)] border border-[var(--vault-line)] bg-[var(--vault-surface)] p-6 text-center shadow-[var(--vault-shadow)] sm:p-10">
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-[2rem] bg-[color:color-mix(in_oklab,var(--vault-success)_18%,white)] text-[var(--vault-success)]">
            {isVerifying ? <Loader2 className="h-10 w-10 animate-spin" /> : <CheckCircle2 className="h-10 w-10" />}
          </div>

          <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--vault-copy-soft)]">
            {isVerifying ? 'Verifying payment session' : 'Order accepted'}
          </p>
          <h1 className="mt-4 text-[clamp(2.4rem,5vw,4.8rem)] font-black leading-[0.94] tracking-[-0.05em] text-[var(--vault-ink)]">
            {isVerifying ? 'Finalizing your travel archive.' : 'Your Bokmoo order is ready.'}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-[var(--vault-copy)]">
            {isVerifying
              ? 'The storefront is confirming payment and checking whether any fulfillment details are already available.'
              : 'QR details are attached to the order as soon as fulfillment completes. If delivery is instant, you may already see activation data below.'}
          </p>

          <div className="mx-auto mt-8 inline-flex items-center gap-3 rounded-full border border-[var(--vault-line)] bg-[var(--vault-bg)] px-5 py-3 text-sm text-[var(--vault-ink)]">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--vault-copy-soft)]">
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
                  className="rounded-[var(--vault-radius-lg)] border border-[var(--vault-line)] bg-[var(--vault-surface)] p-6 shadow-[var(--vault-shadow)]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--vault-copy-soft)]">
                        Delivered item
                      </p>
                      <h2 className="mt-3 text-2xl font-black tracking-[-0.04em] text-[var(--vault-ink)]">
                        {item.productName}
                      </h2>
                    </div>
                    <div className="flex h-11 w-11 items-center justify-center rounded-[1rem] bg-[var(--vault-primary-soft)] text-[var(--vault-primary)]">
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                  </div>

                  {fields.length ? (
                    <div className="mt-5 grid gap-3 md:grid-cols-3">
                      {fields.map((field) => (
                        <div
                          key={`${item.id}-${field.label}-${field.value}`}
                          className="rounded-[var(--vault-radius-md)] border border-[var(--vault-line)] bg-[var(--vault-bg)] p-4"
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
                    <div className="mt-5 rounded-[var(--vault-radius-md)] border border-dashed border-[var(--vault-line)] bg-[var(--vault-bg)] p-4 text-sm text-[var(--vault-copy)]">
                      Fulfillment is still syncing. Open the order archive to refresh and view the complete activation panel.
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
            className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-[var(--vault-primary)] px-7 text-sm font-semibold uppercase tracking-[0.18em] text-white"
          >
            Open order archive
            <ArrowRight className="h-4 w-4" />
          </button>
          <button
            onClick={onContinueShopping}
            className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full border border-[var(--vault-line)] bg-[var(--vault-surface)] px-7 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--vault-ink)]"
          >
            Continue shopping
          </button>
        </div>
      </div>
    </div>
  );
});
