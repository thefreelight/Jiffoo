import React from 'react';
import { ArrowLeft, Copy, ExternalLink, PackageCheck, ShieldCheck } from 'lucide-react';
import { cn } from '@jiffoo/ui';
import type { OrderDetailPageProps } from 'shared/src/types/theme';
import { getBokmooInstallSession, getBokmooOrder, getOrderIdFromLocation, mapBokmooApiOrderToThemeOrder, normalizeInstallSession, type BokmooInstallSession } from '../lib/api';
import { InstallSessionPanel } from './InstallSessionPanel';
import { extractDeliverySections, getDeliveredArtifactCount } from '../lib/digital-fulfillment';
import { resolveBokmooSiteConfig } from '../site';

function copyToClipboard(value: string) {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return;
  navigator.clipboard.writeText(value).catch(() => undefined);
}

function statusTone(status: string): string {
  const normalized = status.toUpperCase();
  if (normalized === 'DELIVERED' || normalized === 'COMPLETED') return 'bg-[color:color-mix(in_oklab,var(--bokmoo-success)_18%,white)] text-[var(--bokmoo-ink)]';
  if (normalized === 'PENDING' || normalized === 'PAID' || normalized === 'PROCESSING') return 'bg-[color:color-mix(in_oklab,var(--bokmoo-warning)_18%,white)] text-[var(--bokmoo-ink)]';
  if (normalized === 'CANCELLED' || normalized === 'REFUNDED') return 'bg-[color:color-mix(in_oklab,var(--bokmoo-danger)_14%,white)] text-[var(--bokmoo-ink)]';
  return 'bg-[var(--bokmoo-primary-soft)] text-[var(--bokmoo-primary-strong)]';
}

function renderField(label: string, value: string, action?: React.ReactNode) {
  return (
    <div className="rounded-[var(--bokmoo-radius-md)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold tracking-[0.16em] text-[var(--bokmoo-copy-soft)]">{label}</p>
        {action}
      </div>
      <p className="mt-3 break-all text-sm font-semibold text-[var(--bokmoo-ink)]">{value}</p>
    </div>
  );
}

