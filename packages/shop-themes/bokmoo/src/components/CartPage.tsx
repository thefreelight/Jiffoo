import React from 'react';
import { ArrowLeft, Check, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { cn } from '@jiffoo/ui';
import type { CartPageProps } from 'shared/src/types/theme';

export const CartPage = React.memo(function CartPage({
  cart,
  isLoading,
  onUpdateQuantity,
  onRemoveItem,
  onCheckout,
  onCheckoutSelected,
  selectedItemIds,
  selectedItemCount,
  onToggleItemSelection,
  onSelectAllItems,
  onDeselectAllItems,
  onContinueShopping,
}: CartPageProps) {
  const supportsSelection = Boolean(
    onCheckoutSelected && onToggleItemSelection && onSelectAllItems && onDeselectAllItems
  );
  const effectiveSelectedIds = supportsSelection
    ? (selectedItemIds || [])
    : cart.items.map((item) => item.id);
  const selectedIdSet = new Set(effectiveSelectedIds);
  const selectedItems = supportsSelection
    ? cart.items.filter((item) => selectedIdSet.has(item.id))
    : cart.items;
  const selectedSubtotal = selectedItems.reduce((sum, item) => sum + item.subtotal, 0);
  const ratio = cart.subtotal > 0 ? selectedSubtotal / cart.subtotal : 0;
  const selectedTax = Number(((cart.tax || 0) * ratio).toFixed(2));
  const selectedShipping = Number(((cart.shipping || 0) * ratio).toFixed(2));
  const selectedDiscount = Number(((cart.discount || 0) * ratio).toFixed(2));
  const selectedTotal = Number((selectedSubtotal + selectedTax + selectedShipping - selectedDiscount).toFixed(2));
  const selectedQuantity = selectedItems.reduce((sum, item) => sum + item.quantity, 0);
  const allSelected = cart.items.length > 0 && effectiveSelectedIds.length === cart.items.length;
  const hasSelection = effectiveSelectedIds.length > 0;

  if (cart.items.length === 0) {
    return (
      <div className="min-h-screen bg-[var(--bokmoo-bg)] px-4 pb-16 pt-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[960px]">
          <div className="rounded-[var(--bokmoo-radius-xl)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] px-6 py-16 text-center shadow-[var(--bokmoo-shadow)] sm:px-10">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[1.6rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] text-[var(--bokmoo-gold)]">
              <ShoppingBag className="h-10 w-10" />
            </div>
            <h1 className="mt-6 text-[clamp(2.2rem,4vw,4rem)] leading-[0.98] tracking-[-0.05em] text-[var(--bokmoo-ink)]">
              Your travel bag is still empty.
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-[var(--bokmoo-copy)]">
              Add the destination or regional pass you want to prepare before departure.
            </p>
            <button
              onClick={onContinueShopping}
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_82%,white),color-mix(in_oklab,var(--bokmoo-gold)_65%,black))] px-6 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-bg)]"
              type="button"
            >
              <ArrowLeft className="h-4 w-4" />
              Continue browsing
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bokmoo-bg)] px-4 pb-16 pt-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1280px]">
        <div className="flex items-center gap-4">
          <button
            onClick={onContinueShopping}
            className="flex h-10 w-10 items-center justify-center rounded-[1rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] text-[var(--bokmoo-copy)]"
            type="button"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--bokmoo-copy-soft)]">
              Travel bag
            </p>
            <h1 className="mt-1 text-[clamp(2rem,4vw,3.6rem)] leading-[0.98] tracking-[-0.05em] text-[var(--bokmoo-ink)]">
              Review your selected plans.
            </h1>
          </div>
        </div>

        {supportsSelection ? (
          <div className="mt-5 flex items-center justify-between rounded-[var(--bokmoo-radius-lg)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] p-4 shadow-[var(--bokmoo-shadow)]">
            <button
              type="button"
              onClick={() => {
                if (allSelected) {
                  onDeselectAllItems?.();
                  return;
                }
                onSelectAllItems?.();
              }}
              className="inline-flex items-center gap-2 text-sm font-medium text-[var(--bokmoo-copy)]"
            >
              <span
                className={cn(
                  'flex h-5 w-5 items-center justify-center rounded-md border',
                  allSelected
                    ? 'border-[var(--bokmoo-gold)] bg-[var(--bokmoo-gold)] text-[var(--bokmoo-bg)]'
                    : 'border-[var(--bokmoo-line-strong)] bg-[var(--bokmoo-bg)] text-transparent'
                )}
              >
                <Check className="h-3.5 w-3.5" />
              </span>
              {allSelected ? 'Deselect all' : 'Select all'}
            </button>
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-copy-soft)]">
              {selectedItemCount ?? effectiveSelectedIds.length} selected
            </span>
          </div>
        ) : null}

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,0.98fr)_minmax(22rem,0.72fr)]">
          <section className="space-y-4">
            {cart.items.map((item) => (
              <article
                key={item.id}
                className="rounded-[var(--bokmoo-radius-xl)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] p-5 shadow-[var(--bokmoo-shadow)]"
              >
                <div className="flex gap-4">
                  {supportsSelection ? (
                    <button
                      type="button"
                      onClick={() => onToggleItemSelection?.(item.id)}
                      className={cn(
                        'mt-1 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border transition-colors',
                        selectedIdSet.has(item.id)
                          ? 'border-[var(--bokmoo-gold)] bg-[var(--bokmoo-gold)] text-[var(--bokmoo-bg)]'
                          : 'border-[var(--bokmoo-line-strong)] bg-[var(--bokmoo-bg)] text-transparent'
                      )}
                      aria-label={selectedIdSet.has(item.id) ? 'Deselect item' : 'Select item'}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  ) : null}

                  <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-[var(--bokmoo-radius-lg)] border border-[var(--bokmoo-line)] bg-[linear-gradient(155deg,color-mix(in_oklab,var(--bokmoo-gold)_10%,transparent),transparent_55%),var(--bokmoo-bg)]">
                    {item.productImage ? (
                      <img src={item.productImage} alt={item.productName} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-end p-3 text-[10px] uppercase tracking-[0.16em] text-[var(--bokmoo-gold)]">
                        Bokmoo
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-medium text-[var(--bokmoo-ink)]">{item.productName}</h2>
                    {item.variantName ? (
                      <p className="mt-1 text-xs uppercase tracking-[0.16em] text-[var(--bokmoo-copy-soft)]">
                        {item.variantName}
                      </p>
                    ) : null}
                    <p className="mt-3 text-sm text-[var(--bokmoo-copy)]">Instant QR delivery and traveler setup guidance.</p>
                    <div className="mt-4 flex items-center gap-3">
                      <div className="flex items-center rounded-full border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] px-2 py-1">
                        <button
                          onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                          disabled={isLoading || item.quantity <= 1}
                          className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--bokmoo-copy)] disabled:opacity-40"
                          type="button"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="min-w-[2rem] text-center text-sm font-medium text-[var(--bokmoo-ink)]">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                          disabled={isLoading || item.quantity >= item.maxQuantity}
                          className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--bokmoo-copy)] disabled:opacity-40"
                          type="button"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                      <button
                        onClick={() => onRemoveItem(item.id)}
                        disabled={isLoading}
                        className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] text-[var(--bokmoo-copy)] transition-colors hover:text-[var(--bokmoo-danger)] disabled:opacity-40"
                        title="Remove"
                        type="button"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--bokmoo-copy-soft)]">Subtotal</p>
                    <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--bokmoo-ink)]">
                      ${item.subtotal.toFixed(2)}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </section>

          <aside className="lg:col-span-1">
            <div className="sticky top-24 rounded-[var(--bokmoo-radius-xl)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] p-6 shadow-[var(--bokmoo-shadow)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-copy-soft)]">
                Summary
              </p>

              <div className="mt-6 space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--bokmoo-copy)]">Selected items</span>
                  <span className="text-[var(--bokmoo-ink)]">{supportsSelection ? selectedQuantity : cart.itemCount}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--bokmoo-copy)]">Subtotal</span>
                  <span className="text-[var(--bokmoo-ink)]">${selectedSubtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--bokmoo-copy)]">Tax</span>
                  <span className="text-[var(--bokmoo-ink)]">${selectedTax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--bokmoo-copy)]">Shipping</span>
                  <span className="text-[var(--bokmoo-ink)]">
                    {selectedShipping === 0 ? 'No shipment needed' : `$${selectedShipping.toFixed(2)}`}
                  </span>
                </div>
                {selectedDiscount > 0 ? (
                  <div className="flex justify-between text-sm text-[var(--bokmoo-success)]">
                    <span>Discount</span>
                    <span>-${selectedDiscount.toFixed(2)}</span>
                  </div>
                ) : null}
                <div className="border-t border-[var(--bokmoo-line)] pt-4">
                  <div className="flex justify-between text-lg">
                    <span className="text-[var(--bokmoo-ink)]">Total</span>
                    <span className="font-semibold text-[var(--bokmoo-ink)]">${selectedTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  if (supportsSelection && hasSelection) {
                    onCheckoutSelected?.(effectiveSelectedIds);
                    return;
                  }
                  onCheckout();
                }}
                disabled={supportsSelection && !hasSelection}
                className="mt-6 flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_82%,white),color-mix(in_oklab,var(--bokmoo-gold)_65%,black))] px-5 text-sm font-semibold uppercase tracking-[0.2em] text-[var(--bokmoo-bg)] disabled:cursor-not-allowed disabled:opacity-50"
                type="button"
              >
                Secure checkout
              </button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
});
