'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

type SocialProvider = 'google' | 'apple';

type ProviderState = {
  google: boolean;
  apple: boolean;
  isLoading: boolean;
};

type ProviderStatusResponse = {
  success?: boolean;
  data?: {
    available?: boolean;
  };
};

const PROVIDERS: SocialProvider[] = ['google', 'apple'];

function getApiBaseUrl(): string {
  const rawValue = process.env.NEXT_PUBLIC_API_URL || '/api';
  return rawValue.replace(/\/+$/, '');
}

function getProviderSlug(provider: SocialProvider): string {
  return `${provider}-auth`;
}

async function fetchProviderAvailable(provider: SocialProvider): Promise<boolean> {
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

async function fetchAuthorizeUrl(provider: SocialProvider, redirectUrl: string): Promise<string> {
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

export function useSocialAuthProviders() {
  const [state, setState] = useState<ProviderState>({
    google: false,
    apple: false,
    isLoading: true,
  });

  useEffect(() => {
    let cancelled = false;

    async function loadStatuses() {
      setState((current) => ({ ...current, isLoading: true }));

      const results = await Promise.all(
        PROVIDERS.map(async (provider) => {
          try {
            return [provider, await fetchProviderAvailable(provider)] as const;
          } catch {
            return [provider, false] as const;
          }
        }),
      );

      if (cancelled) {
        return;
      }

      setState({
        google: results.find(([provider]) => provider === 'google')?.[1] === true,
        apple: results.find(([provider]) => provider === 'apple')?.[1] === true,
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

      const authorizeUrl = await fetchAuthorizeUrl(provider, redirectUrl);
      window.location.assign(authorizeUrl);
    },
    [isAvailable],
  );

  return useMemo(
    () => ({
      google: state.google,
      apple: state.apple,
      isLoading: state.isLoading,
      isAvailable,
      start,
    }),
    [isAvailable, start, state.apple, state.google, state.isLoading],
  );
}

export type { SocialProvider };
