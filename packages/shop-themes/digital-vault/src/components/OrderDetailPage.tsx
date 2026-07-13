import React from 'react';
import { ArrowLeft, Copy, ExternalLink, PackageCheck, ShieldCheck } from 'lucide-react';
import { cn } from '@jiffoo/ui';
import type { OrderDetailPageProps } from '../types/theme';
import { extractDeliverySections, getDeliveredArtifactCount } from '../lib/digital-fulfillment';

function copyToClipboard(value: string) {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return;
  navigator.clipboard.writeText(value).catch(() => undefined);
}

function statusTone(status: string): string {
  const normalized = status.toUpperCase();
  if (normalized === 'DELIVERED' || normalized === 'COMPLETED') return 'bg-[color:color-mix(in_oklab,var(--vault-success)_18%,white)] text-[var(--vault-ink)]';
  if (normalized === 'PENDING' || normalized === 'PAID' || normalized === 'PROCESSING') return 'bg-[color:color-mix(in_oklab,var(--vault-warning)_18%,white)] text-[var(--vault-ink)]';
  if (normalized === 'CANCELLED' || normalized === 'REFUNDED') return 'bg-[color:color-mix(in_oklab,var(--vault-danger)_14%,white)] text-[var(--vault-ink)]';
  return 'bg-[var(--vault-primary-soft)] text-[var(--vault-primary-strong)]';
}

function renderField(label: string, value: string, action?: React.ReactNode) {
  return (
    <div className="rounded-xl border border-[var(--vault-line)] bg-[var(--vault-surface-alt)] p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--vault-copy-soft)]">{label}</p>
        {action}
      </div>
      <p className="mt-3 break-all text-sm font-semibold text-[var(--vault-ink)]">{value}</p>
    </div>
  );
}

