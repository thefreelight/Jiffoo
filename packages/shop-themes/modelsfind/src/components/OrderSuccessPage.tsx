import React from 'react';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import type { OrderSuccessPageProps } from 'shared/src/types/theme';
import { formatDateTime, formatMoneyPrecise } from '../commerce';
import { findPreviewPortraitByName, previewPortraits } from '../site';

export const OrderSuccessPage = React.memo(function OrderSuccessPage({
  orderNumber,
  order,
  onContinueShopping,
  onViewOrders,
}: OrderSuccessPageProps) {
  const leadItem = order?.items?.[0];
  const leadPortrait = findPreviewPortraitByName(leadItem?.productName) || previewPortraits[0];
  const reservationDate = order ? formatDateTime(order.createdAt) : 'October 24, 2026';

  return (
    <div className="modelsfind-shell min-h-screen px-4 py-12 [font-family:var(--modelsfind-body)] text-[var(--modelsfind-ink)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1180px]">
        <div className="modelsfind-frame overflow-hidden rounded-[2rem] border border-[var(--modelsfind-line-strong)] bg-[rgba(10,8,12,0.96)] p-4 md:p-6 xl:p-8">
          <section className="relative overflow-hidden rounded-[1.8rem] border border-[var(--modelsfind-line)] bg-[linear-gradient(180deg,rgba(10,8,12,0.92),rgba(8,7,10,0.98))]">
            <img
              src={leadPortrait.image}
              alt={leadItem?.productName || leadPortrait.name}
              className="absolute inset-0 h-full w-full object-cover grayscale opacity-20"
            />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_34%),linear-gradient(180deg,rgba(10,8,12,0.46),rgba(10,8,12,0.96))]" />

            <div className="relative z-10 px-6 py-10 md:px-10 md:py-14">
              <p className="text-center text-[10px] uppercase tracking-[0.3em] text-[var(--modelsfind-primary)]">ModelsFind</p>
              <div className="mx-auto mt-8 max-w-[38rem] text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/14 text-emerald-200">
                  <CheckCircle2 className="h-7 w-7" />
                </div>
                <h1 className="mt-6 [font-family:var(--modelsfind-display)] text-[clamp(3rem,7vw,5.3rem)] leading-[0.9] tracking-[-0.05em] text-white">
                  Booking Confirmed
                </h1>
                <p className="mt-4 text-sm leading-7 text-[var(--modelsfind-copy)]">
                  Your reservation has been secured and the concierge timeline is now active for private follow-through.
                </p>
              </div>

              <div className="mx-auto mt-10 grid max-w-[48rem] gap-5 md:grid-cols-[15rem_minmax(0,1fr)]">
                <div className="overflow-hidden rounded-[1.25rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)]">
                  <img
                    src={leadPortrait.image}
                    alt={leadItem?.productName || leadPortrait.name}
                    className="h-full min-h-[14rem] w-full object-cover grayscale"
                  />
                </div>

                <div className="rounded-[1.25rem] border border-[var(--modelsfind-line)] bg-[rgba(16,13,18,0.92)] p-5 text-left">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]">Reservation summary</p>
                  <h2 className="mt-3 [font-family:var(--modelsfind-display)] text-[2rem] leading-none text-white">
                    {leadItem?.productName || leadPortrait.name}
                  </h2>
                  <div className="mt-5 grid gap-3 text-sm text-[var(--modelsfind-copy)]">
                    <div className="flex justify-between gap-4">
                      <span>Date</span>
                      <span className="text-white">{reservationDate}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span>Experience</span>
                      <span className="text-white">{leadItem?.variantName || leadPortrait.mood}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span>Reference</span>
                      <span className="text-white">{orderNumber}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span>Total</span>
                      <span className="text-[var(--modelsfind-primary)]">
                        {formatMoneyPrecise(order?.totalAmount || leadItem?.totalPrice || 0, order?.currency || 'USD')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={onContinueShopping}
                  className="inline-flex min-h-12 items-center justify-center rounded-full bg-[linear-gradient(145deg,color-mix(in_oklab,var(--modelsfind-primary)_82%,white),color-mix(in_oklab,var(--modelsfind-primary)_72%,black))] px-6 text-[11px] font-semibold uppercase tracking-[0.22em] text-white"
                >
                  Continue exploring
                </button>
                <button
                  type="button"
                  onClick={onViewOrders}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-6 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--modelsfind-ink)]"
                >
                  View reservations
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
});
