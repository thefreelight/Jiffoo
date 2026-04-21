import React from 'react';
import { AlertCircle, ArrowLeft, Package2, ShieldCheck } from 'lucide-react';
import type { OrderDetailPageProps } from 'shared/src/types/theme';
import { formatDateTime, formatMoneyPrecise, formatOrderId, getStatusClasses, humanizeStatus, summarizeAddress } from '../commerce';

export const OrderDetailPage = React.memo(function OrderDetailPage({
  order,
  isLoading,
  onBack,
  onBackToOrders,
  onCancelOrder,
}: OrderDetailPageProps) {
  const handleBack = onBack || onBackToOrders;

  if (isLoading) {
    return <div className="modelsfind-shell min-h-screen" />;
  }

  if (!order) {
    return (
      <div className="modelsfind-shell flex min-h-screen items-center justify-center px-4 [font-family:var(--modelsfind-body)] text-[var(--modelsfind-ink)]">
        <div className="modelsfind-panel max-w-[36rem] rounded-[2rem] border border-[var(--modelsfind-line)] p-8 text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-red-300" />
          <h1 className="mt-5 [font-family:var(--modelsfind-display)] text-[2.6rem] leading-none tracking-[-0.04em] text-white">
            Order not found
          </h1>
          {handleBack ? (
            <button
              type="button"
              onClick={handleBack}
              className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-full border border-[var(--modelsfind-line)] px-6 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--modelsfind-ink)]"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to orders
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="modelsfind-shell min-h-screen px-4 pb-32 pt-20 [font-family:var(--modelsfind-body)] text-[var(--modelsfind-ink)]">
      <div className="mx-auto max-w-[1280px]">
        {handleBack ? (
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--modelsfind-copy)]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to orders
          </button>
        ) : null}

        <div className="mt-4 grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="modelsfind-frame overflow-hidden rounded-[2rem] border border-[var(--modelsfind-line-strong)] p-4 md:p-6 xl:p-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.24em] text-[var(--modelsfind-primary)]">
                  Order #{formatOrderId(order.id)}
                </p>
                <h1 className="mt-3 [font-family:var(--modelsfind-display)] text-[2.6rem] leading-none tracking-[-0.04em] text-white">
                  {formatMoneyPrecise(order.totalAmount, order.currency)}
                </h1>
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

            <section className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.72fr)]">
              <div className="grid gap-4">
                {order.items.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-[1.4rem] border border-[var(--modelsfind-line)] bg-[rgba(17,14,20,0.92)] p-5"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-white">{item.productName}</p>
                        <p className="mt-2 text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]">
                          Qty {item.quantity}
                          {item.variantName ? ` • ${item.variantName}` : ''}
                        </p>
                      </div>
                      <p className="text-sm text-[var(--modelsfind-copy)]">
                        {formatMoneyPrecise(item.totalPrice, order.currency)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <aside className="modelsfind-panel rounded-[1.6rem] border border-[var(--modelsfind-line)] p-5">
                <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-[var(--modelsfind-primary)]">
                  <Package2 className="h-4 w-4" />
                  Details
                </div>
                <div className="mt-5 grid gap-3 text-sm">
                  <div className="rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.04)] px-4 py-3">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]">Payment</p>
                    <p className="mt-2 text-white">{humanizeStatus(order.paymentStatus)}</p>
                  </div>
                  <div className="rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.04)] px-4 py-3">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]">Address</p>
                    <p className="mt-2 text-[var(--modelsfind-copy)]">{summarizeAddress(order.shippingAddress)}</p>
                  </div>
                  {order.cancelReason ? (
                    <div className="rounded-[1rem] border border-red-500/20 bg-red-500/5 px-4 py-3">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-red-200">Cancellation note</p>
                      <p className="mt-2 text-red-100">{order.cancelReason}</p>
                    </div>
                  ) : null}
                </div>

                {order.status.toLowerCase() === 'pending' && onCancelOrder ? (
                  <button
                    type="button"
                    onClick={() => void onCancelOrder()}
                    className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-full border border-red-500/20 bg-red-500/5 px-5 text-[10px] font-semibold uppercase tracking-[0.18em] text-red-200"
                  >
                    Cancel order
                  </button>
                ) : null}
              </aside>
            </section>
          </div>

          <aside className="modelsfind-panel rounded-[1.6rem] border border-[var(--modelsfind-line)] p-5">
            <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-[var(--modelsfind-primary)]">
              <ShieldCheck className="h-4 w-4" />
              Timeline
            </div>
            <div className="mt-5 grid gap-4">
              {[
                `Order placed • ${formatDateTime(order.createdAt)}`,
                `Payment status • ${humanizeStatus(order.paymentStatus)}`,
                `Latest update • ${formatDateTime(order.updatedAt)}`,
              ].map((line) => (
                <div
                  key={line}
                  className="rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.04)] px-4 py-3 text-sm text-[var(--modelsfind-copy)]"
                >
                  {line}
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
});

