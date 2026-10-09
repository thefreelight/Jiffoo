'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useLocale, useT } from 'shared/src/i18n/react';
import { useInstalledPlugins, useTogglePlugin } from '@/lib/hooks/use-api';
import { marketplaceApi, marketplaceErrorKey, useMarketplaceCatalog, useMarketplaceInstall, useMarketplaceStatus, type MarketplaceEntry } from '@/lib/marketplace';
import { pluginUploadApi, type PluginUploadPreview, type PluginUploadOperation } from '@/lib/plugin-upload';
import { Button } from '@/components/ui/button';
import { DisablePluginControl } from '@/components/plugins/DisablePluginControl';
import { PluginTrustLabel } from './PluginTrust';
import { PluginUpload } from './PluginUpload';
import { PluginRecovery } from './PluginRecovery';
import { PluginDatabaseAudit } from './PluginDatabaseAudit';
import { PluginLifecycle } from './PluginLifecycle';
import { LastRecordedError } from '@/components/plugins/LastRecordedError';

function MarketplaceCard({ entry, busy, install, operation, retry }: { entry: MarketplaceEntry; busy: boolean; install: (pluginId: string, version: string, preview: PluginUploadPreview) => void; operation: PluginUploadOperation | null; retry: () => void }) {
  const t = useT();
  const text = (key: string) => t(`merchant.plugins.marketplace.${key}`);
  const [expanded, setExpanded] = useState(false);
  const [version, setVersion] = useState(entry.versions[0]?.version ?? '');
  const selected = entry.versions.find((item) => item.version === version);
  const installed = entry.installedVersion === version;
  const [preview, setPreview] = useState<PluginUploadPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewGeneration, setPreviewGeneration] = useState(0);
  const migrationText = (key: string) => t(`merchant.plugins.upload.${key}`);
  useEffect(() => {
    let active = true;
    setPreview(null); setPreviewError(null);
    if (expanded && selected?.compatible && !installed && !busy) {
      void marketplaceApi.preview(entry.id, version).then(value => { if (active) setPreview(value); }, error => { if (active) setPreviewError(marketplaceErrorKey(error)); });
    }
    return () => { active = false; };
  }, [expanded, entry.id, version, selected?.compatible, installed, busy, previewGeneration]);
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
      {preview && !operation && <div aria-label={migrationText('migrationPlan')} className="space-y-2">
        <h4 className="font-semibold">{migrationText('migrationPlan')}</h4>
        <p>{migrationText('migrationNamespace')}: {preview.migrationPlan.schemaName}{preview.migrationPlan.provisionNamespace ? ` — ${migrationText('migrationProvision')}` : ''}</p>
        <p>{migrationText('migrationApplied')}: {preview.migrationPlan.applied.length}</p>
        <ul>{preview.migrationPlan.pending.map(item => <li key={item.id}>{item.order}. {item.path}</li>)}</ul>
        {preview.migrationPlan.changesDatabase && <><p>{migrationText('backupRecommended')}</p><p>{migrationText('migrationConfirmation')}</p></>}
      </div>}
      {previewError && <div role="alert"><p>{text(previewError)}</p><Button variant="outline" onClick={() => setPreviewGeneration(value => value + 1)}>{text('retry')}</Button></div>}
      <Button disabled={busy || !selected?.compatible || installed || !preview} onClick={() => { if (preview) install(entry.id, version, preview); }}>
        {busy ? text('installing') : installed ? text('installed') : entry.installedVersion ? text('update') : text('install')}
      </Button>
      {busy && operation && <p role="status">{migrationText('migrationProgress')}: {operation.committedPrefix}</p>}
      {!busy && operation?.terminal && ['FAILED', 'NEEDS_RECOVERY'].includes(operation.phase) && <>
        <p role="alert">{migrationText(operation.phase === 'NEEDS_RECOVERY' ? 'needsRecovery' : 'migrationFailed')}</p>
        <p>{migrationText('migrationApplied')}: {operation.committedPrefix}</p>
        <p>{migrationText('backupRecommended')}</p><Button onClick={retry}>{migrationText('migrationRetry')}</Button>
      </>}
    </div>}
  </article>;
}

