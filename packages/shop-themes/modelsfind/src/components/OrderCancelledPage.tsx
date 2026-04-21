import React from 'react';
import { ArrowLeft, HelpCircle, ShoppingBag, XCircle } from 'lucide-react';
import type { OrderCancelledPageProps } from 'shared/src/types/theme';

export const OrderCancelledPage = React.memo(function OrderCancelledPage({
  onReturnToCart,
  onContinueShopping,
  onContactSupport,
}: OrderCancelledPageProps) {
  return (
    <div className="modelsfind-shell min-h-screen px-4 py-12 [font-family:var(--modelsfind-body)] text-[var(--modelsfind-ink)]">
      <div className="mx-auto max-w-[960px]">
        <div className="modelsfind-panel rounded-[2rem] border border-[var(--modelsfind-line)] p-8 text-center">
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-[2rem] bg-yellow-500/10 text-yellow-100">
            <XCircle className="h-12 w-12" />
          </div>
          <p className="mt-6 text-[10px] uppercase tracking-[0.24em] text-yellow-100">Payment cancelled</p>
          <h1 className="mt-4 [font-family:var(--modelsfind-display)] text-[clamp(2.8rem,7vw,4.6rem)] leading-[0.92] tracking-[-0.05em] text-white">
            Nothing has been charged.
          </h1>
          <p className="mx-auto mt-4 max-w-[32rem] text-sm leading-7 text-[var(--modelsfind-copy)]">
            Keep the cancellation state reassuring. The cart remains intact and the path back to checkout stays obvious on mobile.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={onReturnToCart}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,var(--modelsfind-primary),var(--modelsfind-primary-strong))] px-6 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#140d16] shadow-[0_0_24px_var(--modelsfind-glow)]"
            >
              <ShoppingBag className="h-4 w-4" />
              Return to cart
            </button>
            <button
              type="button"
              onClick={onContinueShopping}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.04)] px-6 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--modelsfind-ink)]"
            >
              <ArrowLeft className="h-4 w-4" />
              Continue browsing
            </button>
          </div>
          {onContactSupport ? (
            <button
              type="button"
              onClick={onContactSupport}
              className="mt-4 inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)] transition-colors hover:text-[var(--modelsfind-primary)]"
            >
              <HelpCircle className="h-4 w-4" />
              Contact support
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
});
