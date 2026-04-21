import React from 'react';
import { AlertCircle, Loader2, ShieldCheck } from 'lucide-react';
import type { AuthCallbackPageProps } from 'shared/src/types/theme';

export const AuthCallbackPage = React.memo(function AuthCallbackPage({
  provider,
  isLoading,
  error,
  onRetry,
  onNavigateToHome,
}: AuthCallbackPageProps) {
  const title = error ? 'Authentication could not be completed.' : 'Finalizing your private access.';

  return (
    <div className="modelsfind-shell flex min-h-screen items-center justify-center px-4 [font-family:var(--modelsfind-body)] text-[var(--modelsfind-ink)]">
      <div className="modelsfind-panel max-w-[38rem] rounded-[2rem] border border-[var(--modelsfind-line)] p-8 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[1.6rem] bg-[var(--modelsfind-primary-soft)] text-[var(--modelsfind-primary)]">
          {error ? <AlertCircle className="h-10 w-10" /> : isLoading ? <Loader2 className="h-10 w-10 animate-spin" /> : <ShieldCheck className="h-10 w-10" />}
        </div>
        <p className="mt-6 text-[10px] uppercase tracking-[0.24em] text-[var(--modelsfind-primary)]">
          {provider ? `${provider} authentication` : 'Authentication'}
        </p>
        <h1 className="mt-4 [font-family:var(--modelsfind-display)] text-[clamp(2.5rem,7vw,4rem)] leading-[0.92] tracking-[-0.05em] text-white">
          {title}
        </h1>
        <p className="mx-auto mt-4 max-w-[30rem] text-sm leading-7 text-[var(--modelsfind-copy)]">
          {error
            ? error
            : 'Please wait while the archive verifies your sign-in and returns you to the booking experience.'}
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          {error ? (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--modelsfind-primary),var(--modelsfind-primary-strong))] px-6 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#140d16] shadow-[0_0_24px_var(--modelsfind-glow)]"
            >
              Retry
            </button>
          ) : null}
          <button
            type="button"
            onClick={onNavigateToHome}
            className="inline-flex min-h-12 items-center justify-center rounded-full border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.04)] px-6 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--modelsfind-ink)]"
          >
            Back to home
          </button>
        </div>
      </div>
    </div>
  );
});

