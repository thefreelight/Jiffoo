'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { pluginPageLabels, pluginShopPath, type PageDeclarations } from 'shared/src/plugin-pages/labels';
import type { ShopLocale } from '@/lib/locale';

export function PluginNavigation({ locale, placement }: { locale: ShopLocale; placement: 'header-nav' | 'account-menu' | 'footer' }) {
  const [plugins, setPlugins] = useState<PageDeclarations>([]);
  useEffect(() => {
    let disposed = false;
    const controller = new AbortController();
    async function read() {
      try {
        const response = await fetch('/bff/plugin-pages', { cache: 'no-store', credentials: 'omit', signal: controller.signal });
        if (!response.ok) throw new Error('Unavailable');
        const result = await response.json();
        if (!disposed) setPlugins(result.data);
      } catch { if (!disposed) setPlugins([]); }
    }
    void read();
    const timer = setInterval(() => void read(), 30_000);
    window.addEventListener('focus', read);
    return () => { disposed = true; controller.abort(); clearInterval(timer); window.removeEventListener('focus', read); };
  }, []);
  const links = plugins.flatMap(plugin => plugin.pages.filter(page => page.placements?.includes(placement)).map(page => ({
    href: `/${locale}${pluginShopPath(plugin.slug, page.path)}`, title: page.title[locale],
  })));
  if (!links.length) return null;
  return <nav aria-label={pluginPageLabels[locale].navigation} className="flex flex-wrap gap-3 text-sm">
    {links.map(link => <Link key={link.href} href={link.href}>{link.title}</Link>)}
  </nav>;
}
