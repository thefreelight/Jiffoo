import React from 'react';
import { ArrowRight, Clock3, Package2, Search, ShieldCheck } from 'lucide-react';
import { cn } from '@jiffoo/ui';
import type { OrdersPageProps } from '../types/theme';
import { getDeliveredArtifactCount } from '../lib/digital-fulfillment';

function getStatusTone(status: string): string {
  const normalized = status.toUpperCase();
  if (normalized === 'DELIVERED' || normalized === 'COMPLETED') return 'bg-[color:color-mix(in_oklab,var(--vault-success)_18%,white)] text-[var(--vault-ink)]';
  if (normalized === 'PENDING' || normalized === 'PAID' || normalized === 'PROCESSING') return 'bg-[color:color-mix(in_oklab,var(--vault-warning)_18%,white)] text-[var(--vault-ink)]';
  if (normalized === 'CANCELLED' || normalized === 'REFUNDED') return 'bg-[color:color-mix(in_oklab,var(--vault-danger)_14%,white)] text-[var(--vault-ink)]';
  return 'bg-[var(--vault-primary-soft)] text-[var(--vault-primary-strong)]';
}

export const OrdersPage = React.memo(function OrdersPage({
  orders,
  isLoading,
  error,
  currentPage,
  totalPages,
  onPageChange,
  onOrderClick,
  onCancelOrder,
}: OrdersPageProps) {
  const [query, setQuery] = React.useState('');
  const [status, setStatus] = React.useState<'all' | string>('all');

  if (isLoading) {
    return <div className="min-h-screen bg-[var(--vault-bg)]" />;
  }

  const filteredOrders = orders.filter((order) => {
    if (status !== 'all' && order.status !== status) return false;
    if (!query.trim()) return true;

    const idNeedle = order.id.toLowerCase();
    const queryNeedle = query.trim().toLowerCase();
    return idNeedle.includes(queryNeedle);
  });

  const pendingCount = orders.filter((order) => ['PENDING', 'PAID', 'PROCESSING'].includes(order.status.toUpperCase())).length;
  const finishedCount = orders.filter((order) => ['DELIVERED', 'COMPLETED'].includes(order.status.toUpperCase())).length;
  const uniqueStatuses = Array.from(new Set(orders.map((order) => order.status)));

  return (
    <div className="min-h-screen bg-[var(--vault-bg)] px-4 pb-16 pt-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1280px]">
        <section className="rounded-[var(--vault-radius-lg)] border border-[var(--vault-line)] bg-[var(--vault-surface)] p-6 shadow-[var(--vault-shadow-soft)] sm:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--vault-line)] bg-[var(--vault-surface-alt)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--vault-copy)]">
                <ShieldCheck className="h-4 w-4 text-[var(--vault-primary)]" />
                Order center
              </div>
              <h1 className="mt-5 text-[clamp(2.1rem,4vw,3.8rem)] font-black leading-[1.02] tracking-[-0.045em] text-[var(--vault-ink)]">
                Review every order without leaving the storefront.
              </h1>
              <p className="mt-3 max-w-[42rem] text-sm leading-7 text-[var(--vault-copy)]">
                The order center keeps payment state, delivery state, and fulfillment artifacts together so buyers do not have to guess where their purchase went.
              </p>
            </div>
            <div className="rounded-xl border border-[var(--vault-line)] bg-[var(--vault-surface-alt)] px-4 py-3 text-sm text-[var(--vault-copy)]">
              {orders.length} orders in view
            </div>
          </div>
        </section>

        <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Matched orders', value: filteredOrders.length },
            { label: 'Current page', value: orders.length },
            { label: 'Pending payment', value: pendingCount },
            { label: 'Finished', value: finishedCount },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-[var(--vault-radius-md)] border border-[var(--vault-line)] bg-[var(--vault-surface)] p-4 shadow-[var(--vault-shadow-soft)]"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--vault-copy-soft)]">
                {item.label}
              </p>
              <p className="mt-2 text-2xl font-black tracking-[-0.04em] text-[var(--vault-ink)]">
                {item.value}
              </p>
            </div>
          ))}
        </section>

        <section className="mt-4 rounded-[var(--vault-radius-lg)] border border-[var(--vault-line)] bg-[var(--vault-surface)] p-5 shadow-[var(--vault-shadow-soft)]">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
            <label className="grid flex-1 gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--vault-copy-soft)]">
                Search by order reference
              </span>
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--vault-copy-soft)]" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search current orders..."
                  className="h-11 w-full rounded-xl border border-[var(--vault-line)] bg-[var(--vault-surface-alt)] pl-11 pr-4 text-sm text-[var(--vault-ink)] outline-none placeholder:text-[var(--vault-copy-soft)]"
                />
              </div>
            </label>

            <label className="grid gap-2 xl:w-56">
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--vault-copy-soft)]">
                Status
              </span>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className="h-11 rounded-xl border border-[var(--vault-line)] bg-[var(--vault-surface-alt)] px-4 text-sm text-[var(--vault-ink)] outline-none"
              >
                <option value="all">All statuses</option>
                {uniqueStatuses.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setQuery('');
                  setStatus('all');
                }}
                className="inline-flex h-11 items-center rounded-xl border border-[var(--vault-line)] bg-[var(--vault-surface-alt)] px-4 text-sm font-medium text-[var(--vault-copy)] transition-colors hover:bg-[var(--vault-primary-soft)] hover:text-[var(--vault-ink)]"
              >
                Reset
              </button>
              <button
                onClick={() => onPageChange(currentPage)}
                className="inline-flex h-11 items-center rounded-xl border border-[var(--vault-line)] bg-[var(--vault-surface-alt)] px-4 text-sm font-medium text-[var(--vault-copy)] transition-colors hover:bg-[var(--vault-primary-soft)] hover:text-[var(--vault-ink)]"
              >
                Refresh
              </button>
            </div>
          </div>
        </section>

        {error ? (
          <div className="mt-6 rounded-[var(--vault-radius-lg)] border border-[var(--vault-line)] bg-[var(--vault-surface)] p-8 text-[var(--vault-copy)] shadow-[var(--vault-shadow-soft)]">
            {error}
          </div>
        ) : null}

        <section className="mt-6 grid gap-4">
          {filteredOrders.length === 0 ? (
            <div className="rounded-[var(--vault-radius-lg)] border border-dashed border-[var(--vault-line)] bg-[var(--vault-surface)] p-16 text-center text-[var(--vault-copy)]">
              No orders matched the current filters.
            </div>
          ) : (
            filteredOrders.map((order) => {
              const artifactCount = order.items.reduce(
                (sum, item) => sum + getDeliveredArtifactCount(item.fulfillmentData),
                0
              );
              const canCancel = ['PENDING', 'PAID'].includes(order.status.toUpperCase());

              return (
                <article
                  key={order.id}
                  className="rounded-[var(--vault-radius-lg)] border border-[var(--vault-line)] bg-[var(--vault-surface)] p-5 shadow-[var(--vault-shadow-soft)]"
                >
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={cn('rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]', getStatusTone(order.status))}>
                          {order.status}
                        </span>
                        <span className="rounded-full border border-[var(--vault-line)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--vault-copy)]">
                          Payment {order.paymentStatus}
                        </span>
                        <span className="rounded-full border border-[var(--vault-line)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--vault-copy)]">
                          {artifactCount} artifact{artifactCount === 1 ? '' : 's'}
                        </span>
                      </div>
                      <h2 className="mt-4 text-2xl font-bold tracking-tight text-[var(--vault-ink)]">
                        Order #{order.id.slice(-8).toUpperCase()}
                      </h2>
                      <div className="mt-3 flex flex-wrap gap-4 text-sm text-[var(--vault-copy)]">
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
                      <div className="rounded-xl border border-[var(--vault-line)] bg-[var(--vault-surface-alt)] px-4 py-3 text-right">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--vault-copy-soft)]">
                          Total
                        </p>
                        <p className="mt-1 text-2xl font-black tracking-[-0.04em] text-[var(--vault-ink)]">
                          ${Number(order.totalAmount || 0).toFixed(2)}
                        </p>
                      </div>
                      <button
                        onClick={() => onOrderClick(order.id)}
                        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--vault-primary)] px-5 text-sm font-semibold text-white transition-colors hover:bg-[var(--vault-primary-strong)]"
                      >
                        View details
                        <ArrowRight className="h-4 w-4" />
                      </button>
                      {canCancel ? (
                        <button
                          onClick={() => onCancelOrder(order.id)}
                          className="inline-flex min-h-12 items-center justify-center rounded-xl border border-[var(--vault-line)] bg-[var(--vault-surface-alt)] px-5 text-sm font-medium text-[var(--vault-copy)] transition-colors hover:bg-[var(--vault-primary-soft)] hover:text-[var(--vault-ink)]"
                        >
                          Cancel
                        </button>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </section>

        {totalPages > 1 ? (
          <div className="mt-8 flex items-center justify-center gap-3">
            <button
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1}
              className="rounded-xl border border-[var(--vault-line)] bg-[var(--vault-surface)] px-5 py-3 text-sm font-medium text-[var(--vault-copy)] disabled:opacity-40"
            >
              Previous
            </button>
            <span className="rounded-xl border border-[var(--vault-line)] bg-[var(--vault-surface)] px-4 py-3 text-sm font-medium text-[var(--vault-copy)]">
              Page {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage >= totalPages}
              className="rounded-xl border border-[var(--vault-line)] bg-[var(--vault-surface)] px-5 py-3 text-sm font-medium text-[var(--vault-copy)] disabled:opacity-40"
            >
              Next
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
});