export const OrderDetailPage = React.memo(function OrderDetailPage({
  order,
  isLoading,
  onBack,
  onBackToOrders,
  onCancelOrder,
}: OrderDetailPageProps) {
  const handleBack = onBack || onBackToOrders;

  if (isLoading) {
    return <div className="min-h-screen bg-[var(--vault-bg)]" />;
  }

  if (!order) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--vault-bg)] px-4">
        <div className="rounded-[var(--vault-radius-lg)] border border-[var(--vault-line)] bg-[var(--vault-surface)] p-10 text-center shadow-[var(--vault-shadow-soft)]">
          <h1 className="text-3xl font-bold text-[var(--vault-ink)]">Order not found</h1>
          {handleBack ? (
            <button
              onClick={handleBack}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[var(--vault-primary)] px-5 py-3 text-sm font-semibold text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to orders
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  const artifactCount = order.items.reduce(
    (sum, item) => sum + getDeliveredArtifactCount(item.fulfillmentData),
    0
  );

  return (
    <div className="min-h-screen bg-[var(--vault-bg)] px-4 pb-16 pt-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1280px]">
        {handleBack ? (
          <button
            onClick={handleBack}
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--vault-line)] bg-[var(--vault-surface)] px-4 py-2.5 text-sm font-medium text-[var(--vault-copy)] transition-colors hover:bg-[var(--vault-primary-soft)] hover:text-[var(--vault-ink)]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to orders
          </button>
        ) : null}

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(20rem,0.7fr)]">
          <section className="space-y-4">
            <div className="rounded-[var(--vault-radius-lg)] border border-[var(--vault-line)] bg-[var(--vault-surface)] p-6 shadow-[var(--vault-shadow-soft)] sm:p-8">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn('rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]', statusTone(order.status))}>
                      {order.status}
                    </span>
                    <span className="rounded-full border border-[var(--vault-line)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--vault-copy)]">
                      Payment {order.paymentStatus}
                    </span>
                    <span className="rounded-full border border-[var(--vault-line)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--vault-copy)]">
                      {artifactCount} artifact{artifactCount === 1 ? '' : 's'}
                    </span>
                  </div>
                  <h1 className="mt-5 text-[clamp(2rem,4vw,3.6rem)] font-black tracking-[-0.045em] text-[var(--vault-ink)]">
                    Order #{order.id.slice(-8).toUpperCase()}
                  </h1>
                  <p className="mt-3 text-sm leading-6 text-[var(--vault-copy)]">
                    Created {new Date(order.createdAt).toLocaleString()} · updated {new Date(order.updatedAt).toLocaleString()}
                  </p>
                </div>
                {onCancelOrder && ['PENDING', 'PAID'].includes(order.status.toUpperCase()) ? (
                  <button
                    onClick={() => onCancelOrder()}
                    className="inline-flex min-h-12 items-center justify-center rounded-xl border border-[var(--vault-line)] bg-[var(--vault-surface-alt)] px-5 text-sm font-medium text-[var(--vault-copy)] transition-colors hover:bg-[var(--vault-primary-soft)] hover:text-[var(--vault-ink)]"
                  >
                    Cancel order
                  </button>
                ) : null}
              </div>
            </div>

            {order.items.map((item) => {
              const sections = extractDeliverySections(item.fulfillmentData);
              const hasContent =
                sections.codes.length +
                  sections.credentials.length +
                  sections.links.length +
                  sections.meta.length +
                  sections.notes.length >
                0;

              return (
                <article
                  key={item.id}
                  className="rounded-[var(--vault-radius-lg)] border border-[var(--vault-line)] bg-[var(--vault-surface)] p-6 shadow-[var(--vault-shadow-soft)] sm:p-8"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--vault-copy-soft)]">
                        Delivered item
                      </p>
                      <h2 className="mt-3 text-2xl font-bold tracking-tight text-[var(--vault-ink)]">
                        {item.productName}
                      </h2>
                      <p className="mt-2 text-sm text-[var(--vault-copy)]">
                        Qty {item.quantity}
                        {item.variantName ? ` · ${item.variantName}` : ''}
                      </p>
                    </div>
                    <span className={cn('rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]', statusTone(item.fulfillmentStatus || order.status))}>
                      {item.fulfillmentStatus || order.status}
                    </span>
                  </div>

                  {hasContent ? (
                    <div className="mt-6 grid gap-4">
                      {sections.codes.length ? (
                        <div className="grid gap-3 md:grid-cols-2">
                          {sections.codes.map((field) => (
                            <div key={`${item.id}-${field.label}-${field.value}`}>
                              {renderField(
                                field.label,
                                field.value,
                                <button
                                  onClick={() => copyToClipboard(field.value)}
                                  className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--vault-primary)]"
                                >
                                  <Copy className="h-3.5 w-3.5" />
                                  Copy
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : null}

                      {sections.credentials.length ? (
                        <div className="grid gap-3 md:grid-cols-2">
                          {sections.credentials.map((field) => (
                            <div key={`${item.id}-${field.label}-${field.value}`}>
                              {renderField(
                                field.label,
                                field.value,
                                <button
                                  onClick={() => copyToClipboard(field.value)}
                                  className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--vault-primary)]"
                                >
                                  <Copy className="h-3.5 w-3.5" />
                                  Copy
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : null}

                      {sections.links.length ? (
                        <div className="grid gap-3">
                          {sections.links.map((field) =>
                            renderField(
                              field.label,
                              field.value,
                              <a
                                href={field.href}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--vault-primary)]"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                                Open
                              </a>
                            )
                          )}
                        </div>
                      ) : null}

                      {sections.meta.length ? (
                        <div className="grid gap-3 md:grid-cols-2">
                          {sections.meta.map((field) => (
                            <div key={`${item.id}-${field.label}-${field.value}`}>
                              {renderField(field.label, field.value)}
                            </div>
                          ))}
                        </div>
                      ) : null}

                      {sections.notes.length ? (
                        <div className="rounded-xl border border-[var(--vault-line)] bg-[var(--vault-surface-alt)] p-5">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--vault-copy-soft)]">
                            Notes
                          </p>
                          <div className="mt-3 space-y-2">
                            {sections.notes.map((note) => (
                              <p key={note} className="text-sm leading-6 text-[var(--vault-copy)]">
                                {note}
                              </p>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="mt-6 rounded-xl border border-dashed border-[var(--vault-line)] bg-[var(--vault-surface-alt)] p-5 text-sm leading-6 text-[var(--vault-copy)]">
                      Fulfillment is still syncing. Open this order again shortly to refresh the delivery panel.
                    </div>
                  )}
                </article>
              );
            })}
          </section>

          <aside className="space-y-4">
            <div className="rounded-[var(--vault-radius-lg)] border border-[var(--vault-line)] bg-[var(--vault-surface)] p-6 shadow-[var(--vault-shadow-soft)]">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--vault-primary-soft)] text-[var(--vault-primary)]">
                  <PackageCheck className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--vault-copy-soft)]">
                    Order total
                  </p>
                  <p className="mt-1 text-3xl font-black tracking-[-0.04em] text-[var(--vault-ink)]">
                    ${Number(order.totalAmount || 0).toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="mt-6 space-y-3 text-sm text-[var(--vault-copy)]">
                <div className="flex items-center justify-between">
                  <span>Currency</span>
                  <span className="font-semibold text-[var(--vault-ink)]">{order.currency}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Payment</span>
                  <span className="font-semibold text-[var(--vault-ink)]">{order.paymentStatus}</span>
                </div>
                {order.cancelReason ? (
                  <div className="rounded-xl border border-[var(--vault-line)] bg-[var(--vault-surface-alt)] p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--vault-copy-soft)]">
                      Cancel reason
                    </p>
                    <p className="mt-2 text-sm text-[var(--vault-copy)]">{order.cancelReason}</p>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="rounded-[var(--vault-radius-lg)] border border-[var(--vault-line)] bg-[var(--vault-surface)] p-6 shadow-[var(--vault-shadow-soft)]">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--vault-primary-soft)] text-[var(--vault-primary)]">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--vault-copy-soft)]">
                    Security reminder
                  </p>
                  <p className="mt-1 text-sm leading-6 text-[var(--vault-copy)]">
                    Move sensitive codes or account credentials into your own secure vault after claiming the order.
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
});
