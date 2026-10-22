'use client';

import { useCallback, useEffect, useState } from 'react';
import { notFound, useRouter } from 'next/navigation';
import { apiClient, unwrapApiResponse } from '@/lib/api';
import { PluginPageShell, type ShellTransport } from 'shared/src/plugin-pages/shell';
import { pluginAdminPath, pluginPageLabels, type PageDeclarations, type PluginPageLocale } from 'shared/src/plugin-pages/labels';

export function DeclaredPluginPage({ slug, path, locale }: { slug: string; path: string; locale: PluginPageLocale }) {
  const router = useRouter();
  const [declarations, setDeclarations] = useState<PageDeclarations | null>(null);
  const [error, setError] = useState(false);
  const [missing, setMissing] = useState(false);
  const [store, setStore] = useState<{ storeName: string; currency: string } | null>(null);
  const labels = pluginPageLabels[locale];
  const transport: ShellTransport = useCallback(async (url, method, body) => {
    return unwrapApiResponse(await apiClient.request({ url, method, data: body }));
  }, []);
  useEffect(() => {
    let disposed = false;
    setDeclarations(null); setError(false); setMissing(false);
    void Promise.all([apiClient.get<PageDeclarations>(`/admin/plugin-pages/${slug}`), apiClient.get<{ storeName: string; currency: string }>('/store/context')]).then(([pages, context]) => {
      const data = unwrapApiResponse(pages), config = unwrapApiResponse(context);
      if (!disposed) { setDeclarations(data); setStore(config); }
    }).catch((error: { response?: { status?: number } }) => {
      if (!disposed) { if (error.response?.status === 404) setMissing(true); else setError(true); }
    });
    return () => { disposed = true; };
  }, [slug]);
  const page = declarations?.find(plugin => plugin.slug === slug)?.pages.find(candidate => candidate.path === path);
  if (missing || declarations && !page) notFound();
  if (error) return <p role="alert">{labels.unavailable}</p>;
  if (!page || !declarations || !store) return <p role="status">{labels.loading}</p>;
  const canonical = `/${locale}${pluginAdminPath(slug, page.path)}`;
  return <PluginPageShell slug={slug} pageId={page.id} title={page.title[locale]} surface="admin" locale={locale}
    currency={store.currency} store={{ id: 'system', name: store.storeName, url: '/' }} labels={labels} transport={transport}
    allowedPaths={declarations.flatMap(plugin => plugin.pages.map(candidate => pluginAdminPath(plugin.slug, candidate.path)))}
    navigate={target => router.push(`/${locale}${target}`)}
    signIn={() => { sessionStorage.setItem('redirectPath', canonical); router.push(`/${locale}/auth/login`); }} checkout={() => undefined} />;
}