export const OrderDetailPage = React.memo(function OrderDetailPage({
  order,
  isLoading,
  config,
  onBack,
  onBackToOrders,
  onCancelOrder,
}: OrderDetailPageProps) {
  const handleBack = onBack || onBackToOrders;
  const site = resolveBokmooSiteConfig(config);
  const [remoteOrder, setRemoteOrder] = React.useState<OrderDetailPageProps['order']>(null);
  const [installSession, setInstallSession] = React.useState<BokmooInstallSession | null>(null);
  const effectiveOrder = order || remoteOrder;

  React.useEffect(() => {
    if (order?.id) return;

    const orderId = getOrderIdFromLocation();
    if (!orderId) return;

    let cancelled = false;

    void getBokmooOrder(
      {
        baseUrl: site.apiBaseUrl,
      },
      orderId
    )
      .then((response) => {
        if (!cancelled) {
          setRemoteOrder(mapBokmooApiOrderToThemeOrder(response));
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [order?.id, site.apiBaseUrl]);

  React.useEffect(() => {
    if (!effectiveOrder?.id) return;

    let cancelled = false;

    void getBokmooInstallSession(
        {
          baseUrl: site.apiBaseUrl,
        },
        effectiveOrder.id
      )
      .then((session) => {
        if (!cancelled) {
          setInstallSession(session);
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [effectiveOrder?.id, site.apiBaseUrl]);

  if (isLoading) {
    return <div className="min-h-screen bg-[var(--bokmoo-bg)]" />;
  }

  if (!effectiveOrder) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bokmoo-bg)] px-4">
        <div className="rounded-[var(--bokmoo-radius-lg)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-surface)] p-10 text-center shadow-[var(--bokmoo-shadow)]">
          <h1 className="text-3xl font-black tracking-[-0.04em] text-[var(--bokmoo-ink)]">Order not found</h1>
          {handleBack ? (
            <button
              onClick={handleBack}
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-[var(--bokmoo-primary)] px-5 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to orders
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  const artifactCount = effectiveOrder.items.reduce(
    (sum, item) => sum + getDeliveredArtifactCount(item.fulfillmentData),
    0
  );

  return (
    <div className="min-h-screen bg-[var(--bokmoo-bg)] px-4 pb-16 pt-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1280px]">
        {handleBack ? (
          <button
            onClick={handleBack}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--bokmoo-line)] bg-[var(--bokmoo-surface)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-copy)]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to orders
          </button>
        ) : null}

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(20rem,0.7fr)]">
          <section className="space-y-4">
            <div className="rounded-[var(--bokmoo-radius-lg)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-surface)] p-6 shadow-[var(--bokmoo-shadow)] sm:p-8">
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn('rounded-full px-3 py-1 text-[11px] font-semibold tracking-[0.16em]', statusTone(effectiveOrder.status))}>
                      {effectiveOrder.status}
                    </span>
                    <span className="rounded-full border border-[var(--bokmoo-line)] px-3 py-1 text-[11px] font-semibold tracking-[0.16em] text-[var(--bokmoo-copy)]">
                      {artifactCount} delivered item{artifactCount === 1 ? '' : 's'}
                    </span>
                  </div>
                  <h1 className="mt-5 text-[clamp(2.2rem,4vw,4rem)] font-black tracking-[-0.05em] text-[var(--bokmoo-ink)]">
                    Order #{effectiveOrder.id.slice(-8).toUpperCase()}
                  </h1>
                  <p className="mt-3 text-sm leading-6 text-[var(--bokmoo-copy)]">
                    Created {new Date(effectiveOrder.createdAt).toLocaleString()} · payment {effectiveOrder.paymentStatus}
                  </p>
                </div>
                {onCancelOrder && ['PENDING', 'PAID'].includes(effectiveOrder.status.toUpperCase()) ? (
                  <button
                    onClick={() => onCancelOrder()}
                    className="inline-flex min-h-12 items-center justify-center rounded-full border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] px-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-copy)]"
                  >
                    Cancel order
                  </button>
                ) : null}
              </div>
            </div>

            {installSession ? (
              <InstallSessionPanel
                title="Install Session"
                session={installSession}
                className="border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)]"
              />
            ) : null}

            {effectiveOrder.items.map((item) => {
              const sections = extractDeliverySections(item.fulfillmentData);
              const installLike = (() => {
                const data = item.fulfillmentData as (Partial<BokmooInstallSession> & Record<string, unknown>) | null | undefined;
                if (!data || typeof data !== 'object') return null;
                if (
                  !(
                    'qrCode' in data ||
                    'qr_code' in data ||
                    'qrCodeContent' in data ||
                    'qr_code_content' in data ||
                    'lpaString' in data ||
                    'lpa' in data ||
                    'lpa_string' in data ||
                    'smdpAddress' in data ||
                    'smdp_address' in data ||
                    'smdp' in data ||
                    'matchingId' in data ||
                    'matching_id' in data ||
                    'activationCode' in data ||
                    'activation_code' in data
                  )
                ) {
                  return null;
                }
                return normalizeInstallSession({
                  ...data,
                  orderId: effectiveOrder.id,
                  orderNumber: effectiveOrder.id,
                  status: 'ready',
                  packageTitle: item.productName,
                });
              })();
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
                  className="rounded-[var(--bokmoo-radius-lg)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-surface)] p-6 shadow-[var(--bokmoo-shadow)] sm:p-8"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-[11px] font-semibold tracking-[0.16em] text-[var(--bokmoo-copy-soft)]">
                        Item delivery
                      </p>
                      <h2 className="mt-3 text-2xl font-black tracking-[-0.04em] text-[var(--bokmoo-ink)]">
                        {item.productName}
                      </h2>
                      <p className="mt-2 text-sm text-[var(--bokmoo-copy)]">
                        Qty {item.quantity}{item.variantName ? ` · ${item.variantName}` : ''}
                      </p>
                    </div>
                    <span className={cn('rounded-full px-3 py-1 text-[11px] font-semibold tracking-[0.16em]', statusTone(item.fulfillmentStatus || effectiveOrder.status))}>
                      {item.fulfillmentStatus || effectiveOrder.status}
                    </span>
                  </div>

                  {hasContent ? (
                    <div className="mt-6 grid gap-4">
                      {installLike ? (
                        <div className="grid gap-3 md:grid-cols-2">
                          {[
                            ['SM-DP+', installLike.smdpAddress || '—'],
                            ['Matching ID', installLike.matchingId || '—'],
                            ['Activation Code', installLike.activationCode || '—'],
                            ['Confirmation Code', installLike.confirmationCode || '—'],
                          ].map(([label, value]) => (
                            <div key={`${label}-${value}`}>
                              {renderField(
                                label,
                                String(value),
                                value !== '—' ? (
                                  <button
                                    onClick={() => copyToClipboard(String(value))}
                                    className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--bokmoo-primary)]"
                                  >
                                    <Copy className="h-3.5 w-3.5" />
                                    Copy
                                  </button>
                                ) : undefined
                              )}
                            </div>
                          ))}
                        </div>
                      ) : null}

                      {sections.codes.length ? (
                        <div className="grid gap-3 md:grid-cols-2">
                          {sections.codes.map((field) => (
                            <div key={`${item.id}-${field.label}-${field.value}`}>
                              {renderField(
                                field.label,
                                field.value,
                                <button
                                  onClick={() => copyToClipboard(field.value)}
                                  className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--bokmoo-primary)]"
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
                                  className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--bokmoo-primary)]"
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
                                className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--bokmoo-primary)]"
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
                        <div className="rounded-[var(--bokmoo-radius-md)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] p-5">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--bokmoo-copy-soft)]">
                            Notes
                          </p>
                          <div className="mt-3 space-y-2">
                            {sections.notes.map((note) => (
                              <p key={note} className="text-sm leading-6 text-[var(--bokmoo-copy)]">
                                {note}
                              </p>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="mt-6 rounded-[var(--bokmoo-radius-md)] border border-dashed border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] p-5 text-sm leading-6 text-[var(--bokmoo-copy)]">
                      This order is still waiting for fulfillment details. Refresh later or reopen it from the order archive.
                    </div>
                  )}
                </article>
              );
            })}
          </section>

          <aside className="space-y-4">
            <div className="rounded-[var(--bokmoo-radius-lg)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-surface)] p-6 shadow-[var(--bokmoo-shadow)]">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-[1rem] bg-[var(--bokmoo-primary-soft)] text-[var(--bokmoo-primary)]">
                  <PackageCheck className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold tracking-[0.18em] text-[var(--bokmoo-copy-soft)]">
                    Order total
                  </p>
                  <p className="mt-1 text-3xl font-black tracking-[-0.04em] text-[var(--bokmoo-ink)]">
                    ${Number(effectiveOrder.totalAmount || 0).toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="mt-6 space-y-3 text-sm text-[var(--bokmoo-copy)]">
                <div className="flex items-center justify-between">
                  <span>Currency</span>
                  <span className="font-semibold text-[var(--bokmoo-ink)]">{effectiveOrder.currency}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Payment</span>
                  <span className="font-semibold text-[var(--bokmoo-ink)]">{effectiveOrder.paymentStatus}</span>
                </div>
                {effectiveOrder.cancelReason ? (
                  <div className="rounded-[var(--bokmoo-radius-md)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] p-4">
                    <p className="text-[11px] font-semibold tracking-[0.16em] text-[var(--bokmoo-copy-soft)]">
                      Cancel reason
                    </p>
                    <p className="mt-2 text-sm text-[var(--bokmoo-copy)]">{effectiveOrder.cancelReason}</p>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="rounded-[var(--bokmoo-radius-lg)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-surface)] p-6 shadow-[var(--bokmoo-shadow)]">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-[1rem] bg-[var(--bokmoo-primary-soft)] text-[var(--bokmoo-primary)]">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold tracking-[0.18em] text-[var(--bokmoo-copy-soft)]">
                    Access reminder
                  </p>
                  <p className="mt-1 text-sm leading-6 text-[var(--bokmoo-copy)]">
                    Keep a copy of any sensitive credentials in your own password manager or secure notes after claiming the order.
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
