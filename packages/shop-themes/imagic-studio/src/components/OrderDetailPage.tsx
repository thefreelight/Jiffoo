'use client';

import { ArrowLeft, FileText } from 'lucide-react';
import type { OrderDetailPageProps } from 'shared/src/types/theme';

import { StudioBadge, StudioMain, StudioPage, StudioPanel } from './StudioShell';

export function OrderDetailPage({ order, isLoading, onBack, onBackToOrders, onCancelOrder }: OrderDetailPageProps) {
  if (isLoading) {
    return (
      <StudioPage activeNav="history">
        <StudioMain className="space-y-6">
          <div className="h-12 w-40 animate-pulse rounded-full border border-[color:var(--imagic-line)] bg-[color:var(--imagic-surface)]/70" />
          <div className="h-[520px] animate-pulse rounded-[2rem] border border-[color:var(--imagic-line)] bg-[color:var(--imagic-surface)]/70" />
        </StudioMain>
      </StudioPage>
    );
  }

  if (!order) {
    return (
      <StudioPage activeNav="history">
        <StudioMain>
          <StudioPanel className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[color:var(--imagic-primary-soft)] text-[color:var(--imagic-primary)]">
              <FileText className="h-6 w-6" />
            </div>
            <h1 className="mt-5 text-3xl font-semibold tracking-[-0.05em] text-[color:var(--imagic-ink)]">Order not found.</h1>
            <button type="button" onClick={onBackToOrders || onBack} className="imagic-button-primary mt-6 inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold text-white shadow-[var(--imagic-primary-shadow)]">
              Back to orders
            </button>
          </StudioPanel>
        </StudioMain>
      </StudioPage>
    );
  }

  return (
    <StudioPage activeNav="history">
      <StudioMain className="space-y-6">
        <button type="button" onClick={onBackToOrders || onBack} className="inline-flex items-center gap-2 rounded-full border border-[color:var(--imagic-line)] bg-[color:var(--imagic-surface-elevated)] px-4 py-2 text-sm text-[color:var(--imagic-ink)] transition hover:-translate-y-0.5">
          <ArrowLeft className="h-4 w-4" />
          Back to orders
        </button>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <StudioPanel>
            <div className="flex flex-wrap gap-2">
              <StudioBadge>{order.id.slice(0, 8)}</StudioBadge>
              <StudioBadge>{order.status}</StudioBadge>
              <StudioBadge>{order.paymentStatus}</StudioBadge>
            </div>
            <h1 className="mt-5 text-[clamp(2.4rem,4vw,4.6rem)] font-semibold tracking-[-0.06em] text-[color:var(--imagic-ink)]">Order detail</h1>
            <p className="mt-3 text-base leading-8 text-[color:var(--imagic-ink-soft)]">Placed on {new Date(order.createdAt).toLocaleDateString()} with {order.items?.length || 0} item(s) in the creator catalog.</p>

            <div className="mt-8 space-y-4">
              {order.items?.map((item) => (
                <div key={item.id} className="rounded-[1.3rem] border border-[color:var(--imagic-line)] bg-[color:var(--imagic-surface-elevated)] px-4 py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-lg font-semibold text-[color:var(--imagic-ink)]">{item.productName}</p>
                      {item.variantName ? <p className="mt-1 text-sm text-[color:var(--imagic-ink-soft)]">{item.variantName}</p> : null}
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-[color:var(--imagic-ink-soft)]">x{item.quantity}</p>
                      <p className="mt-1 text-lg font-semibold text-[color:var(--imagic-primary)]">${Number(item.totalPrice).toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </StudioPanel>

          <StudioPanel className="h-fit">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--imagic-muted)]">Order summary</p>
            <div className="mt-4 grid gap-3 text-sm">
              {[
                ['Status', order.status],
                ['Payment', order.paymentStatus],
                ['Currency', order.currency],
                ['Total', `$${Number(order.totalAmount).toFixed(2)}`],
              ].map(([label, value]) => (
                <div key={String(label)} className="flex items-center justify-between rounded-[1.2rem] border border-[color:var(--imagic-line)] bg-[color:var(--imagic-surface-elevated)] px-4 py-3">
                  <span className="text-[color:var(--imagic-ink-soft)]">{label}</span>
                  <span className="font-medium text-[color:var(--imagic-ink)]">{value}</span>
                </div>
              ))}
            </div>
            {onCancelOrder && order.status !== 'CANCELLED' ? (
              <button type="button" onClick={() => void onCancelOrder()} className="mt-5 flex w-full items-center justify-center gap-2 rounded-full border border-rose-400/20 bg-rose-400/10 px-5 py-3 text-sm font-medium text-rose-200 transition hover:-translate-y-0.5">
                Cancel order
              </button>
            ) : null}
          </StudioPanel>
        </div>
      </StudioMain>
    </StudioPage>
  );
}
