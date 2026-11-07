'use client';
import { useEffect, useState } from 'react';
import { apiClient, unwrapApiResponse } from './api';
import type { PageDeclarations } from 'shared/src/plugin-pages/labels';

export function usePluginNavigation(identity: string | undefined, pathname: string) {
  const [result, setResult] = useState<{ identity: string; pages: PageDeclarations }>();
  useEffect(() => {
    if (!identity) { setResult(undefined); return; }
    let disposed = false;
    let revision = 0;
    const refresh = async () => {
      const current = ++revision;
      try {
        const pages = unwrapApiResponse(await apiClient.get<PageDeclarations>('/admin/plugin-pages'));
        if (!disposed && current === revision) setResult({ identity, pages });
      } catch {
        if (!disposed && current === revision) setResult({ identity, pages: [] });
      }
    };
    void refresh();
    const focus = () => { void refresh(); };
    window.addEventListener('focus', focus);
    const timer = window.setInterval(focus, 30_000);
    return () => { disposed = true; window.removeEventListener('focus', focus); window.clearInterval(timer); };
  }, [identity, pathname]);
  return identity && result?.identity === identity ? result.pages.filter(plugin => plugin.pages.length > 0) : [];
}
