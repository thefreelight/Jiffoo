'use client';

import Link from 'next/link';
import { formatStoreTimestamp } from 'shared';
import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useT } from 'shared/src/i18n/react';
import { pluginMessage, type PluginLabel } from 'shared/src/i18n/messages/admin-plugins';
import { useInstalledPlugins } from '@/lib/hooks/use-api';
import { marketplaceApi, marketplaceErrorKey, useMarketplaceCatalog, useMarketplaceInstall, useMarketplaceStatus, type MarketplaceEntry } from '@/lib/marketplace';
import { useStoreDate } from '@/lib/store-time';
import { usePluginDialogLayout } from '@/lib/plugin-dialog';
import { Button } from '@/components/ui/button';
import { PluginTrustLabel } from './PluginTrust';
import { PluginUpload, PluginInstallPreview } from './PluginUpload';
import { PluginRecovery } from './PluginRecovery';
import { PluginLifecycle } from './PluginLifecycle';
import { pluginUploadApi, type PluginUploadPreview, type PluginUploadOperation } from '@/lib/plugin-upload';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

function MarketplaceRow({ entry, testSigningMode }: { entry: MarketplaceEntry; testSigningMode: boolean }) {
  const locale = useLocale(), t = useT(), c = (key: PluginLabel) => pluginMessage(locale, key);
  const text = (key: string) => t('merchant.plugins.marketplace.' + key);
  const mutation = useMarketplaceInstall();
  const dialogLayout = usePluginDialogLayout('install');
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [preview, setPreview] = useState<PluginUploadPreview | null>(null), [operation, setOperation] = useState<PluginUploadOperation | null>(null);
  const submitting = useRef(false);
  const latest = [...entry.versions].sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }))[0];
  const installed = latest?.version === entry.installedVersion;
  const secondary = Boolean(entry.installedVersion) || !latest?.compatible;
  async function inspect() {
    if (!latest || submitting.current) return;
    submitting.current = true; setBusy(true); setOpen(true); setError(''); setPreview(null); setOperation(null);
    try { setPreview(await marketplaceApi.preview(entry.id, latest.version)); }
    catch (cause) { setError(text(marketplaceErrorKey(cause))); }
    finally { submitting.current = false; setBusy(false); }
  }
  async function install() {
    if (!preview || submitting.current || !latest) return;
    submitting.current = true; setBusy(true); setError('');
    try {
      await mutation.mutateAsync({ pluginId: entry.id, version: latest.version, previewToken: preview.previewToken, confirmMigrations: preview.migrationPlan.changesDatabase, progress: setOperation });
      setOpen(false);
    } catch (cause) { setError(text(marketplaceErrorKey(cause))); }
    finally { submitting.current = false; setBusy(false); }
  }
  return <article aria-label={entry.name} className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3.5 last:border-b-0">
    <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-raised font-semibold text-muted-foreground">{entry.name.slice(0, 1)}</span>
    <div className="min-w-0 flex-1 basis-[260px] space-y-[3px]"><div className="flex flex-wrap items-center gap-2"><h2 className="min-w-0 break-words font-medium">{entry.name}</h2><span className="rounded border border-border px-1.5 text-[11px] text-muted-foreground">{text('verifiedAtInstall')}</span></div><p className="break-words text-xs text-muted-foreground">{entry.description}</p><p className="text-xs text-faint">{text('publisher')} {entry.publisherId} · {c('latest')} <span className="font-mono">{latest?.version}</span>{entry.installedVersion && ` · ${pluginMessage(locale, entry.updateAvailable ? 'marketUpdate' : 'marketInstalled', { version: entry.installedVersion })}`}{latest && !latest.compatible && ` · ${c('marketIncompatible')} (${latest.minApiVersion})`}</p></div>
    <Button size="sm" variant={secondary ? 'outline' : 'default'} className={secondary ? 'bg-ground disabled:text-faint disabled:opacity-100' : 'disabled:bg-raised disabled:text-faint disabled:opacity-100'} disabled={busy || !latest?.compatible || installed} onClick={() => void inspect()}>{busy ? text('installing') : !latest?.compatible ? text('incompatible') : installed ? text('installed') : entry.updateAvailable ? text('update') : text('install')}</Button>
    <Dialog open={open} onOpenChange={value => { if (!busy) setOpen(value); }}><DialogContent {...dialogLayout} showCloseButton={false}><DialogHeader className="text-left"><DialogTitle className="text-[15px]">{busy && operation ? c('installing') : c('confirm')}</DialogTitle><DialogDescription>{entry.name}</DialogDescription></DialogHeader>{error && <p role="alert">{error}</p>}{preview && !operation && <PluginInstallPreview preview={preview} testSigningMode={testSigningMode} />}{busy && <p role="status">{operation ? pluginMessage(locale, 'progress', { name: entry.name, count: operation.committedPrefix }) : text('loading')}</p>}<div className="flex justify-end gap-2"><Button variant="outline" className="bg-ground" disabled={busy} onClick={() => setOpen(false)}>{t('common.actions.cancel')}</Button><Button disabled={busy || !preview || !preview.compatibility.compatible} onClick={() => void install()}>{c('confirm')}</Button></div></DialogContent></Dialog>
  </article>;
}

