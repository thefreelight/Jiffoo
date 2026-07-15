import React from 'react';
import { ArrowRight, Clock3, Package2, ShieldCheck } from 'lucide-react';
import { cn } from '@jiffoo/ui';
import type { OrdersPageProps } from 'shared/src/types/theme';
import { getBokmooOrders, mapBokmooApiOrderToThemeOrder } from '../lib/api';
import { getDeliveredArtifactCount } from '../lib/digital-fulfillment';
import { resolveBokmooSiteConfig } from '../site';

function getStatusTone(status: string): string {
  const normalized = status.toUpperCase();
  if (normalized === 'DELIVERED' || normalized === 'COMPLETED') return 'bg-[color:color-mix(in_oklab,var(--bokmoo-success)_18%,white)] text-[var(--bokmoo-ink)]';
  if (normalized === 'PENDING' || normalized === 'PAID' || normalized === 'PROCESSING') return 'bg-[color:color-mix(in_oklab,var(--bokmoo-warning)_18%,white)] text-[var(--bokmoo-ink)]';
  if (normalized === 'CANCELLED' || normalized === 'REFUNDED') return 'bg-[color:color-mix(in_oklab,var(--bokmoo-danger)_14%,white)] text-[var(--bokmoo-ink)]';
  return 'bg-[var(--bokmoo-primary-soft)] text-[var(--bokmoo-primary-strong)]';
}

