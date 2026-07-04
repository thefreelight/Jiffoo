'use client';

import { ArrowRight, CheckCircle2, Sparkles } from 'lucide-react';
import type { OrderSuccessPageProps } from 'shared/src/types/theme';

import { StudioMain, StudioPage, StudioPanel } from './StudioShell';

export function OrderSuccessPage({ orderNumber, isVerifying, onContinueShopping, onViewOrders }: OrderSuccessPageProps) {
  return (
    <StudioPage activeNav="history">
      <StudioMain>
        <StudioPanel className="mx-auto max-w-3xl text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-400/14 text-emerald-300">
            <CheckCircle2 className="h-10 w-10" />
          </div>
          <h1 className="mt-6 text-[clamp(2.4rem,5vw,4.4rem)] font-semibold tracking-[-0.06em] text-[color:var(--imagic-ink)]">
            Your creator order is confirmed.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-8 text-[color:var(--imagic-ink-soft)]">
            {isVerifying ? 'We are verifying the order now.' : 'Payment is complete and your purchase is now attached to the same dark workspace you used to browse and generate.'}
          </p>
          <div className="mt-6 rounded-[1.4rem] border border-[color:var(--imagic-line)] bg-[color:var(--imagic-surface-elevated)] px-6 py-5">
            <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--imagic-muted)]">Order number</p>
            <p className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-[color:var(--imagic-ink)]">{orderNumber}</p>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              'Your purchase will appear in the orders workspace.',
              'You can keep browsing packs without leaving the theme shell.',
              'Use the same workspace for prompts, products, and follow-up exports.',
            ].map((item) => (
              <div key={item} className="rounded-[1.3rem] border border-[color:var(--imagic-line)] bg-[color:var(--imagic-surface-elevated)] p-4 text-sm leading-7 text-[color:var(--imagic-ink-soft)]">
                <Sparkles className="h-5 w-5 text-[color:var(--imagic-primary)]" />
                <p className="mt-3">{item}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <button type="button" onClick={onViewOrders} className="imagic-button-primary inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold text-white shadow-[var(--imagic-primary-shadow)]">
              View orders
              <ArrowRight className="h-4 w-4" />
            </button>
            <button type="button" onClick={onContinueShopping} className="inline-flex items-center justify-center gap-2 rounded-full border border-[color:var(--imagic-line)] bg-[color:var(--imagic-surface-elevated)] px-5 py-3 text-sm font-medium text-[color:var(--imagic-ink)] transition hover:-translate-y-0.5">
              Continue shopping
            </button>
          </div>
        </StudioPanel>
      </StudioMain>
    </StudioPage>
  );
}
