'use client';

import { ArrowLeft, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import type { CartPageProps } from 'shared/src/types/theme';

import { StudioBadge, StudioMain, StudioPage, StudioPanel, StudioSectionIntro } from './StudioShell';

function formatMoney(value: number | undefined): string {
  return `$${Number(value || 0).toFixed(2)}`;
}

export function CartPage({
  cart,
  isLoading,
  onUpdateQuantity,
  onRemoveItem,
  onCheckout,
  onContinueShopping,
}: CartPageProps) {
  if (isLoading) {
    return (
      <StudioPage activeNav="explore">
        <StudioMain className="space-y-6">
          <div className="h-40 animate-pulse rounded-[2rem] border border-[color:var(--imagic-line)] bg-[color:var(--imagic-surface)]/70" />
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
            <div className="space-y-4">
              <div className="h-40 animate-pulse rounded-[1.7rem] border border-[color:var(--imagic-line)] bg-[color:var(--imagic-surface)]/70" />
              <div className="h-40 animate-pulse rounded-[1.7rem] border border-[color:var(--imagic-line)] bg-[color:var(--imagic-surface)]/70" />
            </div>
            <div className="h-80 animate-pulse rounded-[1.7rem] border border-[color:var(--imagic-line)] bg-[color:var(--imagic-surface)]/70" />
          </div>
        </StudioMain>
      </StudioPage>
    );
  }

  if (!cart?.items?.length) {
    return (
      <StudioPage activeNav="explore">
        <StudioMain>
          <StudioPanel className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[color:var(--imagic-primary-soft)] text-[color:var(--imagic-primary)]">
              <ShoppingBag className="h-6 w-6" />
            </div>
            <h1 className="mt-5 text-3xl font-semibold tracking-[-0.05em] text-[color:var(--imagic-ink)]">Your cart is empty.</h1>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-[color:var(--imagic-ink-soft)]">
              Add a creator pack, product bundle, or visual asset collection to start your checkout flow.
            </p>
            <button type="button" onClick={onContinueShopping} className="imagic-button-primary mt-6 inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold text-white shadow-[var(--imagic-primary-shadow)]">
              <ArrowLeft className="h-4 w-4" />
              Continue shopping
            </button>
          </StudioPanel>
        </StudioMain>
      </StudioPage>
    );
  }

  return (
    <StudioPage activeNav="explore">
      <StudioMain className="space-y-6">
        <StudioPanel>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <StudioSectionIntro
              eyebrow="Cart"
              title="Review your creator purchases before checkout."
              body="Keep product selection inside the same visual language as the generation workspace. Adjust quantities, remove packs, and move straight into checkout."
            />
            <div className="flex flex-wrap gap-2">
              <StudioBadge>{cart.itemCount} items</StudioBadge>
              <StudioBadge>{formatMoney(cart.total)} total</StudioBadge>
            </div>
          </div>
        </StudioPanel>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
          <div className="space-y-4">
            {cart.items.map((item) => (
              <article key={item.id} className="rounded-[1.7rem] border border-[color:var(--imagic-line)] bg-[color:var(--imagic-surface)]/94 p-5 shadow-[var(--imagic-soft-shadow)]">
                <div className="flex gap-4">
                  <div className="h-24 w-24 overflow-hidden rounded-[1.2rem] border border-[color:var(--imagic-line)] bg-[color:var(--imagic-surface-elevated)]">
                    {item.productImage ? (
                      <img src={item.productImage} alt={item.productName} className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--imagic-muted)]">Creator item</p>
                        <h2 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-[color:var(--imagic-ink)]">{item.productName}</h2>
                        {item.variantName ? <p className="mt-1 text-sm text-[color:var(--imagic-ink-soft)]">{item.variantName}</p> : null}
                        <p className="mt-3 text-lg font-semibold text-[color:var(--imagic-primary)]">{formatMoney(item.price)}</p>
                      </div>
                      <button type="button" onClick={() => void onRemoveItem(item.id)} className="flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--imagic-line)] bg-[color:var(--imagic-surface-elevated)] text-[color:var(--imagic-muted)] transition hover:text-rose-300">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center rounded-full border border-[color:var(--imagic-line)] bg-[color:var(--imagic-surface-elevated)] px-2 py-1">
                        <button type="button" onClick={() => void onUpdateQuantity(item.id, Math.max(1, item.quantity - 1))} className="flex h-9 w-9 items-center justify-center rounded-full text-[color:var(--imagic-ink)]">
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="min-w-[2.5rem] text-center text-base font-semibold text-[color:var(--imagic-ink)]">{item.quantity}</span>
                        <button type="button" onClick={() => void onUpdateQuantity(item.id, Math.min(item.maxQuantity, item.quantity + 1))} className="flex h-9 w-9 items-center justify-center rounded-full text-[color:var(--imagic-ink)]">
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="text-right">
                        <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--imagic-muted)]">Subtotal</p>
                        <p className="mt-1 text-lg font-semibold text-[color:var(--imagic-ink)]">{formatMoney(item.subtotal)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <StudioPanel className="h-fit">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--imagic-muted)]">Order summary</p>
            <div className="mt-4 grid gap-3 text-sm">
              {[
                ['Subtotal', formatMoney(cart.subtotal)],
                ['Tax', formatMoney(cart.tax)],
                ['Shipping', formatMoney(cart.shipping)],
                ['Discount', `-${formatMoney(cart.discount)}`],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between rounded-[1.2rem] border border-[color:var(--imagic-line)] bg-[color:var(--imagic-surface-elevated)] px-4 py-3">
                  <span className="text-[color:var(--imagic-ink-soft)]">{label}</span>
                  <span className="font-medium text-[color:var(--imagic-ink)]">{value}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-[1.2rem] border border-[color:var(--imagic-primary-border)] bg-[color:var(--imagic-primary-soft)]/30 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--imagic-muted)]">Total</p>
              <p className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-[color:var(--imagic-ink)]">{formatMoney(cart.total)}</p>
            </div>
            <button type="button" onClick={onCheckout} className="imagic-button-primary mt-5 flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold text-white shadow-[var(--imagic-primary-shadow)]">
              Proceed to checkout
            </button>
            <button type="button" onClick={onContinueShopping} className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border border-[color:var(--imagic-line)] bg-[color:var(--imagic-surface-elevated)] px-5 py-3 text-sm font-medium text-[color:var(--imagic-ink)] transition hover:-translate-y-0.5">
              <ArrowLeft className="h-4 w-4" />
              Continue shopping
            </button>
          </StudioPanel>
        </div>
      </StudioMain>
    </StudioPage>
  );
}