export const OrdersPage = React.memo(function OrdersPage({
  orders,
  isLoading,
  error,
  currentPage,
  totalPages,
  config,
  onPageChange,
  onOrderClick,
  onCancelOrder,
}: OrdersPageProps) {
  const site = resolveBokmooSiteConfig(config);
  const [remoteOrders, setRemoteOrders] = React.useState<OrdersPageProps['orders']>([]);
  const [remoteTotalPages, setRemoteTotalPages] = React.useState(1);
  const [remoteLoading, setRemoteLoading] = React.useState(false);
  const [remoteError, setRemoteError] = React.useState('');

  React.useEffect(() => {
    if (orders.length > 0) return;

    let cancelled = false;
    setRemoteLoading(true);
    setRemoteError('');

    void getBokmooOrders(
      {
        baseUrl: site.apiBaseUrl,
      },
      {
        page: currentPage || 1,
        limit: 10,
      }
    )
      .then((response) => {
        if (cancelled) return;
        setRemoteOrders(response.items.map(mapBokmooApiOrderToThemeOrder));
        setRemoteTotalPages(Math.max(1, Math.ceil(Number(response.total || response.items.length || 0) / 10)));
      })
      .catch((loadError) => {
        if (cancelled) return;
        const message = loadError instanceof Error ? loadError.message : 'Unable to load orders.';
        setRemoteError(message);
        setRemoteOrders([]);
        setRemoteTotalPages(1);
      })
      .finally(() => {
        if (!cancelled) {
          setRemoteLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [currentPage, orders.length, site.apiBaseUrl]);

  const effectiveOrders = remoteOrders.length > 0 ? remoteOrders : orders;
  const displayError = error || remoteError;
  const displayTotalPages = remoteOrders.length > 0 ? remoteTotalPages : totalPages;

  if (isLoading || (remoteLoading && effectiveOrders.length === 0)) {
    return <div className="min-h-screen bg-[var(--bokmoo-bg)]" />;
  }

  return (
    <div className="min-h-screen bg-[var(--bokmoo-bg)] px-4 pb-16 pt-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1280px]">
        <section className="rounded-[var(--bokmoo-radius-lg)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-surface)] p-6 shadow-[var(--bokmoo-shadow)] sm:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] px-4 py-2 text-[11px] font-semibold tracking-[0.18em] text-[var(--bokmoo-copy)]">
                <ShieldCheck className="h-4 w-4 text-[var(--bokmoo-primary)]" />
                Order archive
              </div>
              <h1 className="mt-5 text-[clamp(2.2rem,5vw,4.2rem)] font-black leading-[0.94] tracking-[-0.05em] text-[var(--bokmoo-ink)]">
                Every purchase stays readable after checkout.
              </h1>
            </div>
            <div className="rounded-[var(--bokmoo-radius-md)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] px-4 py-3 text-sm text-[var(--bokmoo-copy)]">
              Keep status, delivery details, and activation notes visible after checkout.
            </div>
          </div>
        </section>

        {displayError ? (
          <div className="mt-6 rounded-[var(--bokmoo-radius-lg)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-surface)] p-8 text-[var(--bokmoo-copy)] shadow-[var(--bokmoo-shadow)]">
            {displayError}
          </div>
        ) : null}

        <section className="mt-6 grid gap-4">
          {effectiveOrders.length === 0 ? (
            <div className="rounded-[var(--bokmoo-radius-lg)] border border-dashed border-[var(--bokmoo-line)] bg-[var(--bokmoo-surface)] p-16 text-center text-[var(--bokmoo-copy)]">
              No travel orders yet.
            </div>
          ) : (
            effectiveOrders.map((order) => {
              const artifactCount = order.items.reduce(
                (sum, item) => sum + getDeliveredArtifactCount(item.fulfillmentData),
                0
              );
              const canCancel = Boolean(onCancelOrder) && ['PENDING', 'PAID'].includes(order.status.toUpperCase());
              return (
                <article
                  key={order.id}
                  className="rounded-[var(--bokmoo-radius-lg)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-surface)] p-5 shadow-[var(--bokmoo-shadow)]"
                >
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={cn('rounded-full px-3 py-1 text-[11px] font-semibold tracking-[0.16em]', getStatusTone(order.status))}>
                          {order.status}
                        </span>
                        <span className="rounded-full border border-[var(--bokmoo-line)] px-3 py-1 text-[11px] font-semibold tracking-[0.16em] text-[var(--bokmoo-copy)]">
                          {artifactCount} delivered item{artifactCount === 1 ? '' : 's'}
                        </span>
                      </div>
                      <h2 className="mt-4 text-2xl font-black tracking-[-0.04em] text-[var(--bokmoo-ink)]">
                        Order #{order.id.slice(-8).toUpperCase()}
                      </h2>
                      <div className="mt-3 flex flex-wrap gap-4 text-sm text-[var(--bokmoo-copy)]">
                        <span className="inline-flex items-center gap-2">
                          <Clock3 className="h-4 w-4" />
                          {new Date(order.createdAt).toLocaleString()}
                        </span>
                        <span className="inline-flex items-center gap-2">
                          <Package2 className="h-4 w-4" />
                          {order.items.length} item{order.items.length === 1 ? '' : 's'}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <div className="rounded-[var(--bokmoo-radius-md)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] px-4 py-3 text-right">
                        <p className="text-[11px] font-semibold tracking-[0.16em] text-[var(--bokmoo-copy-soft)]">
                          Total
                        </p>
                        <p className="mt-1 text-2xl font-black tracking-[-0.04em] text-[var(--bokmoo-ink)]">
                          ${Number(order.totalAmount || 0).toFixed(2)}
                        </p>
                      </div>
                      <button
                        onClick={() => onOrderClick(order.id)}
                        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[var(--bokmoo-primary)] px-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white"
                      >
                        Open order
                        <ArrowRight className="h-4 w-4" />
                      </button>
                      {canCancel ? (
                        <button
                          onClick={() => onCancelOrder(order.id)}
                          className="inline-flex min-h-12 items-center justify-center rounded-full border border-[var(--bokmoo-line)] bg-[var(--bokmoo-surface)] px-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-copy)]"
                        >
                          Cancel order
                        </button>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </section>

        {displayTotalPages > 1 ? (
          <div className="mt-10 flex items-center justify-center gap-3">
            <button
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1}
              className="rounded-full border border-[var(--bokmoo-line)] bg-[var(--bokmoo-surface)] px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-copy)] disabled:opacity-40"
            >
              Previous
            </button>
            <span className="rounded-full border border-[var(--bokmoo-line)] bg-[var(--bokmoo-surface)] px-5 py-3 text-[11px] font-semibold tracking-[0.18em] text-[var(--bokmoo-copy)]">
              Page {currentPage} / {displayTotalPages}
            </span>
            <button
              onClick={() => onPageChange(Math.min(displayTotalPages, currentPage + 1))}
              disabled={currentPage >= displayTotalPages}
              className="rounded-full border border-[var(--bokmoo-line)] bg-[var(--bokmoo-surface)] px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-copy)] disabled:opacity-40"
            >
              Next
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
});
