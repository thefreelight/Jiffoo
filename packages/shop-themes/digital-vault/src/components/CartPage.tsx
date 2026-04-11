import React from 'react';
import { Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import type { CartPageProps } from '../types/theme';

export const CartPage = React.memo(function CartPage({
  cart,
  isLoading,
  onUpdateQuantity,
  onRemoveItem,
  onCheckout,
  onContinueShopping,
}: CartPageProps) {
  if (isLoading) {
    return <div className="min-h-screen bg-[var(--vault-bg)]" />;
  }

  return (
    <div className="min-h-screen bg-[var(--vault-bg)] px-4 pb-16 pt-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1180px]">
        <div className="mb-8 flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--vault-copy-soft)]">Cart</p>
          <h1 className="text-[clamp(2rem,4vw,3.4rem)] font-black tracking-[-0.04em] text-[var(--vault-ink)]">
            Review the items that will land in the order center.
          </h1>
        </div>

        {cart.items.length === 0 ? (
          <div className="rounded-[var(--vault-radius-lg)] border border-dashed border-[var(--vault-line)] bg-[var(--vault-surface)] p-16 text-center shadow-[var(--vault-shadow-soft)]">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[1.5rem] bg-[var(--vault-primary-soft)] text-[var(--vault-primary)]">
              <ShoppingBag className="h-10 w-10" />
            </div>
            <p className="mt-6 text-lg font-semibold text-[var(--vault-ink)]">Your cart is empty.</p>
            <button
              onClick={onContinueShopping}
              className="mt-6 rounded-xl bg-[var(--vault-primary)] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--vault-primary-strong)]"
            >
              Continue shopping
            </button>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,0.75fr)]">
            <section className="space-y-4">
              {cart.items.map((item) => (
                <article
                  key={item.id}
                  className="rounded-[var(--vault-radius-lg)] border border-[var(--vault-line)] bg-[var(--vault-surface)] p-5 shadow-[var(--vault-shadow-soft)]"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <h2 className="text-lg font-bold tracking-tight text-[var(--vault-ink)]">{item.productName}</h2>
                      <p className="mt-1 text-sm text-[var(--vault-copy)]">
                        Qty {item.quantity}
                        {item.variantName ? ` · ${item.variantName}` : ''}
                      </p>
                      <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--vault-copy-soft)]">
                        {item.requiresShipping ? 'Hybrid delivery' : 'Digital delivery'}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center rounded-xl border border-[var(--vault-line)] bg-[var(--vault-surface-alt)] px-2 py-2">
                        <button
                          onClick={() => onUpdateQuantity(item.id, Math.max(1, item.quantity - 1))}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--vault-copy)]"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="min-w-[2.5rem] text-center text-sm font-bold text-[var(--vault-ink)]">{item.quantity}</span>
                        <button
                          onClick={() => onUpdateQuantity(item.id, Math.min(item.maxQuantity, item.quantity + 1))}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--vault-copy)]"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>

                      <button
                        onClick={() => onRemoveItem(item.id)}
                        className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--vault-line)] bg-[var(--vault-surface-alt)] text-[var(--vault-copy)] transition-colors hover:text-[var(--vault-danger)]"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 border-t border-[var(--vault-line)] pt-4 text-right">
                    <span className="text-lg font-black tracking-[-0.03em] text-[var(--vault-ink)]">
                      ${Number(item.subtotal || 0).toFixed(2)}
                    </span>
                  </div>
                </article>
              ))}
            </section>

            <aside className="rounded-[var(--vault-radius-lg)] border border-[var(--vault-line)] bg-[var(--vault-surface)] p-6 shadow-[var(--vault-shadow-soft)] lg:sticky lg:top-24">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--vault-copy-soft)]">Summary</p>
              <div className="mt-5 space-y-3 text-sm">
                <div className="flex items-center justify-between text-[var(--vault-copy)]">
                  <span>Subtotal</span>
                  <span>${Number(cart.subtotal || 0).toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-[var(--vault-copy)]">
                  <span>Shipping</span>
                  <span>{Number(cart.shipping || 0) > 0 ? `$${Number(cart.shipping).toFixed(2)}` : 'No physical shipment'}</span>
                </div>
                <div className="flex items-center justify-between text-[var(--vault-copy)]">
                  <span>Discount</span>
                  <span>{Number(cart.discount || 0) > 0 ? `-$${Number(cart.discount).toFixed(2)}` : '$0.00'}</span>
                </div>
                <div className="flex items-center justify-between border-t border-[var(--vault-line)] pt-3 text-lg font-black tracking-[-0.03em] text-[var(--vault-ink)]">
                  <span>Total</span>
                  <span>${Number(cart.total || 0).toFixed(2)}</span>
                </div>
              </div>

              <button
                onClick={onCheckout}
                className="mt-6 flex min-h-12 w-full items-center justify-center rounded-xl bg-[var(--vault-primary)] px-5 text-sm font-semibold text-white transition-colors hover:bg-[var(--vault-primary-strong)]"
              >
                Continue to checkout
              </button>
              <button
                onClick={onContinueShopping}
                className="mt-3 flex min-h-12 w-full items-center justify-center rounded-xl border border-[var(--vault-line)] bg-[var(--vault-surface-alt)] px-5 text-sm font-medium text-[var(--vault-ink)] transition-colors hover:bg-[var(--vault-primary-soft)]"
              >
                Continue shopping
              </button>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
});
