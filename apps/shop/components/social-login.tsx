'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { ShopLocale } from '@/lib/locale';
import { storefrontMessages } from '@/lib/storefront-messages';
import { safeNextPath } from '@/lib/auth-contract';
import type { IdentityProvider, IdentityConnection } from '@/lib/social-auth';
import { canUnlinkIdentity } from '@/lib/social-auth';

export function SocialLogin({ locale, next, linking = false }: { locale: ShopLocale; next: string; linking?: boolean }) {
  const t = storefrontMessages(locale).socialAuth;
  const [providers, setProviders] = useState<IdentityProvider[]>([]);
  const [connections, setConnections] = useState<IdentityConnection[]>([]);
  const [hasPassword, setHasPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch('/bff/auth/identity/providers', { cache: 'no-store', ...(signal ? { signal } : {}) });
    if (!response.ok) throw new Error('IDENTITY_UNAVAILABLE');
    const body = await response.json() as { data: { providers: IdentityProvider[] } };
    if (signal?.aborted) return;
    setProviders(body.data.providers.filter(provider => provider.ready));
    if (linking) {
      const linked = await fetch('/bff/auth/identity/connections', { cache: 'no-store', ...(signal ? { signal } : {}) });
      if (!linked.ok) throw new Error('IDENTITY_UNAVAILABLE');
      const data = await linked.json() as { data: { hasPassword: boolean; identities: IdentityConnection[] } };
      if (signal?.aborted) return;
      setConnections(data.data.identities);
      setHasPassword(data.data.hasPassword);
    }
  }, [linking]);
  useEffect(() => { const controller = new AbortController(); void load(controller.signal).catch(() => { if (!controller.signal.aborted) setError(t.unavailable); }); return () => controller.abort(); }, [load, t.unavailable]);
  async function start(provider: IdentityProvider) {
    setBusy(true); setError('');
    try {
      const response = await fetch(`/bff/auth/identity/${encodeURIComponent(provider.slug)}/start`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intent: linking ? 'link' : 'login', returnTo: safeNextPath(next, locale), locale }),
      });
      const body = await response.json() as { data?: { authorizationUrl: string } };
      if (!response.ok || !body.data) throw new Error('IDENTITY_UNAVAILABLE');
      window.location.assign(body.data.authorizationUrl);
    } catch { setError(t.unavailable); } finally { setBusy(false); }
  }
  async function unlink(connection: IdentityConnection) {
    setBusy(true); setError('');
    try {
      const response = await fetch(`/bff/auth/identity/connections/${encodeURIComponent(connection.id)}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('IDENTITY_UNAVAILABLE');
      await load();
    } catch { setError(t.unlinkFailed); } finally { setBusy(false); }
  }
  return <section aria-label={linking ? t.connections : t.signIn} className="mt-6 space-y-3">
    {linking && <><h2 className="font-semibold">{t.connections}</h2><p className="text-sm text-subtle">{t.linkHint}</p></>}
    {connections.map(connection => <div key={connection.id} className="flex items-center justify-between gap-3"><span>{connection.label}{!connection.available && <span className="ml-2 text-sm text-subtle">{t.connectionUnavailable}</span>}</span><button type="button" disabled={busy || !canUnlinkIdentity(hasPassword, connections, connection.id)} onClick={() => void unlink(connection)} className="underline disabled:opacity-45">{t.unlink}</button></div>)}
    {providers.filter(provider => !linking || !connections.some(connection => connection.providerSlug === provider.slug)).map(provider => <button type="button" key={provider.slug} disabled={busy} onClick={() => void start(provider)} className="h-11 w-full rounded-md border border-line px-4 disabled:opacity-45">{(linking ? t.linkProvider : t.continueWith).replace('{provider}', provider.label)}</button>)}
    {linking && !hasPassword && connections.length > 0 && <p className="text-sm text-subtle">{t.lastMethod} <Link href={`/${locale}/forgot-password`} className="underline">{t.setPassword}</Link></p>}
    {error && <p role="status" className="text-sm text-subtle">{error}</p>}
  </section>;
}
