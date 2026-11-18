'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

type SocialProvider = 'google' | 'facebook' | 'apple';

type ProviderState = {
  google: boolean;
  facebook: boolean;
  apple: boolean;
  isLoading: boolean;
};

type ProviderStatusResponse = {
  success?: boolean;
  data?: {
    available?: boolean;
  };
};

type IdentityProvidersResponse = {
  success?: boolean;
  data?: {
    providers?: Array<{ slug?: string; label?: string; ready?: boolean }>;
  };
};

type IdentityStartResponse = {
  success?: boolean;
  data?: { authorizationUrl?: string };
  error?: { code?: string; message?: string };
};

const PROVIDERS: SocialProvider[] = ['google', 'facebook', 'apple'];

function getApiBaseUrl(): string {
  const rawValue = process.env.NEXT_PUBLIC_API_URL || '/api';
  return rawValue.replace(/\/+$/, '');
}

function getProviderSlug(provider: SocialProvider): string {
  return `${provider}-auth`;
}

// Which discovery channel answered for the current instance. The native
// identity surface (/api/v1/auth/identity/*) wins when present; the legacy
// plugin-gateway flow (extensions-store line) stays as the fallback so the
// same checkout keeps serving hosts without the native worker.
let discoveryMode: 'identity' | 'legacy' | null = null;

async function fetchIdentityProviders(): Promise<SocialProvider[]> {
  const response = await fetch(`${getApiBaseUrl()}/v1/auth/identity/providers`, {
    headers: { accept: 'application/json' },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('identity providers unavailable');
  const payload = (await response.json()) as IdentityProvidersResponse;
  const slugs = (payload.success === true ? payload.data?.providers : []) ?? [];
  const ready = new Set(
    slugs.filter((entry) => entry.ready !== false).map((entry) => entry.slug ?? ''),
  );
  return PROVIDERS.filter((provider) => ready.has(getProviderSlug(provider)));
}

async function fetchLegacyProviderAvailable(provider: SocialProvider): Promise<boolean> {
  const response = await fetch(
    `${getApiBaseUrl()}/extensions/plugin/${getProviderSlug(provider)}/api/status`,
    {
      headers: { accept: 'application/json' },
      cache: 'no-store',
    },
  );
  if (!response.ok) {
    return false;
  }
  const payload = (await response.json()) as ProviderStatusResponse;
  return payload.success === true && payload.data?.available === true;
}

async function fetchLegacyAuthorizeUrl(provider: SocialProvider, redirectUrl: string): Promise<string> {
  const response = await fetch(
    `${getApiBaseUrl()}/extensions/plugin/${getProviderSlug(provider)}/api/authorize?redirect_url=${encodeURIComponent(redirectUrl)}`,
    {
      headers: { accept: 'application/json' },
      cache: 'no-store',
    },
  );
  const payload = (await response.json().catch(() => null)) as {
    success?: boolean;
    data?: { url?: string };
    error?: { message?: string };
  } | null;

  if (!response.ok || payload?.success !== true || !payload.data?.url) {
    throw new Error(payload?.error?.message || `${provider} login is unavailable`);
  }

  return payload.data.url;
}

// Native identity start: the response's authorizationUrl carries the provider
// redirect (state/nonce/PKCE live server-side); the returnTo must be a
// locale-prefixed in-app path, which is exactly what the redirectUrl's
// pathname already is.
async function fetchIdentityAuthorizeUrl(provider: SocialProvider, redirectUrl: string): Promise<string> {
  let returnTo = '/profile';
  try {
    returnTo = new URL(redirectUrl).pathname || returnTo;
  } catch {
    // keep the default path; the server validates it anyway
  }
  const localeSegment = returnTo.split('/')[1];
  const locale = ['en', 'zh-Hans', 'zh-Hant', 'ja', 'ko', 'fr', 'de'].includes(localeSegment ?? '')
    ? localeSegment!
    : 'en';
  const response = await fetch(`${getApiBaseUrl()}/v1/auth/identity/start`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    cache: 'no-store',
    body: JSON.stringify({ providerSlug: getProviderSlug(provider), intent: 'login', returnTo, locale }),
  });
  const payload = (await response.json().catch(() => null)) as IdentityStartResponse | null;
  if (!response.ok || payload?.success !== true || !payload.data?.authorizationUrl) {
    throw new Error(payload?.error?.message || `${provider} login is unavailable`);
  }
  return payload.data.authorizationUrl;
}

export function useSocialAuthProviders() {
  const [state, setState] = useState<ProviderState>({
    google: false,
    facebook: false,
    apple: false,
    isLoading: true,
  });

  useEffect(() => {
    let cancelled = false;

    async function loadStatuses() {
      setState((current) => ({ ...current, isLoading: true }));

      let available: Partial<Record<SocialProvider, boolean>> = {};

      // 1) Native identity providers, one probe for the whole bundle.
      try {
        const providers = await fetchIdentityProviders();
        discoveryMode = 'identity';
        for (const provider of PROVIDERS) {
          available[provider] = providers.includes(provider);
        }
      } catch {
        discoveryMode = 'legacy';
        // 2) Legacy per-plugin status probes.
        const results = await Promise.all(
          PROVIDERS.map(async (provider) => {
            try {
              return [provider, await fetchLegacyProviderAvailable(provider)] as const;
            } catch {
              return [provider, false] as const;
            }
          }),
        );
        available = Object.fromEntries(results);
      }

      if (cancelled) {
        return;
      }

      setState({
        google: available.google === true,
        facebook: available.facebook === true,
        apple: available.apple === true,
        isLoading: false,
      });
    }

    void loadStatuses();

    return () => {
      cancelled = true;
    };
  }, []);

  const isAvailable = useCallback(
    (provider: SocialProvider) => state[provider] === true,
    [state],
  );

  const start = useCallback(
    async (provider: SocialProvider, redirectUrl: string) => {
      if (!isAvailable(provider)) {
        throw new Error(`${provider} login is not configured`);
      }
      const authorizeUrl = discoveryMode === 'legacy'
        ? await fetchLegacyAuthorizeUrl(provider, redirectUrl)
        : await fetchIdentityAuthorizeUrl(provider, redirectUrl);
      window.location.assign(authorizeUrl);
    },
    [isAvailable],
  );

  return useMemo(
    () => ({
      google: state.google,
      facebook: state.facebook,
      apple: state.apple,
      isLoading: state.isLoading,
      isAvailable,
      start,
    }),
    [isAvailable, start, state.apple, state.facebook, state.google, state.isLoading],
  );
}

export type { SocialProvider };
