'use client';

/**
 * Identity Finish Page — the landing target of the native identity login
 * callback. Core 302s here with a one-time handoff code in the URL fragment
 * (60-second TTL, never sent to a server by the provider). The shell exchanges
 * the code for a shop session, hydrates the same localStorage keys as the
 * legacy /auth/callback flow, and continues to the intended destination.
 */

import React from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { accountApi } from '@/lib/api';
import { useLocalizedNavigation } from '@/hooks/use-localized-navigation';
import { useShopTheme } from '@/lib/themes/provider';
import { useT } from 'shared/src/i18n/react';

function readHandoffCode(): { code: string | null; errorCode: string | null } {
  if (typeof window === 'undefined') return { code: null, errorCode: null };
  const hash = window.location.hash.replace(/^#/, '');
  const search = window.location.search.replace(/^\?/, '');
  const code = new URLSearchParams(hash).get('code');
  const errorCode = new URLSearchParams(search).get('error');
  return { code, errorCode };
}

function describeError(code: string | null, fallback: string): string {
  switch (code) {
    case 'IDENTITY_TRANSACTION_INVALID':
      return 'This sign-in link has expired or was already used. Please start again.';
    case 'IDENTITY_EMAIL_IN_USE':
      return 'An account already exists with this email. Sign in with your original method, then link this provider from account settings.';
    case 'IDENTITY_ALREADY_LINKED':
      return 'This social account is already connected to an account. Sign in with it instead.';
    case 'IDENTITY_LAST_METHOD':
      return 'Set a password before removing your last sign-in method.';
    case 'IDENTITY_ACCOUNT_UNAVAILABLE':
      return 'This account cannot use social sign-in.';
    case 'IDENTITY_CANCELLED':
      return 'Sign-in was cancelled. You can try again.';
    case 'IDENTITY_RATE_LIMITED':
      return 'Too many attempts. Please wait a moment and try again.';
    case 'IDENTITY_UNAVAILABLE':
      return 'Social sign-in is temporarily unavailable.';
    case 'IDENTITY_REJECTED':
      return 'The provider did not verify this sign-in. Please try again.';
    default:
      return fallback;
  }
}

export default function AuthIdentityFinishPage() {
  const router = useRouter();
  const { getHref, push, locale } = useLocalizedNavigation();
  const { theme, config } = useShopTheme();
  const { setUser, setAuthenticated, setLoading } = useAuthStore();
  const t = useT();
  const [error, setError] = React.useState<string | null>(null);
  const [isCompleting, setIsCompleting] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;

    async function finishAuth() {
      setIsCompleting(true);
      setLoading(true);

      try {
        const { code, errorCode } = readHandoffCode();
        if (errorCode) throw new Error(describeError(errorCode, 'Sign-in failed'));

        if (!code) throw new Error(describeError(null, 'Missing sign-in handoff code'));

        const response = await fetch(`${(process.env.NEXT_PUBLIC_API_URL || '/api').replace(/\/+$/, '')}/v1/auth/identity/exchange`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', accept: 'application/json' },
          cache: 'no-store',
          body: JSON.stringify({ code }),
        });
        const payload = (await response.json().catch(() => null)) as {
          success?: boolean;
          data?: { user?: unknown; access_token?: string; refresh_token?: string; linked?: boolean; returnTo?: string };
          error?: { code?: string; message?: string };
        } | null;

        if (!response.ok || payload?.success !== true) {
          throw new Error(describeError(payload?.error?.code ?? null, payload?.error?.message || 'Sign-in could not be completed'));
        }

        // Link intent (started from account settings): the browser already
        // holds a session, so the exchange only reports the completed link.
        // Drop the one-time handoff from the URL so a refresh cannot replay it.
        if (payload.data?.linked === true) {
          // returnTo is already locale-prefixed and validated server-side
          // (identityReturnPath), so it must not pass through getHref again.
          const returnTo = typeof payload.data.returnTo === 'string' && payload.data.returnTo.startsWith('/')
            ? payload.data.returnTo
            : `${getHref('/profile/settings')}`;
          window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
          if (!cancelled) {
            router.replace(returnTo);
          }
          return;
        }

        if (!payload.data?.access_token) {
          throw new Error(describeError(payload?.error?.code ?? null, payload?.error?.message || 'Sign-in could not be completed'));
        }

        // Same storage contract as /auth/callback: the shared api client reads
        // these localStorage keys, so the session survives the redirect.
        localStorage.setItem('auth_token', payload.data.access_token);
        if (payload.data.refresh_token) {
          localStorage.setItem('refresh_token', payload.data.refresh_token);
        }

        const profileResponse = await accountApi.getProfile();
        if (profileResponse.success && profileResponse.data) {
          setUser(profileResponse.data as any);
        }
        setAuthenticated(true);

        if (!cancelled) {
          const redirectPath = sessionStorage.getItem('redirectAfterLogin');
          sessionStorage.removeItem('redirectAfterLogin');
          router.replace(redirectPath || getHref('/profile'));
        }
      } catch (finishError: any) {
        if (!cancelled) {
          setError(finishError?.message || 'Sign-in could not be completed');
          setAuthenticated(false);
        }
      } finally {
        setLoading(false);
        if (!cancelled) {
          setIsCompleting(false);
        }
      }
    }

    void finishAuth();

    return () => {
      cancelled = true;
    };
  }, [getHref, router, setAuthenticated, setLoading, setUser]);

  const FinishComponent = theme?.components?.AuthIdentityFinishPage;
  if (!FinishComponent) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 text-center">
        <div>
          <h1 className="text-xl font-semibold">{isCompleting ? 'Completing sign in' : error || 'Sign in finished'}</h1>
          {!isCompleting && (
            <button className="mt-4 underline" type="button" onClick={() => push('/auth/login')}>
              Back to sign in
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <FinishComponent
      isLoading={isCompleting}
      error={isCompleting ? null : error}
      config={config}
      locale={locale}
      t={t}
      onRetry={() => push('/auth/login')}
      onNavigateToHome={() => push('/')}
    />
  );
}
