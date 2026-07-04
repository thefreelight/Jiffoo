'use client';

import { ArrowLeft, LifeBuoy } from 'lucide-react';
import type { OrderCancelledPageProps } from 'shared/src/types/theme';

import { StudioMain, StudioPage, StudioPanel } from './StudioShell';

export function OrderCancelledPage({ onReturnToCart, onContinueShopping, onContactSupport }: OrderCancelledPageProps) {
  return (
    <StudioPage activeNav="history">
      <StudioMain>
        <StudioPanel className="mx-auto max-w-3xl text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-amber-400/14 text-amber-200">
            <LifeBuoy className="h-10 w-10" />
          </div>
          <h1 className="mt-6 text-[clamp(2.4rem,5vw,4.2rem)] font-semibold tracking-[-0.06em] text-[color:var(--imagic-ink)]">Checkout was cancelled.</h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-8 text-[color:var(--imagic-ink-soft)]">Your cart is still intact, so you can return and complete the purchase anytime without rebuilding the selection from scratch.</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <button type="button" onClick={onReturnToCart} className="imagic-button-primary inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold text-white shadow-[var(--imagic-primary-shadow)]">
              Return to cart
            </button>
            <button type="button" onClick={onContinueShopping} className="inline-flex items-center justify-center gap-2 rounded-full border border-[color:var(--imagic-line)] bg-[color:var(--imagic-surface-elevated)] px-5 py-3 text-sm font-medium text-[color:var(--imagic-ink)] transition hover:-translate-y-0.5">
              <ArrowLeft className="h-4 w-4" />
              Continue shopping
            </button>
          </div>
          {onContactSupport ? (
            <button type="button" onClick={onContactSupport} className="mt-4 text-sm text-[color:var(--imagic-primary)] transition hover:text-[color:var(--imagic-ink)]">
              Need help? Contact support
            </button>
          ) : null}
        </StudioPanel>
      </StudioMain>
    </StudioPage>
  );
}
