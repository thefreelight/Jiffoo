'use client';

/**
 * Social sign-in connections for the account settings page: list the
 * identities linked to the signed-in customer, unlink one, or start the
 * provider OAuth flow with intent=link (the finish page completes the link
 * and returns to settings). Read-only mirrors of the native identity surface
 * (GET /api/v1/auth/identity/connections, DELETE /connections/:id,
 * POST /start with intent=link).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

export interface ConnectedIdentity {
  id: string;
  providerSlug: string;
  label: string;
  createdAt: string;
}

export interface LinkableProvider {
  providerSlug: string;
  label: string;
}

interface ConnectionsResponse {
  success?: boolean;
  data?: {
    identities?: Array<{
      id?: string;
      providerSlug?: string;
      issuer?: string;
      subject?: string;
      createdAt?: string;
      label?: string;
      available?: boolean;
    }>;
  };
  error?: { code?: string; message?: string };
}

interface ProvidersResponse {
  success?: boolean;
  data?: {
    providers?: Array<{ slug?: string; label?: string; ready?: boolean }>;
  };
}

interface StartResponse {
  success?: boolean;
  data?: { authorizationUrl?: string };
  error?: { code?: string; message?: string };
}

function getApiBaseUrl(): string {
  const rawValue = process.env.NEXT_PUBLIC_API_URL || '/api';
  return rawValue.replace(/\/+$/, '');
}

function getAuthHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? window.localStorage.getItem('auth_token') : null;
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    accept: 'application/json',
  };
  if (token) headers.authorization = `Bearer ${token}`;
  return headers;
}

async function fetchConnections(): Promise<ConnectedIdentity[]> {
  const response = await fetch(`${getApiBaseUrl()}/v1/auth/identity/connections`, {
    headers: getAuthHeaders(),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('connections unavailable');
  const payload = (await response.json().catch(() => null)) as ConnectionsResponse | null;
  if (payload?.success !== true) throw new Error(payload?.error?.message || 'connections unavailable');
  return (payload.data?.identities ?? [])
    .filter((entry): entry is { id: string; providerSlug: string; label?: string; createdAt?: string } =>
      Boolean(entry.id && entry.providerSlug))
    .map((entry) => ({
      id: entry.id,
      providerSlug: entry.providerSlug,
      label: entry.label ?? entry.providerSlug,
      createdAt: entry.createdAt ?? '',
    }));
}

async function fetchLinkableProviders(connected: ConnectedIdentity[]): Promise<LinkableProvider[]> {
  const response = await fetch(`${getApiBaseUrl()}/v1/auth/identity/providers`, {
    headers: { accept: 'application/json' },
    cache: 'no-store',
  });
  if (!response.ok) return [];
  const payload = (await response.json().catch(() => null)) as ProvidersResponse | null;
  const providers = (payload?.success === true ? payload.data?.providers : []) ?? [];
  const connectedSlugs = new Set(connected.map((entry) => entry.providerSlug));
  return providers
    .filter((entry) => entry.ready !== false && Boolean(entry.slug) && !connectedSlugs.has(entry.slug!))
    .map((entry) => ({ providerSlug: entry.slug!, label: entry.label ?? entry.slug! }));
}

async function unlinkIdentity(identityId: string): Promise<void> {
  const response = await fetch(`${getApiBaseUrl()}/v1/auth/identity/connections/${encodeURIComponent(identityId)}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
    cache: 'no-store',
  });
  const payload = (await response.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null;
  if (!response.ok) {
    const code = payload?.error?.code;
    if (code === 'IDENTITY_LAST_METHOD') {
      throw new Error('Set a password before removing your last sign-in method.');
    }
    throw new Error(payload?.error?.message || 'Could not remove this sign-in method');
  }
}

async function beginLink(providerSlug: string, locale: string): Promise<void> {
  const response = await fetch(`${getApiBaseUrl()}/v1/auth/identity/start`, {
    method: 'POST',
    headers: getAuthHeaders(),
    cache: 'no-store',
    body: JSON.stringify({
      providerSlug,
      intent: 'link',
      returnTo: `/${locale}/profile/settings`,
      locale,
    }),
  });
  const payload = (await response.json().catch(() => null)) as StartResponse | null;
  if (!response.ok || payload?.success !== true || !payload.data?.authorizationUrl) {
    throw new Error(payload?.error?.message || `${providerSlug} linking is unavailable`);
  }
  window.location.assign(payload.data.authorizationUrl);
}

export function useIdentityConnections(locale: string) {
  const [connected, setConnected] = useState<ConnectedIdentity[]>([]);
  const [linkable, setLinkable] = useState<LinkableProvider[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const identities = await fetchConnections();
      setConnected(identities);
      setLinkable(await fetchLinkableProviders(identities));
    } catch {
      // 401 (signed out) or no native identity surface: render nothing rather
      // than an error block on a page that works without the section.
      setConnected([]);
      setLinkable([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const unlink = useCallback(async (identityId: string) => {
    setBusyId(identityId);
    setError(null);
    try {
      await unlinkIdentity(identityId);
      await refresh();
    } catch (unlinkError) {
      setError(unlinkError instanceof Error ? unlinkError.message : 'Could not remove this sign-in method');
    } finally {
      setBusyId(null);
    }
  }, [refresh]);

  const beginLinkProvider = useCallback(async (providerSlug: string) => {
    setBusyId(providerSlug);
    setError(null);
    try {
      await beginLink(providerSlug, locale);
    } catch (linkError) {
      setError(linkError instanceof Error ? linkError.message : 'Linking is unavailable');
      setBusyId(null);
    }
  }, [locale]);

  return useMemo(
    () => ({
      connected,
      linkable,
      isLoading,
      error,
      busyId,
      refresh,
      unlink,
      beginLinkProvider,
    }),
    [beginLinkProvider, busyId, connected, error, isLoading, linkable, refresh, unlink],
  );
}
