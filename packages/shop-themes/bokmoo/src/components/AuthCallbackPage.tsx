import React from 'react';
import { AlertTriangle, Loader2, ShieldCheck } from 'lucide-react';
import type { AuthCallbackPageProps } from 'shared/src/types/theme';
import { resolveBokmooSiteConfig } from '../site';

const FOCUS_VISIBLE_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bokmoo-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bokmoo-bg)]';

export function AuthCallbackPage({
  isLoading,
  error,
  config,
  onRetry,
  onNavigateToHome,
}: AuthCallbackPageProps) {
  const site = resolveBokmooSiteConfig(config);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--bokmoo-bg)] px-4 py-12 text-[var(--bokmoo-ink)]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,color-mix(in_oklab,var(--bokmoo-gold)_18%,transparent),transparent_26%),linear-gradient(180deg,var(--bokmoo-bg),color-mix(in_oklab,var(--bokmoo-bg)_84%,black))]" />
        <div className="absolute inset-0 opacity-40 [background-image:var(--bokmoo-grid)] [background-size:72px_72px]" />
      </div>

      <section className="relative w-full max-w-[30rem] rounded-[1.45rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_22%,transparent)] bg-[linear-gradient(180deg,color-mix(in_oklab,var(--bokmoo-bg-elevated)_94%,white),var(--bokmoo-bg-elevated))] p-5 shadow-[var(--bokmoo-shadow)] sm:p-7">
        <div className="rounded-[1.1rem] border border-[var(--bokmoo-line)] bg-[color:oklch(0.055_0.006_75_/_0.78)] p-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[1rem] border border-[var(--bokmoo-line)] bg-[color:color-mix(in_oklab,var(--bokmoo-gold)_12%,transparent)] text-[var(--bokmoo-gold)]">
            {error ? <AlertTriangle className="h-7 w-7" /> : isLoading ? <Loader2 className="h-7 w-7 animate-spin" /> : <ShieldCheck className="h-7 w-7" />}
          </div>
          <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.24em] text-[var(--bokmoo-gold)]">
            {site.brandName.toUpperCase()} account
          </p>
          <h1 className="mt-3 text-3xl font-semibold leading-none tracking-[-0.05em] text-[var(--bokmoo-ink)]">
            {error ? 'Authentication failed' : 'Completing sign in'}
          </h1>
          <p className="mt-4 text-sm leading-6 text-[var(--bokmoo-copy)]">
            {error || 'Securing your session and returning you to the BOKMOO storefront.'}
          </p>

          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={onRetry}
              className={`inline-flex min-h-12 items-center justify-center rounded-[0.95rem] border border-[var(--bokmoo-line)] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_86%,black)] px-4 text-sm font-semibold text-[var(--bokmoo-ink)] transition-colors hover:border-[var(--bokmoo-gold)] hover:text-[var(--bokmoo-gold)] ${FOCUS_VISIBLE_RING}`}
            >
              Back to sign in
            </button>
            <button
              type="button"
              onClick={onNavigateToHome}
              className={`inline-flex min-h-12 items-center justify-center rounded-[0.95rem] bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_88%,white),color-mix(in_oklab,var(--bokmoo-gold)_64%,black))] px-4 text-sm font-black uppercase tracking-[0.16em] text-[var(--bokmoo-bg)] ${FOCUS_VISIBLE_RING}`}
            >
              Home
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
