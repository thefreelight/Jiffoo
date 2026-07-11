'use client';

import { ArrowRight, LoaderCircle, TriangleAlert } from 'lucide-react';
import type { AuthCallbackPageProps } from 'shared/src/types/theme';

import { StudioMain, StudioPage, StudioPanel } from './StudioShell';

export function AuthCallbackPage({ provider, isLoading, error, onRetry, onNavigateToHome }: AuthCallbackPageProps) {
  return (
    <StudioPage activeNav="assets">
      <StudioMain>
        <StudioPanel className="mx-auto max-w-2xl text-center">
          <div className={`mx-auto flex h-20 w-20 items-center justify-center rounded-full ${error ? 'bg-rose-400/14 text-rose-300' : 'bg-[color:var(--imagic-primary-soft)] text-[color:var(--imagic-primary)]'}`}>
            {error ? <TriangleAlert className="h-9 w-9" /> : <LoaderCircle className="h-9 w-9 animate-spin" />}
          </div>
          <h1 className="mt-6 text-[clamp(2.2rem,5vw,4rem)] font-semibold tracking-[-0.06em] text-[color:var(--imagic-ink)]">
            {error ? 'Authentication failed.' : `Completing ${provider} sign in...`}
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base leading-8 text-[color:var(--imagic-ink-soft)]">
            {error || 'Please wait while we connect your account back into the imagic workspace.'}
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            {error ? (
              <button type="button" onClick={onRetry} className="imagic-button-primary inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold text-white shadow-[var(--imagic-primary-shadow)]">
                Retry
              </button>
            ) : null}
            <button type="button" onClick={onNavigateToHome} className="inline-flex items-center justify-center gap-2 rounded-full border border-[color:var(--imagic-line)] bg-[color:var(--imagic-surface-elevated)] px-5 py-3 text-sm font-medium text-[color:var(--imagic-ink)] transition hover:-translate-y-0.5">
              <ArrowRight className="h-4 w-4" />
              Go home
            </button>
          </div>
        </StudioPanel>
      </StudioMain>
    </StudioPage>
  );
}
