import React from 'react';
import type { PrivacyPageProps } from '../types/theme';

export const PrivacyPage = React.memo(function PrivacyPage(_props: PrivacyPageProps) {
  return (
    <div className="min-h-screen bg-[var(--vault-bg)] px-4 pb-16 pt-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[900px] rounded-[var(--vault-radius-lg)] border border-[var(--vault-line)] bg-[var(--vault-surface)] p-8 shadow-[var(--vault-shadow-soft)]">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--vault-copy-soft)]">Privacy</p>
        <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] text-[var(--vault-ink)]">
          Privacy policy
        </h1>
        <div className="mt-6 space-y-4 text-sm leading-7 text-[var(--vault-copy)]">
          <p>
            This storefront collects the minimum account and order data needed to process payments, attach digital delivery records, and provide post-purchase access in the order center.
          </p>
          <p>
            Sensitive fulfillment artifacts such as codes, credentials, and download links are exposed only through the authenticated order flow or approved guest-order access path.
          </p>
          <p>
            Merchants should extend this page with their own legal and jurisdiction-specific privacy language before operating a production storefront.
          </p>
        </div>
      </div>
    </div>
  );
});
