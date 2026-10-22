'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiClient, unwrapApiResponse } from '@/lib/api';
import { pluginAdminPath, pluginPageLabels, type PageDeclarations, type PluginPageLocale } from 'shared/src/plugin-pages/labels';

export function DeclaredPluginNavigation({ slug, locale, enabled }: { slug: string; locale: PluginPageLocale; enabled: boolean }) {
  const [declarations, setDeclarations] = useState<PageDeclarations>([]);
  useEffect(() => {
    let disposed = false;
    async function read() {
      if (!enabled) { setDeclarations([]); return; }
      try {
        const pages = unwrapApiResponse(await apiClient.get<PageDeclarations>(`/admin/plugin-pages/${slug}`));
        if (!disposed) setDeclarations(pages);
      } catch { if (!disposed) setDeclarations([]); }
    }
    void read();
    const timer = setInterval(() => void read(), 30_000);
    return () => { disposed = true; clearInterval(timer); };
  }, [slug, enabled]);
  if (!enabled || !declarations.length) return null;
  return <nav aria-label={pluginPageLabels[locale].navigation} className="flex flex-wrap gap-4">
    {declarations.flatMap(plugin => plugin.pages.map(page => <Link key={page.id} href={`/${locale}${pluginAdminPath(plugin.slug, page.path)}`}>{page.title[locale]}</Link>))}
  </nav>;
}
