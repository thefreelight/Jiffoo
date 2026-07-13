import React from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';
import type { AuthCallbackPageProps } from '../types/theme';

export const AuthCallbackPage = React.memo(function AuthCallbackPage({
  provider,
  isLoading,
  error,
  onRetry,
  onNavigateToHome,
}: AuthCallbackPageProps) {
  return (
    <div className="min-h-screen bg-[var(--vault-bg)] px-4 pb-16 pt-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[680px] rounded-[var(--vault-radius-lg)] border border-[var(--vault-line)] bg-[var(--vault-surface)] p-10 text-center shadow-[var(--vault-shadow-soft)]">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[1.5rem] bg-[var(--vault-primary-soft)] text-[var(--vault-primary)]">
          {isLoading ? <Loader2 className="h-10 w-10 animate-spin" /> : <ArrowRight className="h-10 w-10" />}
        </div>
        <h1 className="mt-6 text-3xl font-black tracking-[-0.04em] text-[var(--vault-ink)]">
          {isLoading ? `Finishing ${provider} sign-in...` : `${provider} sign-in result`}
        </h1>
        <p className="mx-auto mt-4 max-w-[30rem] text-sm leading-7 text-[var(--vault-copy)]">
          {error || 'The storefront is completing authentication and returning you to the shopper flow.'}
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          {error ? (
            <button
              onClick={onRetry}
              className="rounded-xl bg-[var(--vault-primary)] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--vault-primary-strong)]"
            >
              Retry
            </button>
          ) : null}
          <button
            onClick={onNavigateToHome}
            className="rounded-xl border border-[var(--vault-line)] bg-[var(--vault-surface-alt)] px-5 py-3 text-sm font-medium text-[var(--vault-ink)] transition-colors hover:bg-[var(--vault-primary-soft)]"
          >
            Return home
          </button>
        </div>
      </div>
    </div>
  );
});
