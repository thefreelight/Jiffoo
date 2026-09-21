'use client';

import Link from 'next/link';
import { useLocale } from 'shared/src/i18n/react';
import { useInstalledPlugins, useTogglePlugin } from '@/lib/hooks/use-api';
import { Button } from '@/components/ui/button';

export function PluginsManager() {
  const locale = useLocale();
  const { data } = useInstalledPlugins();
  const toggle = useTogglePlugin();
  return <section>{(data?.items || []).map((plugin) => <div key={plugin.slug}><span>{plugin.name}</span><Button onClick={() => toggle.mutate({ slug: plugin.slug, enabled: !plugin.enabled })}>{plugin.enabled ? 'Disable' : 'Enable'}</Button><Button asChild><Link href={`/${locale}/plugins/${plugin.slug}`}>Manage</Link></Button></div>)}</section>;
}
