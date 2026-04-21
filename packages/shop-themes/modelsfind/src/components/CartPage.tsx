import React from 'react';
import { ArrowLeft, Check, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import type { CartPageProps } from 'shared/src/types/theme';
import { formatMoneyPrecise, getCartSelection } from '../commerce';
import { resolvePreviewPortraitForProduct } from '../site';

export const CartPage = React.memo(function CartPage({
  cart,
  isLoading,
  onUpdateQuantity,
  onRemoveItem,
  onCheckout,
  onCheckoutSelected,
  selectedItemIds,
  onToggleItemSelection,
  onSelectAllItems,
  onDeselectAllItems,
  onContinueShopping,
}: CartPageProps) {
  const getDisplayPortrait = React.useCallback(
    (item?: { productId?: string; productName?: string } | null) =>
      resolvePreviewPortraitForProduct({
        id: item?.productId,
        name: item?.productName,
      }),
    [],
  );

  const supportsSelection = Boolean(
    onCheckoutSelected && onToggleItemSelection && onSelectAllItems && onDeselectAllItems
  );

  const {
    selectedIds,
    selectedSet,
    selectedSubtotal,
    selectedTax,
    selectedShipping,
    selectedDiscount,
  } = getCartSelection(cart, supportsSelection ? selectedItemIds ?? [] : undefined, !supportsSelection);

  const selectedTotal = Number(
    (selectedSubtotal + selectedTax + selectedShipping - selectedDiscount).toFixed(2)
  );
  const allSelected = cart.items.length > 0 && selectedIds.length === cart.items.length;
  const hasSelection = selectedIds.length > 0;
  const bookingItems = supportsSelection ? cart.items.filter((item) => selectedSet.has(item.id)) : cart.items;
  const leadItem = bookingItems[0] || cart.items[0];
  const leadPortrait = getDisplayPortrait(leadItem);
  const bookingMonth = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
  }).format(new Date());
  const bookingDays = Array.from({ length: 21 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() + index);
    return {
      label: new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(date).slice(0, 1),
      day: date.getDate(),
      active: index === 3,
      muted: index < 2,
    };
  });
  const depositValue = Number((selectedTotal * 0.2).toFixed(2));

  if (cart.items.length === 0) {
    return (
      <div className="modelsfind-shell min-h-screen px-4 pb-24 pt-24 [font-family:var(--modelsfind-body)] text-[var(--modelsfind-ink)]">
        <div className="mx-auto max-w-[960px]">
          <div className="modelsfind-panel rounded-[2rem] border border-[var(--modelsfind-line)] p-10 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[1.6rem] bg-[var(--modelsfind-primary-soft)] text-[var(--modelsfind-primary)]">
              <ShoppingBag className="h-9 w-9" />
            </div>
            <h1 className="mt-6 [font-family:var(--modelsfind-display)] text-[clamp(2.6rem,7vw,4rem)] leading-[0.92] tracking-[-0.05em] text-white">
              Your private cart is empty.
            </h1>
            <p className="mx-auto mt-4 max-w-[30rem] text-sm leading-7 text-[var(--modelsfind-copy)]">
              Keep the empty state quiet and premium. Encourage exploration without collapsing into generic storefront language.
            </p>
            <button
              type="button"
              onClick={onContinueShopping}
              className="mt-8 inline-flex min-h-12 items-center gap-2 rounded-full bg-[linear-gradient(135deg,var(--modelsfind-primary),var(--modelsfind-primary-strong))] px-6 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#140d16] shadow-[0_0_24px_var(--modelsfind-glow)]"
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
    <div className="modelsfind-shell min-h-screen px-4 pb-32 pt-20 [font-family:var(--modelsfind-body)] text-[var(--modelsfind-ink)]">
      <div className="mx-auto max-w-[1560px] md:hidden">
        <header className="modelsfind-mobile-topbar fixed inset-x-0 top-0 z-[75] flex h-16 items-center justify-between px-6">
          <button
            type="button"
            onClick={onContinueShopping}
            className="inline-flex items-center gap-3 text-white"
          >
            <ShoppingBag className="h-4 w-4 text-[var(--modelsfind-primary)]" />
            <span className="[font-family:var(--modelsfind-display)] text-[1rem] italic tracking-[0.16em] uppercase">
              {leadPortrait.name}
            </span>
          </button>
          <Check className="h-4 w-4 text-[var(--modelsfind-copy-soft)]" />
        </header>

        <div className="space-y-10 pb-12">
          <section className="pt-4">
            <span className="text-[10px] uppercase tracking-[0.2rem] text-[var(--modelsfind-primary)]">Reservation</span>
            <h1 className="mt-3 [font-family:var(--modelsfind-display)] text-[3rem] leading-[0.96] tracking-[-0.05em] text-white">
              Secure Your <br />
              <span className="italic">Private Occasion</span>
            </h1>
            <p className="mt-4 max-w-[18rem] text-sm leading-6 text-[var(--modelsfind-copy)]">
              Select your preferred service tier and scheduling window. Our concierge will finalize the details.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-[10px] uppercase tracking-[0.15rem] text-[var(--modelsfind-copy-soft)]">Service type</h2>
            <div className="grid grid-cols-2 gap-4">
              {bookingItems.slice(0, 2).map((item, index) => {
                const portrait = getDisplayPortrait(item);
                return (
                <article
                  key={item.id}
                  className={[
                    'rounded-[1rem] p-4',
                    index === 0
                      ? 'modelsfind-mobile-surface border-b-2 border-[var(--modelsfind-primary)] shadow-[0_0_18px_rgba(255,122,251,0.12)]'
                      : 'border border-[color-mix(in_srgb,var(--modelsfind-line)_70%,transparent)] bg-[rgba(17,14,20,0.78)]',
                  ].join(' ')}
                >
                  <div className="mb-6 flex items-start justify-between gap-3">
                    <span className="text-[var(--modelsfind-primary)]">{index === 0 ? '✦' : '◌'}</span>
                    <span className="text-[10px] font-bold tracking-tight text-[var(--modelsfind-copy-soft)]">
                      Tier {index === 0 ? 'I' : 'II'}
                    </span>
                  </div>
                  <h3 className={index === 0 ? '[font-family:var(--modelsfind-display)] text-[1.3rem] text-white' : '[font-family:var(--modelsfind-display)] text-[1.3rem] text-[var(--modelsfind-copy)]'}>
                    {item.variantName || portrait.name}
                  </h3>
                  <p className="mt-2 text-xs leading-5 text-[var(--modelsfind-copy-soft)]">
                    {index === 0
                      ? 'High-fashion productions and discreet curated sets.'
                      : 'Exclusive gatherings and private concierge experiences.'}
                  </p>
                </article>
                );
              })}
              {bookingItems.length < 2 ? (
                <article className="rounded-[1rem] border border-[color-mix(in_srgb,var(--modelsfind-line)_70%,transparent)] bg-[rgba(17,14,20,0.78)] p-4">
                  <div className="mb-6 flex items-start justify-between gap-3">
                    <span className="text-[var(--modelsfind-copy-soft)]">◌</span>
                    <span className="text-[10px] font-bold tracking-tight text-[var(--modelsfind-copy-soft)]">Tier II</span>
                  </div>
                  <h3 className="[font-family:var(--modelsfind-display)] text-[1.3rem] text-[var(--modelsfind-copy)]">Private Event</h3>
                  <p className="mt-2 text-xs leading-5 text-[var(--modelsfind-copy-soft)]">
                    Exclusive gatherings and curated experiences.
                  </p>
                </article>
              ) : null}
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="text-[10px] uppercase tracking-[0.15rem] text-[var(--modelsfind-copy-soft)]">Select date</h2>
                <p className="[font-family:var(--modelsfind-display)] text-[1.7rem] text-white">{bookingMonth}</p>
              </div>
              <div className="flex gap-4 text-[var(--modelsfind-copy-soft)]">
                <ArrowLeft className="h-4 w-4" />
                <ArrowLeft className="h-4 w-4 rotate-180" />
              </div>
            </div>

            <div className="rounded-[1.4rem] border border-[color-mix(in_srgb,var(--modelsfind-line)_50%,transparent)] bg-[rgba(0,0,0,0.28)] p-5">
              <div className="mb-4 grid grid-cols-7 text-center text-[10px] font-bold uppercase text-[var(--modelsfind-copy-soft)]">
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day) => (
                  <span key={day}>{day}</span>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-y-4 text-center">
                {bookingDays.map((day, index) => (
                  <div
                    key={`${day.day}-${index}`}
                    className={[
                      'relative py-2 text-sm',
                      day.active
                        ? 'rounded-full border border-[var(--modelsfind-line-strong)] bg-[var(--modelsfind-primary-soft)] text-white'
                        : day.muted
                          ? 'text-[color-mix(in_srgb,var(--modelsfind-copy-soft)_35%,transparent)]'
                          : 'text-[var(--modelsfind-copy)]',
                    ].join(' ')}
                  >
                    {day.day}
                    {day.active ? (
                      <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-[var(--modelsfind-primary)]" />
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="modelsfind-mobile-surface relative overflow-hidden rounded-[1.7rem] border border-[color-mix(in_srgb,var(--modelsfind-line)_70%,transparent)] p-6">
            <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-[var(--modelsfind-primary-soft)] blur-[72px]" />
            <div className="relative">
              <div className="mb-8 flex items-baseline justify-between gap-4">
                <div>
                  <h2 className="text-[10px] uppercase tracking-[0.15rem] text-[var(--modelsfind-copy-soft)]">Estimated total</h2>
                  <p className="[font-family:var(--modelsfind-display)] text-[2.6rem] text-white">
                    {formatMoneyPrecise(selectedTotal)}
                  </p>
                </div>
                <span className="rounded-full bg-[var(--modelsfind-primary-soft)] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14rem] text-[var(--modelsfind-primary)]">
                  Elite tier
                </span>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex justify-between gap-4 text-[var(--modelsfind-copy)]">
                  <span>{leadItem.variantName || leadPortrait.name}</span>
                  <span className="text-white">{formatMoneyPrecise(leadItem.subtotal)}</span>
                </div>
                <div className="flex justify-between gap-4 text-[var(--modelsfind-copy)]">
                  <span>Location Concierge</span>
                  <span className="text-white">{formatMoneyPrecise(selectedShipping)}</span>
                </div>
                <div className="flex justify-between gap-4 border-t border-[color-mix(in_srgb,var(--modelsfind-line)_70%,transparent)] pt-3 font-bold">
                  <span className="text-white">Deposit Required (20%)</span>
                  <span className="text-[var(--modelsfind-primary)]">{formatMoneyPrecise(depositValue)}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (supportsSelection && onCheckoutSelected) {
                    onCheckoutSelected(selectedIds);
                    return;
                  }
                  onCheckout();
                }}
                disabled={isLoading || (supportsSelection && !hasSelection)}
                className="modelsfind-mobile-cta mt-8 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--modelsfind-primary),var(--modelsfind-primary-strong))] px-6 text-[11px] font-bold uppercase tracking-[0.22em] text-[#210025] disabled:opacity-60"
              >
                Request Booking
              </button>
            </div>
          </section>
        </div>
      </div>

      <div className="mx-auto hidden max-w-[1560px] md:block">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onContinueShopping}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] text-[var(--modelsfind-copy)]"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <p className="text-[10px] uppercase tracking-[0.24em] text-[var(--modelsfind-primary)]">Checkout</p>
            <h1 className="[font-family:var(--modelsfind-display)] text-[2.3rem] leading-none tracking-[-0.04em] text-white">
              Curated cart
            </h1>
          </div>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
          <section className="modelsfind-frame overflow-hidden rounded-[2rem] border border-[var(--modelsfind-line-strong)] p-4 md:p-6 xl:p-8">
            {supportsSelection ? (
              <div className="flex items-center justify-between rounded-[1.2rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-4 py-3">
                <button
                  type="button"
                  onClick={() => {
                    if (allSelected) {
                      onDeselectAllItems?.();
                      return;
                    }
                    onSelectAllItems?.();
                  }}
                  className="inline-flex items-center gap-2 text-sm text-[var(--modelsfind-ink)]"
                >
                  <span
                    className={[
                      'flex h-5 w-5 items-center justify-center rounded-md border transition-colors',
                      allSelected
                        ? 'border-[var(--modelsfind-primary)] bg-[var(--modelsfind-primary)] text-[#140d16]'
                        : 'border-[var(--modelsfind-line)] text-transparent',
                    ].join(' ')}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </span>
                  {allSelected ? 'Deselect all' : 'Select all'}
                </button>
                <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]">
                  {selectedIds.length} selected
                </span>
              </div>
            ) : null}

            <div className="mt-6 grid gap-4">
              {cart.items.map((item) => {
                const portrait = getDisplayPortrait(item);
                return (
                <article
                  key={item.id}
                  className="rounded-[1.6rem] border border-[var(--modelsfind-line)] bg-[rgba(17,14,20,0.92)] p-4 sm:p-5"
                >
                  <div className="flex gap-4">
                    {supportsSelection ? (
                      <button
                        type="button"
                        onClick={() => onToggleItemSelection?.(item.id)}
                        className={[
                          'mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors',
                          selectedSet.has(item.id)
                            ? 'border-[var(--modelsfind-primary)] bg-[var(--modelsfind-primary)] text-[#140d16]'
                            : 'border-[var(--modelsfind-line)] text-transparent',
                        ].join(' ')}
                        aria-label={selectedSet.has(item.id) ? 'Deselect item' : 'Select item'}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    ) : null}

                    <div className="h-24 w-24 shrink-0 overflow-hidden rounded-[1.1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)]">
                      <img
                        src={item.productImage || '/placeholder-product.svg'}
                        alt={portrait.name}
                        className="h-full w-full object-cover grayscale"
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <h2 className="[font-family:var(--modelsfind-display)] text-[1.8rem] leading-none tracking-[-0.04em] text-white">
                            {portrait.name}
                          </h2>
                          {item.variantName ? (
                            <p className="mt-2 text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]">
                              {item.variantName}
                            </p>
                          ) : null}
                        </div>
                        <p className="text-sm font-semibold text-[var(--modelsfind-primary)]">
                          {formatMoneyPrecise(item.price)}
                        </p>
                      </div>

                      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="inline-flex items-center rounded-full border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] p-1">
                          <button
                            type="button"
                            onClick={() => void onUpdateQuantity(item.id, item.quantity - 1)}
                            disabled={isLoading || item.quantity <= 1}
                            className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--modelsfind-copy)] disabled:opacity-40"
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <span className="min-w-[2.75rem] text-center text-sm font-semibold text-white">{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => void onUpdateQuantity(item.id, item.quantity + 1)}
                            disabled={isLoading || item.quantity >= item.maxQuantity}
                            className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--modelsfind-copy)] disabled:opacity-40"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]">
                            {formatMoneyPrecise(item.subtotal)}
                          </span>
                          <button
                            type="button"
                            onClick={() => void onRemoveItem(item.id)}
                            disabled={isLoading}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] text-[var(--modelsfind-copy)] transition-colors hover:text-red-300"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
                );
              })}
            </div>
          </section>

          <aside className="modelsfind-panel rounded-[1.6rem] border border-[var(--modelsfind-line)] p-5">
            <p className="text-[10px] uppercase tracking-[0.24em] text-[var(--modelsfind-primary)]">Summary</p>
            <h2 className="mt-3 [font-family:var(--modelsfind-display)] text-[2rem] leading-none tracking-[-0.04em] text-white">
              Booking total
            </h2>

            <div className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between text-[var(--modelsfind-copy)]">
                <span>Subtotal</span>
                <span className="text-white">{formatMoneyPrecise(selectedSubtotal)}</span>
              </div>
              <div className="flex justify-between text-[var(--modelsfind-copy)]">
                <span>Tax</span>
                <span className="text-white">{formatMoneyPrecise(selectedTax)}</span>
              </div>
              <div className="flex justify-between text-[var(--modelsfind-copy)]">
                <span>Shipping</span>
                <span className="text-white">
                  {selectedShipping === 0 ? 'Included' : formatMoneyPrecise(selectedShipping)}
                </span>
              </div>
              {selectedDiscount > 0 ? (
                <div className="flex justify-between text-emerald-200">
                  <span>Discount</span>
                  <span>-{formatMoneyPrecise(selectedDiscount)}</span>
                </div>
              ) : null}
              <div className="flex justify-between border-t border-[var(--modelsfind-line)] pt-3 text-base">
                <span className="font-semibold text-white">Total</span>
                <span className="font-semibold text-[var(--modelsfind-primary)]">
                  {formatMoneyPrecise(selectedTotal)}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                if (supportsSelection && onCheckoutSelected) {
                  onCheckoutSelected(selectedIds);
                  return;
                }
                onCheckout();
              }}
              disabled={isLoading || (supportsSelection && !hasSelection)}
              className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--modelsfind-primary),var(--modelsfind-primary-strong))] px-6 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#140d16] shadow-[0_0_24px_var(--modelsfind-glow)] disabled:opacity-60"
            >
              Proceed to checkout
            </button>

            <button
              type="button"
              onClick={onContinueShopping}
              className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.04)] px-6 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--modelsfind-ink)]"
            >
              <ArrowLeft className="h-4 w-4" />
              Continue browsing
            </button>
          </aside>
        </div>
      </div>
    </div>
  );
});
