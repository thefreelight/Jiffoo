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
import { useToast } from '@/hooks/use-toast';
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

type FinishResult =
  | { kind: 'signed-in'; profile: unknown; announce: boolean }
  | { kind: 'linked'; returnTo: string }
  | { kind: 'failed'; message: string };

function dropHandoffFromUrl(): void {
  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
}

// Same storage contract as /auth/callback: the shared api client reads these
// localStorage keys, so the session survives the redirect.
async function loadProfile(): Promise<unknown> {
  try {
    const profileResponse = await accountApi.getProfile();
    return profileResponse.success ? profileResponse.data : null;
  } catch {
    // The session is already stored; the profile refetches on the next page.
    return null;
  }
}

async function exchangeHandoff(code: string, getHref: (path: string) => string): Promise<FinishResult> {
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
    return { kind: 'failed', message: describeError(payload?.error?.code ?? null, payload?.error?.message || 'Sign-in could not be completed') };
  }

  // Link intent (started from account settings): the browser already holds a
  // session, so the exchange only reports the completed link.
  if (payload.data?.linked === true) {
    // returnTo is already locale-prefixed and validated server-side
    // (identityReturnPath), so it must not pass through getHref again.
    const returnTo = typeof payload.data.returnTo === 'string' && payload.data.returnTo.startsWith('/')
      ? payload.data.returnTo
      : `${getHref('/profile/settings')}`;
    dropHandoffFromUrl();
    return { kind: 'linked', returnTo };
  }

  if (!payload.data?.access_token) {
    return { kind: 'failed', message: describeError(payload?.error?.code ?? null, payload?.error?.message || 'Sign-in could not be completed') };
  }

  localStorage.setItem('auth_token', payload.data.access_token);
  if (payload.data.refresh_token) {
    localStorage.setItem('refresh_token', payload.data.refresh_token);
  }
  dropHandoffFromUrl();
  return { kind: 'signed-in', profile: await loadProfile(), announce: true };
}

// The handoff code is single-use, and this page can be mounted more than once
// for one code (hydration recovery, a provider swapping its render branch).
// Every mount shares a single exchange per code, so a remount never posts the
// same code twice and never turns a finished sign-in into an error.
const exchanges = new Map<string, Promise<FinishResult>>();

function finishSignIn(code: string, getHref: (path: string) => string): Promise<FinishResult> {
  let running = exchanges.get(code);
  if (!running) {
    running = exchangeHandoff(code, getHref);
    exchanges.set(code, running);
  }
  return running;
}

// useT answers a missing key with the key itself; English covers that case.
function translated(t: ReturnType<typeof useT>, key: string, fallback: string): string {
  if (typeof t !== 'function') return fallback;
  const value = t(key);
  return typeof value === 'string' && value && value !== key ? value : fallback;
}

export default function AuthIdentityFinishPage() {
  const router = useRouter();
  const { getHref, push, locale } = useLocalizedNavigation();
  const { theme, config } = useShopTheme();
  const { setUser, setAuthenticated, setLoading } = useAuthStore();
  const { toast } = useToast();
  const t = useT();
  const [error, setError] = React.useState<string | null>(null);
  const [isCompleting, setIsCompleting] = React.useState(true);

  // One attempt per mount. The helpers below are new functions on later
  // renders (a theme finishing loading, the auth store updating), and listing
  // them as effect dependencies re-ran the attempt with the same one-time
  // code. The effect reads the latest of each through this ref instead.
  const latest = React.useRef({ getHref, router, toast, t, setUser, setAuthenticated, setLoading });
  React.useEffect(() => {
    latest.current = { getHref, router, toast, t, setUser, setAuthenticated, setLoading };
  });

  React.useEffect(() => {
    let cancelled = false;

    async function finishAuth() {
      setLoading(true);

      let result: FinishResult;
      const { code, errorCode } = readHandoffCode();
      if (errorCode) {
        result = { kind: 'failed', message: describeError(errorCode, 'Sign-in failed') };
      } else if (code) {
        try {
          result = await finishSignIn(code, latest.current.getHref);
        } catch {
          // The exchange never got an answer. Show the way back rather than
          // leaving the spinner up for good.
          result = { kind: 'failed', message: describeError('IDENTITY_UNAVAILABLE', 'Sign-in could not be completed') };
        }
      } else if (localStorage.getItem('auth_token')) {
        // No handoff in the URL. After a successful sign-in the code has been
        // dropped from it, so a signed-in visitor landing here just moves on.
        result = { kind: 'signed-in', profile: await loadProfile(), announce: false };
      } else {
        result = { kind: 'failed', message: describeError(null, 'Missing sign-in handoff code') };
      }

      setLoading(false);
      // Unmounted meanwhile: a later mount of this page owns the screen, and
      // this run only shared the exchange.
      if (cancelled) return;

      const { getHref, router, toast, t, setUser, setAuthenticated } = latest.current;
      if (result.kind === 'failed') {
        setError(result.message);
        setAuthenticated(false);
        setIsCompleting(false);
        return;
      }

      if (result.kind === 'signed-in') {
        if (result.profile) {
          // The profile endpoint answers with the store's user shape.
          setUser(result.profile as Parameters<typeof setUser>[0]);
        }
        setAuthenticated(true);
        if (result.announce) {
          toast({ title: translated(t, 'shop.auth.login.success', 'Login successful') });
        }
      }
      setIsCompleting(false);

      const redirectPath = result.kind === 'linked'
        ? result.returnTo
        : sessionStorage.getItem('redirectAfterLogin') || getHref('/profile');
      sessionStorage.removeItem('redirectAfterLogin');
      router.replace(redirectPath);
    }

    void finishAuth();

    return () => {
      cancelled = true;
    };
  }, []);

  const FinishComponent = theme?.components?.AuthIdentityFinishPage;
  if (!FinishComponent) {
    // Own colours on every element: a dark theme repaints the page background
    // but not the shell's body text colour, which left this card unreadable.
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-950 px-4 py-12">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center text-neutral-900 shadow-xl">
          {isCompleting ? (
            <>
              <span
                aria-hidden
                className="mx-auto block h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-900"
              />
              <h1 className="mt-6 text-xl font-semibold">Completing sign in</h1>
            </>
          ) : error ? (
            <>
              <h1 className="text-xl font-semibold">{error}</h1>
              <button
                type="button"
                onClick={() => push('/auth/login')}
                className="mt-6 inline-flex items-center justify-center rounded-full bg-neutral-900 px-6 py-3 text-sm font-semibold text-white"
              >
                Back to sign in
              </button>
            </>
          ) : (
            <h1 className="text-xl font-semibold">Sign in finished</h1>
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
