'use client';

import { ArrowRight, Package2 } from 'lucide-react';
import type { OrdersPageProps } from 'shared/src/types/theme';

import { StudioBadge, StudioMain, StudioPage, StudioPanel, StudioSectionIntro } from './StudioShell';

function statusTone(status: string) {
  const value = status.toUpperCase();
  if (value === 'COMPLETED' || value === 'DELIVERED' || value === 'PAID') return 'text-emerald-300 bg-emerald-400/10 border-emerald-400/20';
  if (value === 'PENDING' || value === 'PROCESSING') return 'text-[color:var(--imagic-primary)] bg-[color:var(--imagic-primary-soft)]/30 border-[color:var(--imagic-primary-border)]';
  if (value === 'CANCELLED' || value === 'REFUNDED') return 'text-rose-300 bg-rose-400/10 border-rose-400/20';
  return 'text-[color:var(--imagic-ink-soft)] bg-[color:var(--imagic-surface-elevated)] border-[color:var(--imagic-line)]';
}

export function OrdersPage({ orders, isLoading, currentPage, totalPages, onPageChange, onOrderClick, onCancelOrder }: OrdersPageProps) {
  if (isLoading) {
    return (
      <StudioPage activeNav="history">
        <StudioMain className="space-y-4">
          <div className="h-40 animate-pulse rounded-[2rem] border border-[color:var(--imagic-line)] bg-[color:var(--imagic-surface)]/70" />
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-36 animate-pulse rounded-[1.7rem] border border-[color:var(--imagic-line)] bg-[color:var(--imagic-surface)]/70" />
          ))}
        </StudioMain>
      </StudioPage>
    );
  }

  if (!orders?.length) {
    return (
      <StudioPage activeNav="history">
        <StudioMain>
          <StudioPanel className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[color:var(--imagic-primary-soft)] text-[color:var(--imagic-primary)]">
              <Package2 className="h-6 w-6" />
            </div>
            <h1 className="mt-5 text-3xl font-semibold tracking-[-0.05em] text-[color:var(--imagic-ink)]">No orders yet.</h1>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-[color:var(--imagic-ink-soft)]">Once you purchase creator packs or visual products, they will appear here with status tracking.</p>
          </StudioPanel>
        </StudioMain>
      </StudioPage>
    );
  }

  return (
    <StudioPage activeNav="history">
      <StudioMain className="space-y-6">
        <StudioPanel>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <StudioSectionIntro
              eyebrow="Orders"
              title="Track creator purchases, delivery state, and completed checkouts."
              body="Orders stay in the same cockpit language as the rest of the theme, so the jump from generation to commerce still feels connected."
            />
            <div className="flex flex-wrap gap-2">
              <StudioBadge>{orders.length} orders</StudioBadge>
              <StudioBadge>Page {currentPage} of {totalPages}</StudioBadge>
            </div>
          </div>
        </StudioPanel>

        <div className="space-y-4">
          {orders.map((order) => (
            <article key={order.id} className="rounded-[1.7rem] border border-[color:var(--imagic-line)] bg-[color:var(--imagic-surface)]/94 p-5 shadow-[var(--imagic-soft-shadow)]">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <StudioBadge>{order.id.slice(0, 8)}</StudioBadge>
                    <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] ${statusTone(order.status)}`}>{order.status}</span>
                  </div>
                  <h2 className="mt-4 text-2xl font-semibold tracking-[-0.05em] text-[color:var(--imagic-ink)]">{order.items?.[0]?.productName || 'Creator order'}</h2>
                  <p className="mt-2 text-sm leading-7 text-[color:var(--imagic-ink-soft)]">Placed on {new Date(order.createdAt).toLocaleDateString()} with {order.items?.length || 0} item(s).</p>
                </div>
                <div className="text-left lg:text-right">
                  <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--imagic-muted)]">Total</p>
                  <p className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-[color:var(--imagic-ink)]">${Number(order.totalAmount).toFixed(2)}</p>
                  <p className="mt-2 text-sm text-[color:var(--imagic-ink-soft)]">Payment: {order.paymentStatus}</p>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <button type="button" onClick={() => onOrderClick(order.id)} className="inline-flex items-center gap-2 rounded-full border border-[color:var(--imagic-line)] bg-[color:var(--imagic-surface-elevated)] px-4 py-2 text-sm text-[color:var(--imagic-ink)] transition hover:-translate-y-0.5">
                  View order
                  <ArrowRight className="h-4 w-4" />
                </button>
                {order.status !== 'CANCELLED' ? (
                  <button type="button" onClick={() => void onCancelOrder(order.id)} className="inline-flex items-center gap-2 rounded-full border border-rose-400/20 bg-rose-400/10 px-4 py-2 text-sm text-rose-200 transition hover:-translate-y-0.5">
                    Cancel order
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>

        {totalPages > 1 ? (
          <div className="flex items-center justify-center gap-3">
            <button type="button" onClick={() => onPageChange(Math.max(1, currentPage - 1))} disabled={currentPage <= 1} className="rounded-full border border-[color:var(--imagic-line)] bg-[color:var(--imagic-surface-elevated)] px-4 py-2 text-sm text-[color:var(--imagic-ink)] disabled:opacity-40">
              Previous
            </button>
            <button type="button" onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))} disabled={currentPage >= totalPages} className="rounded-full border border-[color:var(--imagic-line)] bg-[color:var(--imagic-surface-elevated)] px-4 py-2 text-sm text-[color:var(--imagic-ink)] disabled:opacity-40">
              Next
            </button>
          </div>
        ) : null}
      </StudioMain>
    </StudioPage>
  );
}