export function PluginsManager() {
  const locale = useLocale();
  const t = useT();
  const text = (key: string) => t(`merchant.plugins.marketplace.${key}`);
  const [view, setView] = useState<'installed' | 'removed' | 'marketplace'>('installed');
  const installed = useInstalledPlugins(view === 'removed' ? 'removed' : 'active');
  const toggle = useTogglePlugin();
  const status = useMarketplaceStatus();
  const catalog = useMarketplaceCatalog(status.data?.configured === true);
  const mutation = useMarketplaceInstall();
  const [feedback, setFeedback] = useState<{ error: boolean; key: string } | null>(null);
  const submitting = useRef(false);
  const queryClient = useQueryClient();
  const [operation, setOperation] = useState<PluginUploadOperation | null>(null);
  const [retrying, setRetrying] = useState(false);
  const install = async (pluginId: string, version: string, preview: PluginUploadPreview) => {
    if (submitting.current) return;
    submitting.current = true;
    setFeedback(null);
    setOperation(null);
    try {
      await mutation.mutateAsync({ pluginId, version, previewToken: preview.previewToken, confirmMigrations: preview.migrationPlan.changesDatabase, progress: setOperation });
      setFeedback({ error: false, key: 'installSuccess' });
    } catch (error) {
      setFeedback({ error: true, key: marketplaceErrorKey(error) });
    } finally {
      submitting.current = false;
    }
  };
  const retry = async () => {
    if (!operation || submitting.current) return;
    submitting.current = true; setRetrying(true); setFeedback(null);
    try {
      await pluginUploadApi.retry(operation.operationId, setOperation);
      await Promise.all([queryClient.invalidateQueries({ queryKey: ['extensions'] }), queryClient.invalidateQueries({ queryKey: ['plugins'] })]);
      setFeedback({ error: false, key: 'installSuccess' });
    } catch (error) { setFeedback({ error: true, key: marketplaceErrorKey(error) }); }
    finally { submitting.current = false; setRetrying(false); }
  };
  return <div className="space-y-5">
    <PluginRecovery />
    <PluginDatabaseAudit />
    <PluginUpload testSigningMode={status.data?.testSigningMode === true} />
    <nav aria-label={text('views')} className="flex gap-3">
      <Button variant={view === 'installed' ? 'default' : 'outline'} aria-pressed={view === 'installed'} onClick={() => setView('installed')}>{text('installedPlugins')}</Button>
      <Button variant={view === 'removed' ? 'default' : 'outline'} aria-pressed={view === 'removed'} onClick={() => setView('removed')}>{t('merchant.plugins.lifecycle.removed')}</Button>
      <Button variant={view === 'marketplace' ? 'default' : 'outline'} aria-pressed={view === 'marketplace'} onClick={() => setView('marketplace')}>{text('title')}</Button>
    </nav>
    {feedback && <p role={feedback.error ? 'alert' : 'status'} className={feedback.error ? 'text-danger-strong' : 'text-success-strong'}>{text(feedback.key)}</p>}
    {view !== 'marketplace' ? <section aria-label={view === 'removed' ? t('merchant.plugins.lifecycle.removed') : text('installedPlugins')} className="space-y-4">
      {(installed.data?.items ?? []).map((plugin) => <article aria-label={plugin.name} key={plugin.slug} className="rounded-xl border border-cool-soft bg-surface p-5 space-y-3">
        <h3 className="font-semibold">{plugin.name}</h3><p>{text('version')}: {plugin.version}</p>
        {status.data && <PluginTrustLabel plugin={plugin} testSigningMode={status.data.testSigningMode} />}
        <LastRecordedError lastFailureAt={plugin.lastFailureAt} lastFailureMessage={plugin.lastFailureMessage} />
        {plugin.packageState?.code && <p role="alert">{t(`merchant.plugins.lifecycle.${plugin.packageState.status === 'corrupt' ? 'packageCorrupt' : 'packageUnavailable'}`)}</p>}
        <div className="flex gap-3">{view === 'installed' && <>{plugin.enabled
          ? <DisablePluginControl slug={plugin.slug} category={plugin.category} label={text('disable')} onDisable={() => toggle.mutateAsync({ slug: plugin.slug, enabled: false })} />
          : <Button disabled={toggle.isPending || Boolean(plugin.packageState?.code)} onClick={() => toggle.mutate({ slug: plugin.slug, enabled: true })}>{text('enable')}</Button>}
          <Button asChild><Link href={`/${locale}/plugins/${plugin.slug}`}>{text('manage')}</Link></Button></>}
          <PluginLifecycle plugin={plugin} /></div>
      </article>)}
    </section> : <section aria-label={text('title')} className="space-y-4">
      {status.isLoading || (status.data?.configured && catalog.isLoading) ? <p role="status">{text('loading')}</p>
        : status.error || catalog.error ? <div role="alert"><p>{text('loadError')}</p><Button variant="outline" onClick={() => void (status.error ? status.refetch() : catalog.refetch())}>{text('retry')}</Button></div>
        : !status.data?.configured ? <p>{text('notConfigured')}</p>
        : !catalog.data?.items.length ? <p>{text('empty')}</p>
        : catalog.data.items.map((entry) => <MarketplaceCard key={entry.id} entry={entry} busy={mutation.isPending || retrying} install={(id, version, preview) => void install(id, version, preview)} operation={operation?.slug === entry.slug ? operation : null} retry={() => void retry()} />)}
    </section>}
  </div>;
}
