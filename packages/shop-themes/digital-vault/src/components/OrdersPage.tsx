import React from 'react';
import { ArrowRight, Clock3, Package2, ShieldCheck } from 'lucide-react';
import { cn } from '@jiffoo/ui';
import type { OrdersPageProps } from 'shared/src/types/theme';
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
  if (isLoading) {
    return <div className="min-h-screen bg-[var(--vault-bg)]" />;
  }

  return (
    <div className="min-h-screen bg-[var(--vault-bg)] px-4 pb-16 pt-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1280px]">
        <section className="rounded-[var(--vault-radius-lg)] border border-[var(--vault-line)] bg-[var(--vault-surface)] p-6 shadow-[var(--vault-shadow)] sm:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--vault-line)] bg-[var(--vault-bg)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--vault-copy)]">
                <ShieldCheck className="h-4 w-4 text-[var(--vault-primary)]" />
                Access locker
              </div>
              <h1 className="mt-5 text-[clamp(2.2rem,5vw,4.2rem)] font-black leading-[0.94] tracking-[-0.05em] text-[var(--vault-ink)]">
                Every purchase stays readable after checkout.
              </h1>
            </div>
            <div className="rounded-[var(--vault-radius-md)] border border-[var(--vault-line)] bg-[var(--vault-bg)] px-4 py-3 text-sm text-[var(--vault-copy)]">
              Order archive contains status, delivered artifacts, and fallback notes.
            </div>
          </div>
        </section>

        {error ? (
          <div className="mt-6 rounded-[var(--vault-radius-lg)] border border-[var(--vault-line)] bg-[var(--vault-surface)] p-8 text-[var(--vault-copy)] shadow-[var(--vault-shadow)]">
            {error}
          </div>
        ) : null}

        <section className="mt-6 grid gap-4">
          {orders.length === 0 ? (
            <div className="rounded-[var(--vault-radius-lg)] border border-dashed border-[var(--vault-line)] bg-[var(--vault-surface)] p-16 text-center text-[var(--vault-copy)]">
              No orders in the vault yet.
            </div>
          ) : (
            orders.map((order) => {
              const artifactCount = order.items.reduce(
                (sum, item) => sum + getDeliveredArtifactCount(item.fulfillmentData),
                0
              );
              const canCancel = ['PENDING', 'PAID'].includes(order.status.toUpperCase());
              return (
                <article
                  key={order.id}
                  className="rounded-[var(--vault-radius-lg)] border border-[var(--vault-line)] bg-[var(--vault-surface)] p-5 shadow-[var(--vault-shadow)]"
                >
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={cn('rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]', getStatusTone(order.status))}>
                          {order.status}
                        </span>
                        <span className="rounded-full border border-[var(--vault-line)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--vault-copy)]">
                          {artifactCount} delivered artifact{artifactCount === 1 ? '' : 's'}
                        </span>
                      </div>
                      <h2 className="mt-4 text-2xl font-black tracking-[-0.04em] text-[var(--vault-ink)]">
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
                      <div className="rounded-[var(--vault-radius-md)] border border-[var(--vault-line)] bg-[var(--vault-bg)] px-4 py-3 text-right">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--vault-copy-soft)]">
                          Total
                        </p>
                        <p className="mt-1 text-2xl font-black tracking-[-0.04em] text-[var(--vault-ink)]">
                          ${Number(order.totalAmount || 0).toFixed(2)}
                        </p>
                      </div>
                      <button
                        onClick={() => onOrderClick(order.id)}
                        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[var(--vault-primary)] px-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white"
                      >
                        Open order
                        <ArrowRight className="h-4 w-4" />
                      </button>
                      {canCancel ? (
                        <button
                          onClick={() => onCancelOrder(order.id)}
                          className="inline-flex min-h-12 items-center justify-center rounded-full border border-[var(--vault-line)] bg-[var(--vault-surface)] px-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--vault-copy)]"
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
          <div className="mt-10 flex items-center justify-center gap-3">
            <button
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1}
              className="rounded-full border border-[var(--vault-line)] bg-[var(--vault-surface)] px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--vault-copy)] disabled:opacity-40"
            >
              Previous
            </button>
            <span className="rounded-full border border-[var(--vault-line)] bg-[var(--vault-surface)] px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--vault-copy)]">
              Page {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage >= totalPages}
              className="rounded-full border border-[var(--vault-line)] bg-[var(--vault-surface)] px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--vault-copy)] disabled:opacity-40"
            >
              Next
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
});
