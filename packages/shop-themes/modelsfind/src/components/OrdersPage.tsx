import React from 'react';
import { AlertCircle, ArrowLeft, Package2 } from 'lucide-react';
import type { OrdersPageProps } from 'shared/src/types/theme';
import { formatDateTime, formatMoneyPrecise, formatOrderId, getStatusClasses, humanizeStatus } from '../commerce';

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
    return <div className="modelsfind-shell min-h-screen" />;
  }

  return (
    <div className="modelsfind-shell min-h-screen px-4 pb-32 pt-20 [font-family:var(--modelsfind-body)] text-[var(--modelsfind-ink)]">
      <div className="mx-auto max-w-[1280px]">
        <div className="flex items-center gap-4">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] text-[var(--modelsfind-copy)]">
            <Package2 className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.24em] text-[var(--modelsfind-primary)]">Order history</p>
            <h1 className="[font-family:var(--modelsfind-display)] text-[2.3rem] leading-none tracking-[-0.04em] text-white">
              Private bookings
            </h1>
          </div>
        </div>
        {error ? (
          <div className="mt-6 rounded-[1.4rem] border border-red-500/20 bg-red-500/5 px-5 py-4 text-sm text-red-200">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-4 w-4" />
              <span>{error}</span>
            </div>
          </div>
        ) : null}
        {orders.length === 0 ? (
          <div className="modelsfind-panel mt-6 rounded-[2rem] border border-[var(--modelsfind-line)] p-10 text-center">
            <h2 className="[font-family:var(--modelsfind-display)] text-[2.6rem] leading-none tracking-[-0.04em] text-white">
              No bookings yet
            </h2>
            <p className="mx-auto mt-4 max-w-[28rem] text-sm leading-7 text-[var(--modelsfind-copy)]">
              Once bookings are placed, this page should read like a polished private ledger rather than an admin table.
            </p>
          </div>
        ) : (
          <div className="mt-6 grid gap-4">
            {orders.map((order) => (
              <article
                key={order.id}
                className="rounded-[1.6rem] border border-[var(--modelsfind-line)] bg-[rgba(17,14,20,0.92)] p-5"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]">
                      Order #{formatOrderId(order.id)}
                    </p>
                    <h2 className="mt-2 [font-family:var(--modelsfind-display)] text-[2rem] leading-none tracking-[-0.04em] text-white">
                      {formatMoneyPrecise(order.totalAmount, order.currency)}
                    </h2>
                    <p className="mt-3 text-sm leading-6 text-[var(--modelsfind-copy)]">
                      Placed {formatDateTime(order.createdAt)}
                    </p>
                  </div>
                  <span
                    className={[
                      'inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]',
                      getStatusClasses(order.status),
                    ].join(' ')}
                  >
                    {humanizeStatus(order.status)}
                  </span>
                </div>
                <div className="mt-5 grid gap-3">
                  {order.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-4 py-3"
                    >
                      <div>
                        <p className="text-sm font-semibold text-white">{item.productName}</p>
                        <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]">
                          Qty {item.quantity}
                        </p>
                      </div>
                      <p className="text-sm text-[var(--modelsfind-copy)]">
                        {formatMoneyPrecise(item.totalPrice, order.currency)}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
                  {order.status.toLowerCase() === 'pending' ? (
                    <button
                      type="button"
                      onClick={() => void onCancelOrder(order.id)}
                      className="inline-flex min-h-11 items-center justify-center rounded-full border border-red-500/20 bg-red-500/5 px-5 text-[10px] font-semibold uppercase tracking-[0.18em] text-red-200"
                    >
                      Cancel
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => onOrderClick(order.id)}
                    className="inline-flex min-h-11 items-center justify-center rounded-full border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.04)] px-5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--modelsfind-ink)]"
                  >
                    View details
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
        {totalPages > 1 ? (
          <div className="mt-8 flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="inline-flex min-h-10 items-center justify-center rounded-full border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-4 text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy)] disabled:opacity-40"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <span className="px-4 text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]">
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="inline-flex min-h-10 items-center justify-center rounded-full border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-4 text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy)] disabled:opacity-40"
            >
              <ArrowLeft className="h-4 w-4 rotate-180" />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
});

