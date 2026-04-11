import React from 'react';
import { ArrowLeft, SearchX } from 'lucide-react';
import type { NotFoundProps } from '../types/theme';

export const NotFound = React.memo(function NotFound({
  route,
  message,
  onGoHome,
}: NotFoundProps) {
  return (
    <div className="min-h-screen bg-[var(--vault-bg)] px-4 pb-16 pt-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[760px] rounded-[var(--vault-radius-lg)] border border-[var(--vault-line)] bg-[var(--vault-surface)] p-10 text-center shadow-[var(--vault-shadow-soft)]">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[1.5rem] bg-[var(--vault-primary-soft)] text-[var(--vault-primary)]">
          <SearchX className="h-10 w-10" />
        </div>
        <h1 className="mt-6 text-3xl font-black tracking-[-0.04em] text-[var(--vault-ink)]">
          Page not found
        </h1>
        <p className="mx-auto mt-4 max-w-[34rem] text-sm leading-7 text-[var(--vault-copy)]">
          {message || `The requested path ${route ? `"${route}"` : ''} is not available in this storefront.`}
        </p>
        <button
          onClick={onGoHome}
          className="mt-8 inline-flex items-center gap-2 rounded-xl bg-[var(--vault-primary)] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--vault-primary-strong)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </button>
      </div>
    </div>
  );
});
