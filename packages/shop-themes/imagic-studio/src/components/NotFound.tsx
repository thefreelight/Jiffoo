'use client';

import { ArrowLeft, Search } from 'lucide-react';
import type { NotFoundProps } from 'shared/src/types/theme';

import { StudioMain, StudioPage, StudioPanel } from './StudioShell';

export function NotFound({ route, message, onGoHome }: NotFoundProps) {
  return (
    <StudioPage activeNav="explore">
      <StudioMain>
        <StudioPanel className="mx-auto max-w-3xl text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[color:var(--imagic-primary-soft)] text-[color:var(--imagic-primary)]">
            <Search className="h-9 w-9" />
          </div>
          <p className="mt-6 text-sm uppercase tracking-[0.26em] text-[color:var(--imagic-muted)]">404</p>
          <h1 className="mt-3 text-[clamp(2.4rem,5vw,4.4rem)] font-semibold tracking-[-0.06em] text-[color:var(--imagic-ink)]">Page not found.</h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-8 text-[color:var(--imagic-ink-soft)]">
            {message || `We couldn't find ${route ? `the route "${route}"` : 'that page'} inside the imagic workspace.`}
          </p>
          <button type="button" onClick={onGoHome} className="imagic-button-primary mt-6 inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold text-white shadow-[var(--imagic-primary-shadow)]">
            <ArrowLeft className="h-4 w-4" />
            Back home
          </button>
        </StudioPanel>
      </StudioMain>
    </StudioPage>
  );
}
