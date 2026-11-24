import React from 'react';
import { Apple, Chrome, Facebook } from 'lucide-react';
import type { SocialAuthStatus } from 'shared/src/types/theme';

export type BokmooSocialProvider = 'google' | 'apple' | 'facebook';

const PROVIDERS: BokmooSocialProvider[] = ['google', 'apple', 'facebook'];

/**
 * Social sign-in entries this instance can actually serve. The host reports
 * which providers are configured through `socialAuthStatus`; an entry renders
 * only when it is both reported ready and wired to a handler. Nothing renders
 * while the probe is in flight, so a button never shows up only to answer
 * "login is not configured".
 */
export function readySocialProviders(
  status: SocialAuthStatus | undefined,
  handlers: Partial<Record<BokmooSocialProvider, unknown>>,
): BokmooSocialProvider[] {
  if (status?.isLoading) return [];
  return PROVIDERS.filter((provider) =>
    Boolean(handlers[provider]) && (status ? status[provider] === true : true),
  );
}

const BUTTON_CLASS =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-[0.95rem] border border-[var(--bokmoo-line)] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_86%,black)] px-4 text-sm font-semibold text-[var(--bokmoo-ink)] transition-colors hover:border-[var(--bokmoo-gold)] hover:text-[var(--bokmoo-gold)] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bokmoo-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bokmoo-bg)]';

// The storefront CSS is compiled from source scans, so the column class has
// to stay a literal — a class assembled at runtime would not exist.
const GRID_COLUMNS: Record<number, string> = { 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3' };

interface SocialAuthButtonsProps {
  providers: BokmooSocialProvider[];
  isLoading: boolean;
  onGoogle: () => void;
  onApple?: () => void;
  onFacebook?: () => void;
  className?: string;
}

export function SocialAuthButtons({
  providers,
  isLoading,
  onGoogle,
  onApple,
  onFacebook,
  className = '',
}: SocialAuthButtonsProps) {
  if (providers.length === 0) return null;

  return (
    <div className={`grid gap-3 ${GRID_COLUMNS[providers.length] ?? ''} ${className}`}>
      {providers.includes('google') ? (
        <button type="button" onClick={onGoogle} className={BUTTON_CLASS} disabled={isLoading}>
          <Chrome className="h-4 w-4" />
          Google
        </button>
      ) : null}
      {providers.includes('apple') && onApple ? (
        <button type="button" onClick={onApple} className={BUTTON_CLASS} disabled={isLoading}>
          <Apple className="h-4 w-4" />
          Apple
        </button>
      ) : null}
      {providers.includes('facebook') && onFacebook ? (
        <button type="button" onClick={onFacebook} className={BUTTON_CLASS} disabled={isLoading}>
          <Facebook className="h-4 w-4" />
          Facebook
        </button>
      ) : null}
    </div>
  );
}
