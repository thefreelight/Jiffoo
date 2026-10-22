'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { PluginPageShell, type ShellTransport } from 'shared/src/plugin-pages/shell';
import { pluginPageLabels, pluginShopPath, type PageDeclaration, type PageDeclarations } from 'shared/src/plugin-pages/labels';
import type { ShopLocale } from '@/lib/locale';

export function ShopPluginPage({ slug, page, declarations, locale, currency, storeName }: {
  slug: string; page: PageDeclaration; declarations: PageDeclarations; locale: ShopLocale; currency: string; storeName: string;
}) {
  const router = useRouter();
  const transport: ShellTransport = useCallback(async (path, method, body) => {
    const response = await fetch(`/bff${path}`, { method, cache: 'no-store', headers: { 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.error?.code ?? 'REQUEST_FAILED');
    return result.data;
  }, []);
  const canonical = `/${locale}${pluginShopPath(slug, page.path)}`;
  return <main className="mx-auto max-w-7xl px-4 py-8"><PluginPageShell slug={slug} pageId={page.id} title={page.title[locale]}
    surface="shop" locale={locale} currency={currency} store={{ id: 'system', name: storeName, url: '/' }} labels={pluginPageLabels[locale]}
    transport={transport} allowedPaths={['/products', '/account', '/account/orders', '/cart',
      ...declarations.flatMap(plugin => plugin.pages.map(candidate => pluginShopPath(plugin.slug, candidate.path)))]}
    navigate={path => router.push(`/${locale}${path}`)} signIn={() => router.push(`/${locale}/login?next=${encodeURIComponent(canonical)}`)}
    checkout={() => router.push(`/${locale}/checkout`)} /></main>;
}
