'use client';

import Link from 'next/link';
import { useLocale } from 'shared/src/i18n/react';
import { useInstalledPlugins, useTogglePlugin } from '@/lib/hooks/use-api';
import { Button } from '@/components/ui/button';
import { DisablePluginControl } from '@/components/plugins/DisablePluginControl';

export function PluginsManager() {
  const locale = useLocale();
  const { data } = useInstalledPlugins();
  const toggle = useTogglePlugin();
  return <section>{(data?.items || []).map((plugin) => <div key={plugin.slug}><span>{plugin.name}</span>{plugin.enabled
    ? <DisablePluginControl slug={plugin.slug} category={plugin.category} label="Disable" onDisable={() => toggle.mutateAsync({ slug: plugin.slug, enabled: false })} />
    : <Button onClick={() => toggle.mutate({ slug: plugin.slug, enabled: true })}>Enable</Button>}<Button asChild><Link href={`/${locale}/plugins/${plugin.slug}`}>Manage</Link></Button></div>)}</section>;
}
