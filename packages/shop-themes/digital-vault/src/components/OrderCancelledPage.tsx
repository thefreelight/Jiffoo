import React from 'react';
import { ArrowLeft, ShoppingBag, TriangleAlert } from 'lucide-react';
import type { OrderCancelledPageProps } from '../types/theme';

export const OrderCancelledPage = React.memo(function OrderCancelledPage({
  onReturnToCart,
  onContinueShopping,
  onContactSupport,
}: OrderCancelledPageProps) {
  return (
    <div className="min-h-screen bg-[var(--vault-bg)] px-4 pb-16 pt-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[760px] rounded-[var(--vault-radius-lg)] border border-[var(--vault-line)] bg-[var(--vault-surface)] p-10 text-center shadow-[var(--vault-shadow-soft)]">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[1.5rem] bg-[color:color-mix(in_oklab,var(--vault-warning)_18%,white)] text-[var(--vault-warning)]">
          <TriangleAlert className="h-10 w-10" />
        </div>
        <h1 className="mt-6 text-3xl font-black tracking-[-0.04em] text-[var(--vault-ink)]">
          The order was not completed.
        </h1>
        <p className="mx-auto mt-4 max-w-[32rem] text-sm leading-7 text-[var(--vault-copy)]">
          Your cart is still available. Return to the cart to try again or continue browsing if you need to adjust the purchase.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            onClick={onReturnToCart}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--vault-primary)] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--vault-primary-strong)]"
          >
            <ArrowLeft className="h-4 w-4" />
            Return to cart
          </button>
          <button
            onClick={onContinueShopping}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--vault-line)] bg-[var(--vault-surface-alt)] px-5 py-3 text-sm font-medium text-[var(--vault-ink)] transition-colors hover:bg-[var(--vault-primary-soft)]"
          >
            <ShoppingBag className="h-4 w-4" />
            Continue shopping
          </button>
        </div>

        {onContactSupport ? (
          <button
            onClick={onContactSupport}
            className="mt-4 text-sm font-medium text-[var(--vault-primary)] underline underline-offset-4"
          >
            Contact support
          </button>
        ) : null}
      </div>
    </div>
  );
});
