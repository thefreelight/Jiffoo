import React from 'react';
import { Home } from 'lucide-react';
import type { NotFoundProps } from 'shared/src/types/theme';

export const NotFound = React.memo(function NotFound({ route, message, onGoHome }: NotFoundProps) {
  return (
    <div className="modelsfind-shell flex min-h-screen items-center justify-center px-4 [font-family:var(--modelsfind-body)] text-[var(--modelsfind-ink)]">
      <div className="modelsfind-panel max-w-[42rem] rounded-[2rem] border border-[var(--modelsfind-line)] p-8 text-center">
        <p className="[font-family:var(--modelsfind-display)] text-[5rem] leading-none tracking-[-0.06em] text-[var(--modelsfind-primary)]">
          404
        </p>
        <h1 className="mt-4 [font-family:var(--modelsfind-display)] text-[clamp(2.6rem,7vw,4rem)] leading-[0.92] tracking-[-0.05em] text-white">
          This page slipped out of the archive.
        </h1>
        <p className="mx-auto mt-4 max-w-[30rem] text-sm leading-7 text-[var(--modelsfind-copy)]">
          {message || `We couldn't find${route ? ` “${route}”` : ' that destination'} in the current private directory.`}
        </p>
        <button
          type="button"
          onClick={onGoHome}
          className="mt-8 inline-flex min-h-12 items-center gap-2 rounded-full bg-[linear-gradient(135deg,var(--modelsfind-primary),var(--modelsfind-primary-strong))] px-6 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#140d16] shadow-[0_0_24px_var(--modelsfind-glow)]"
        >
          <Home className="h-4 w-4" />
          Back to home
        </button>
      </div>
    </div>
  );
});

