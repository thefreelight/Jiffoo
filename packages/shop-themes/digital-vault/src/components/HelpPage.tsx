import React from 'react';
import { ArrowRight, CircleHelp } from 'lucide-react';
import type { HelpPageProps } from '../types/theme';

const HELP_ITEMS = [
  'How digital delivery appears inside the order center',
  'When to expect instant versus manual fulfillment',
  'How to safely store codes and credentials after purchase',
  'What to do when a digital order needs support',
];

export const HelpPage = React.memo(function HelpPage({
  onNavigateToCategory,
  onNavigateToContact,
}: HelpPageProps) {
  return (
    <div className="min-h-screen bg-[var(--vault-bg)] px-4 pb-16 pt-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[980px] space-y-6">
        <section className="rounded-[var(--vault-radius-lg)] border border-[var(--vault-line)] bg-[var(--vault-surface)] p-6 shadow-[var(--vault-shadow-soft)] sm:p-8">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--vault-primary-soft)] text-[var(--vault-primary)]">
              <CircleHelp className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--vault-copy-soft)]">Help center</p>
              <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] text-[var(--vault-ink)]">
                Understand how digital delivery works here.
              </h1>
              <p className="mt-3 text-sm leading-7 text-[var(--vault-copy)]">
                This storefront keeps delivery tied to the order center so shoppers can return to one source of truth after checkout.
              </p>
            </div>
          </div>
        </section>

        <div className="grid gap-4">
          {HELP_ITEMS.map((item) => (
            <div
              key={item}
              className="rounded-[var(--vault-radius-lg)] border border-[var(--vault-line)] bg-[var(--vault-surface)] px-5 py-4 text-sm leading-7 text-[var(--vault-copy)] shadow-[var(--vault-shadow-soft)]"
            >
              {item}
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-3">
          {onNavigateToCategory ? (
            <button
              onClick={() => onNavigateToCategory('all')}
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--vault-primary)] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--vault-primary-strong)]"
            >
              Browse categories
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : null}
          {onNavigateToContact ? (
            <button
              onClick={onNavigateToContact}
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--vault-line)] bg-[var(--vault-surface-alt)] px-5 py-3 text-sm font-medium text-[var(--vault-ink)] transition-colors hover:bg-[var(--vault-primary-soft)]"
            >
              Contact support
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
});
