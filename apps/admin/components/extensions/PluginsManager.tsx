'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { useLocale, useT } from 'shared/src/i18n/react';
import { useInstalledPlugins, useTogglePlugin } from '@/lib/hooks/use-api';
import { marketplaceErrorKey, useMarketplaceCatalog, useMarketplaceInstall, useMarketplaceStatus, type MarketplaceEntry } from '@/lib/marketplace';
import { Button } from '@/components/ui/button';
import { DisablePluginControl } from '@/components/plugins/DisablePluginControl';
import { PluginTrustLabel } from './PluginTrust';
import { PluginUpload } from './PluginUpload';

function MarketplaceCard({ entry, busy, install }: { entry: MarketplaceEntry; busy: boolean; install: (pluginId: string, version: string) => void }) {
  const t = useT();
  const text = (key: string) => t(`merchant.plugins.marketplace.${key}`);
  const [expanded, setExpanded] = useState(false);
  const [version, setVersion] = useState(entry.versions[0]?.version ?? '');
  const selected = entry.versions.find((item) => item.version === version);
  const installed = entry.installedVersion === version;
  return <article aria-label={entry.name} className="rounded-xl border border-cool-soft bg-surface p-5 space-y-3">
    <h3 className="text-lg font-semibold">{entry.name}</h3>
    <p>{entry.description}</p>
    <p>{entry.installedVersion ? `${text('installedVersion')}: ${entry.installedVersion}` : text('verifiedAtInstall')}</p>
    {entry.updateAvailable && <p className="font-semibold text-action-strong">{text('updateAvailable')}</p>}
    <p>{text('declaredCapabilities')}: {(entry.declaredCapabilities ?? []).join(', ') || text('none')}</p>
    <Button variant="outline" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>{text('details')}</Button>
    {expanded && <div className="space-y-3">
      <p>{text('publisher')}: {entry.publisherId}</p>
      <label className="block">{text('version')}
        <select aria-label={`${entry.name} ${text('version')}`} value={version} disabled={busy} onChange={(event) => setVersion(event.target.value)} className="ml-3 rounded border border-cool-soft p-2">
          {entry.versions.map((item) => <option key={item.version} value={item.version}>{item.version}</option>)}
        </select>
      </label>
      {selected && !selected.compatible && <p role="status">{text('incompatible')}: {text('requiresApi')} {selected.minApiVersion}</p>}
      <Button disabled={busy || !selected?.compatible || installed} onClick={() => install(entry.id, version)}>
        {busy ? text('installing') : installed ? text('installed') : entry.installedVersion ? text('update') : text('install')}
      </Button>
    </div>}
  </article>;
}

export function PluginsManager() {
  const locale = useLocale();
  const t = useT();
  const text = (key: string) => t(`merchant.plugins.marketplace.${key}`);
  const installed = useInstalledPlugins();
  const toggle = useTogglePlugin();
  const status = useMarketplaceStatus();
  const catalog = useMarketplaceCatalog(status.data?.configured === true);
  const mutation = useMarketplaceInstall();
  const [view, setView] = useState<'installed' | 'marketplace'>('installed');
  const [feedback, setFeedback] = useState<{ error: boolean; key: string } | null>(null);
  const submitting = useRef(false);
  const install = async (pluginId: string, version: string) => {
    if (submitting.current) return;
    submitting.current = true;
    setFeedback(null);
    try {
      await mutation.mutateAsync({ pluginId, version });
      setFeedback({ error: false, key: 'installSuccess' });
    } catch (error) {
      setFeedback({ error: true, key: marketplaceErrorKey(error) });
    } finally {
      submitting.current = false;
    }
  };
  return <div className="space-y-5">
    <PluginUpload testSigningMode={status.data?.testSigningMode === true} />
    <nav aria-label={text('views')} className="flex gap-3">
      <Button variant={view === 'installed' ? 'default' : 'outline'} aria-pressed={view === 'installed'} onClick={() => setView('installed')}>{text('installedPlugins')}</Button>
      <Button variant={view === 'marketplace' ? 'default' : 'outline'} aria-pressed={view === 'marketplace'} onClick={() => setView('marketplace')}>{text('title')}</Button>
    </nav>
    {feedback && <p role={feedback.error ? 'alert' : 'status'} className={feedback.error ? 'text-danger-strong' : 'text-success-strong'}>{text(feedback.key)}</p>}
    {view === 'installed' ? <section aria-label={text('installedPlugins')} className="space-y-4">
      {(installed.data?.items ?? []).map((plugin) => <article aria-label={plugin.name} key={plugin.slug} className="rounded-xl border border-cool-soft bg-surface p-5 space-y-3">
        <h3 className="font-semibold">{plugin.name}</h3><p>{text('version')}: {plugin.version}</p>
        {status.data && <PluginTrustLabel plugin={plugin} testSigningMode={status.data.testSigningMode} />}
        <div className="flex gap-3">{plugin.enabled
          ? <DisablePluginControl slug={plugin.slug} category={plugin.category} label={text('disable')} onDisable={() => toggle.mutateAsync({ slug: plugin.slug, enabled: false })} />
          : <Button disabled={toggle.isPending} onClick={() => toggle.mutate({ slug: plugin.slug, enabled: true })}>{text('enable')}</Button>}
          <Button asChild><Link href={`/${locale}/plugins/${plugin.slug}`}>{text('manage')}</Link></Button></div>
      </article>)}
    </section> : <section aria-label={text('title')} className="space-y-4">
      {status.isLoading || (status.data?.configured && catalog.isLoading) ? <p role="status">{text('loading')}</p>
        : status.error || catalog.error ? <div role="alert"><p>{text('loadError')}</p><Button variant="outline" onClick={() => void (status.error ? status.refetch() : catalog.refetch())}>{text('retry')}</Button></div>
        : !status.data?.configured ? <p>{text('notConfigured')}</p>
        : !catalog.data?.items.length ? <p>{text('empty')}</p>
        : catalog.data.items.map((entry) => <MarketplaceCard key={entry.id} entry={entry} busy={mutation.isPending} install={(id, version) => void install(id, version)} />)}
    </section>}
  </div>;
}