export function PluginsManager() {
  const locale = useLocale(), t = useT(), { timezone } = useStoreDate();
  const c = (key: PluginLabel) => pluginMessage(locale, key);
  const active = useInstalledPlugins('active'), removed = useInstalledPlugins('removed');
  const status = useMarketplaceStatus(), catalog = useMarketplaceCatalog(status.data?.configured === true);
  const recovery = useQuery({ queryKey: ['plugin-recovery'], queryFn: pluginUploadApi.recovery, refetchInterval: 10_000 });
  const [view, setView] = useState('installed');
  useEffect(() => {
    const read = () => { const tab = new URLSearchParams(window.location.search).get('tab'); setView(tab === 'market' || tab === 'removed' ? tab : 'installed'); };
    read(); window.addEventListener('popstate', read); return () => window.removeEventListener('popstate', read);
  }, []);
  const pick = (tab: string) => { setView(tab); const url = new URL(window.location.href); url.searchParams.set('tab', tab); window.history.replaceState(null, '', url); };
  const selected = view === 'removed' ? removed : active;
  return <section className={`mx-auto min-w-0 max-w-[1120px] space-y-4 px-4 pb-12 text-[13px] sm:px-8 ${status.data?.testSigningMode ? 'pt-0' : 'pt-16 min-[769px]:pt-10'}`}>
    <header className="flex flex-wrap items-start justify-between gap-3"><div className="space-y-1.5"><h1 className="text-[26px] font-semibold tracking-[-0.025em]">{c('title')}</h1><p className="text-muted-foreground">{c('intro')}</p></div><PluginUpload testSigningMode={status.data?.testSigningMode === true} /></header>
    <PluginRecovery />
    <div role="tablist" aria-label={c('views')} className="flex flex-wrap gap-5 border-b border-border">{(['installed', 'market', 'removed'] as const).map(tab => {
      const count = tab === 'installed' ? active.data?.total : tab === 'removed' ? removed.data?.total : catalog.data?.items.length;
      return <button type="button" role="tab" key={tab} aria-label={c(tab)} aria-selected={tab === view} onClick={() => pick(tab)} className={`-mb-px flex h-9 items-center gap-1.5 border-b-[1.5px] font-medium focus-visible:outline-2 focus-visible:outline-ring ${tab === view ? 'border-foreground' : 'border-transparent text-faint'}`}>{c(tab)}{typeof count === 'number' && <span className="font-mono text-[11px] text-faint">{count}</span>}</button>;
    })}</div>
    {view === 'market' ? <section aria-label={c('market')} className="overflow-hidden rounded-lg border border-border">{status.isLoading || status.data?.configured && catalog.isLoading ? <p role="status" className="p-4">{t('merchant.plugins.marketplace.loading')}</p> : status.error || catalog.error ? <p role="alert" className="p-4">{t('merchant.plugins.marketplace.loadError')}<Button variant="outline" className="bg-ground" onClick={() => void (status.error ? status.refetch() : catalog.refetch())}>{t('common.actions.retry')}</Button></p> : !status.data?.configured ? <p className="p-4">{t('merchant.plugins.marketplace.notConfigured')}</p> : !catalog.data?.items.length ? <p className="p-4">{c('empty')}</p> : catalog.data.items.map(entry => <MarketplaceRow key={entry.id} entry={entry} testSigningMode={status.data?.testSigningMode === true} />)}<p className="border-t border-border px-4 py-2.5 text-xs text-faint">{c('marketNote')}</p></section> : <section aria-label={c(view === 'removed' ? 'removed' : 'installed')} className="overflow-hidden rounded-lg border border-border">
      {selected.isLoading ? <p role="status" className="p-4">{t('merchant.plugins.loading')}</p> : selected.error ? <p role="alert" className="p-4">{t('merchant.plugins.failedToLoadDetails')}<Button variant="outline" className="bg-ground" onClick={() => void selected.refetch()}>{t('common.actions.retry')}</Button></p> : !selected.data?.items.length ? <p className="p-4">{c('empty')}</p> : selected.data.items.map(plugin => {
        const paused = Boolean(plugin.packageState?.code) || Boolean(recovery.data?.items.some(item => item.slug === plugin.slug && (item.maintenanceRequired || item.operations.some(operation => ['PAUSING', 'MIGRATING', 'PUBLISHING', 'PUBLISHED', 'NEEDS_RECOVERY'].includes(operation.phase))))), needs = plugin.configRequired && !plugin.configReady;
        const state = paused ? 'paused' : plugin.enabled ? 'enabled' : needs ? 'needsConfig' : 'disabled';
        const href = `/${locale}/plugins/${encodeURIComponent(plugin.slug)}`;
        return <article aria-label={plugin.name} key={plugin.slug} className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3.5 hover:bg-raised">
          <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-raised font-semibold text-muted-foreground">{plugin.name.slice(0, 1)}</span>
          <div className="min-w-0 flex-1 basis-[240px] space-y-[3px]"><div className="flex flex-wrap items-center gap-2">{view === 'removed' ? <h2 className="font-medium">{plugin.name}</h2> : <Link className="min-w-0 break-words font-medium" href={href}>{plugin.name}</Link>}{view !== 'removed' && status.data && <PluginTrustLabel compact plugin={plugin} testSigningMode={status.data.testSigningMode} />}</div><p className="break-words text-xs text-muted-foreground">{view === 'removed' ? pluginMessage(locale, 'removedAt', { time: plugin.deletedAt ? formatStoreTimestamp(plugin.deletedAt, timezone) : c('none') }) : <>{plugin.description} · <span className="font-mono">{plugin.version}</span></>}</p>{plugin.packageState?.code && <p role="alert" className="text-xs text-attention">{t(`merchant.plugins.lifecycle.${plugin.packageState.status === 'corrupt' ? 'packageCorrupt' : 'packageUnavailable'}`)}</p>}</div>
          {view !== 'removed' && <><span className={`inline-flex min-w-[120px] items-center gap-1.5 ${paused || needs && !plugin.enabled ? 'text-attention' : plugin.enabled ? 'text-foreground' : 'text-faint'}`}><span aria-hidden="true" className={`size-[7px] rounded-full border border-current ${state === 'enabled' ? 'bg-current' : 'bg-transparent'}`} />{c(state)}</span><Button asChild variant="outline" className="h-[30px] bg-ground" size="sm"><Link href={href}>{c(paused ? 'view' : needs ? 'configure' : 'manage')}</Link></Button></>}
          <PluginLifecycle plugin={plugin} />
        </article>;
      })}<p className="px-4 py-2.5 text-xs text-faint">{c(view === 'removed' ? 'removedNote' : 'listNote')}{view === 'removed' && ` · ${timezone}`}</p>
    </section>}
  </section>;
}
