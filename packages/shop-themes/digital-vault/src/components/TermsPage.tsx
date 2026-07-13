import React from 'react';
import type { TermsPageProps } from '../types/theme';

export const TermsPage = React.memo(function TermsPage(_props: TermsPageProps) {
  return (
    <div className="min-h-screen bg-[var(--vault-bg)] px-4 pb-16 pt-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[900px] rounded-[var(--vault-radius-lg)] border border-[var(--vault-line)] bg-[var(--vault-surface)] p-8 shadow-[var(--vault-shadow-soft)]">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--vault-copy-soft)]">Terms</p>
        <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] text-[var(--vault-ink)]">
          Terms of service
        </h1>
        <div className="mt-6 space-y-4 text-sm leading-7 text-[var(--vault-copy)]">
          <p>
            Digital goods are typically delivered after payment authorization and attached to the order center. Buyers are responsible for securing any delivered codes, credentials, or links after retrieval.
          </p>
          <p>
            Merchants should define their own refund, support, and delivery verification rules according to the product types they sell.
          </p>
          <p>
            This page is a theme-level default and should be replaced or extended with production legal content before public launch.
          </p>
        </div>
      </div>
    </div>
  );
});
