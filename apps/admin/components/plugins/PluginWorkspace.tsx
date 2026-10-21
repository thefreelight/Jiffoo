'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useT } from 'shared/src/i18n/react';
import { parsePluginConfigSchema, validatePluginConfig, formatStoreTimestamp } from 'shared';
import { pluginMessage, pluginCategoryLabel, type PluginLabel } from 'shared/src/i18n/messages/admin-plugins';
import { isAdminApiError } from '@/lib/api';
import { usePluginConfig, usePluginInstances, useUpdatePluginInstance } from '@/lib/hooks/use-api';
import { useMarketplaceStatus } from '@/lib/marketplace';
import { useStoreDate } from '@/lib/store-time';
import { usePluginDialogLayout } from '@/lib/plugin-dialog';
import { registerNavigationGuard, requestAppNavigation } from '@/lib/pending-navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { PluginTrustLabel } from '@/components/extensions/PluginTrust';
import { PluginLifecycle } from '@/components/extensions/PluginLifecycle';
import { DisablePluginControl } from './DisablePluginControl';
import { LastRecordedError } from './LastRecordedError';

function record(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value); }

export function PluginWorkspace({ slug }: { slug: string }) {
  const locale = useLocale(), t = useT(), router = useRouter(), { timezone } = useStoreDate();
  const c = (key: PluginLabel, values?: Record<string, string | number>) => pluginMessage(locale, key, values);
  const dialogLayout = usePluginDialogLayout('leave');
  const leave = (key: string) => t('merchant.profileView.' + key);
  const query = usePluginConfig(slug), instances = usePluginInstances(slug), status = useMarketplaceStatus();
  const mutation = useUpdatePluginInstance(), data = query.data;
  const selected = instances.data?.items.find(item => item.instanceKey === 'default');
  const schema = useMemo(() => data?.configSchema ? parsePluginConfigSchema(data.configSchema).schema : null, [data?.configSchema]);
  const [draft, setDraft] = useState<Record<string, unknown>>({}), [baseline, setBaseline] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({}), [failed, setFailed] = useState(false), [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null), [destination, setDestination] = useState<(() => void) | null>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline);
  const dirtyRef = useRef(false), submitting = useRef(false), identity = useRef(''), firstError = useRef<string | null>(null);
  const errorFromDialog = useRef(false);
  dirtyRef.current = dirty;
  useEffect(() => {
    if (!selected || identity.current === selected.installationId && dirtyRef.current) return;
    identity.current = selected.installationId;
    const values = { ...(record(selected.config) ? selected.config : {}) };
    if (schema) for (const [field, descriptor] of Object.entries(schema.properties)) {
      if (descriptor.sensitive) delete values[field];
      else if (values[field] === undefined && descriptor.default !== undefined) values[field] = descriptor.default;
    }
    const saved = { ...values };
    if (schema) for (const field of schema.required ?? []) if (selected.config?.[field] === undefined) delete saved[field];
    setDraft(values); setBaseline(saved); setSavedAt(selected.updatedAt ?? null);
  }, [selected?.installationId, selected?.updatedAt, schema]);
  useEffect(() => {
    if (busy || !firstError.current || errorFromDialog.current) return;
    const field = document.getElementById('plugin-config-' + firstError.current);
    field?.focus(); field?.scrollIntoView?.({ block: 'center' }); firstError.current = null;
  }, [busy, errors]);
  useEffect(() => {
    const unregister = registerNavigationGuard(resume => { if (!dirtyRef.current) return false; setDestination(() => resume); return true; });
    const unload = (event: BeforeUnloadEvent) => { if (dirtyRef.current) { event.preventDefault(); event.returnValue = ''; } };
    const click = (event: MouseEvent) => {
      if (!dirtyRef.current || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      const link = (event.target as Element).closest?.('a[href]') as HTMLAnchorElement | null;
      if (!link || link.hasAttribute('data-app-navigation') || link.target === '_blank' || link.hasAttribute('download')) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname && url.search === window.location.search) return;
      event.preventDefault(); event.stopPropagation(); setDestination(() => () => router.push(url.pathname + url.search + url.hash));
    };
    document.addEventListener('click', click, true); window.addEventListener('beforeunload', unload);
    return () => { unregister(); document.removeEventListener('click', click, true); window.removeEventListener('beforeunload', unload); };
  }, [router]);
  const meta = selected?.configMeta ?? data?.configMeta;
  const persisted = { ...(selected?.config ?? {}) };
  if (schema) for (const [field, descriptor] of Object.entries(schema.properties)) if (descriptor.sensitive && meta?.secretFields?.[field]?.configured) persisted[field] = 'configured';
  const missing = schema ? validatePluginConfig(schema, persisted).filter(issue => issue.message === 'Required field is missing').map(issue => issue.path.slice(7)) : [];
  async function save() {
    if (!selected || submitting.current) return false;
    submitting.current = true; setBusy(true); setFailed(false); setErrors({});
    try {
      const result = await mutation.mutateAsync({ slug, installationId: selected.installationId, config: draft });
      const next = { ...draft };
      if (schema) for (const [field, descriptor] of Object.entries(schema.properties)) if (descriptor.sensitive) delete next[field];
      setDraft(next); setBaseline(next); setSavedAt(result?.updatedAt ?? null); dirtyRef.current = false;
      return true;
    } catch (cause) {
      setFailed(true);
      errorFromDialog.current = destination !== null;
      setDestination(null);
      const fields: Record<string, string> = {};
      if (isAdminApiError(cause) && record(cause.details) && Array.isArray(cause.details.fields)) for (const issue of cause.details.fields) {
        if (record(issue) && typeof issue.path === 'string' && issue.path.startsWith('config.')) fields[issue.path.slice(7)] = c(issue.message === 'Required field is missing' ? 'required' : 'invalid');
      }
      firstError.current = Object.keys(fields)[0] ?? null; setErrors(fields); return false;
    } finally { submitting.current = false; setBusy(false); }
  }
  async function toggle() {
    if (!selected || submitting.current) return;
    submitting.current = true; setBusy(true);
    try { await mutation.mutateAsync({ slug, installationId: selected.installationId, enabled: !selected.enabled }); }
    catch {
      // The mutation hook presents the localized transition error.
    }
    finally { submitting.current = false; setBusy(false); }
  }
  if (query.isLoading || instances.isLoading) return <p role="status" className="p-8">{t('merchant.plugins.loadingPluginDetails')}</p>;
  if (!data || data.uninstalled) return <div className="space-y-3 p-8"><Link href={`/${locale}/plugins${data?.uninstalled ? '?tab=removed' : ''}`}>{c('back')}</Link><p role="alert">{t(data?.uninstalled ? 'merchant.plugins.lifecycle.alreadyRemoved' : 'merchant.plugins.failedToLoadDetails')}</p></div>;
  const plugin = { ...data, slug, name: data.name || slug, version: data.version || '', source: data.source as 'builtin' | 'installed', enabled: selected?.enabled ?? false };
  const capabilityLabels = (data.declaredCapabilities ?? []).map(name => pluginCategoryLabel(locale, name)).filter((label): label is string => Boolean(label));
  return <section className="min-w-0 text-[13px]">
    <header className="sticky top-0 z-30 border-b border-border bg-ground"><div className="mx-auto max-w-[760px] space-y-2.5 px-4 pb-3.5 pt-16 min-[769px]:pt-4 sm:px-8"><Link href={`/${locale}/plugins`} className="text-muted-foreground">{c('back')}</Link><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex min-w-0 flex-wrap items-center gap-2.5"><span aria-hidden="true" className="flex size-8 items-center justify-center rounded-lg border border-border bg-raised font-semibold text-muted-foreground">{plugin.name.slice(0, 1)}</span><h1 style={{ fontSize: 22 }} className="min-w-0 max-w-full break-words text-[22px] font-semibold tracking-[-0.02em]">{plugin.name}</h1>{status.data && <PluginTrustLabel compact className="h-[22px] px-2 text-xs" plugin={data} testSigningMode={status.data.testSigningMode} />}<span className={`inline-flex h-[22px] items-center gap-1.5 rounded-md border border-border px-2 text-xs leading-none ${selected?.enabled ? 'text-foreground' : 'text-faint'}`}><span aria-hidden="true" className={`size-[7px] rounded-full border border-current ${selected?.enabled ? 'bg-current' : ''}`} />{c(selected?.enabled ? 'enabled' : 'disabled')}</span></div><div className="flex flex-wrap items-center gap-2"><span className={`text-xs ${dirty ? 'text-attention' : 'text-faint'}`}>{dirty ? c('dirty') : `${c('saved')}${savedAt ? ' · ' + formatStoreTimestamp(savedAt, timezone) : ''}`}</span><PluginLifecycle plugin={plugin} triggerVariant="outline" beforeAction={requestAppNavigation} onUninstalled={() => router.push(`/${locale}/plugins`)} />{selected?.enabled ? <DisablePluginControl slug={slug} pluginName={plugin.name} payment={Boolean(data.declaredCapabilities?.includes('payment'))} label={t('merchant.plugins.marketplace.disable')} disabled={busy} onDisable={toggle} /> : <Button variant="outline" size="sm" className="bg-ground disabled:text-faint disabled:opacity-100" disabled={busy || !selected || missing.length > 0 || Boolean(data.packageState?.code)} title={missing.length ? c('enableTitle') : undefined} onClick={() => void toggle()}>{t('merchant.plugins.marketplace.enable')}</Button>}{dirty && <Button variant="outline" size="sm" className="bg-ground disabled:text-faint disabled:opacity-100" disabled={busy} onClick={() => { setDraft(baseline); setErrors({}); setFailed(false); }}>{c('discard')}</Button>}<Button size="sm" className={!dirty ? 'bg-raised text-faint disabled:opacity-100' : undefined} form="plugin-config" type="submit" disabled={busy || !dirty || !selected}>{c('save')}</Button></div></div><p className="text-xs text-faint">{timezone}</p></div></header>
    <div className="mx-auto max-w-[760px] space-y-5 px-4 pb-16 pt-6 sm:px-8">
      {data.packageState?.code && <p role="alert" className="text-attention">{t(`merchant.plugins.lifecycle.${data.packageState.status === 'corrupt' ? 'packageCorrupt' : 'packageUnavailable'}`)}</p>}
      {missing.length > 0 && <p role="status" className="rounded-lg border border-attention-line bg-attention-soft px-3.5 py-3 text-attention">{c('missing', { count: missing.length, fields: missing.map(field => schema?.properties[field]?.title ?? field).join(c('listSeparator')) })}</p>}
      {(query.error || instances.error) && <p role="alert">{t('merchant.plugins.failedToLoadDetails')}</p>}
      {failed && <p role="alert" className="text-destructive">{c('saveFailed')}</p>}
      <form id="plugin-config" noValidate onSubmit={event => { event.preventDefault(); void save(); }} className="overflow-hidden rounded-lg border border-border"><div className="space-y-0.5 border-b border-border px-4 py-3"><h2 className="font-semibold">{c('config')}</h2><p className="text-xs text-faint">{c('configNote')}</p></div><fieldset disabled={busy} className="min-w-0 space-y-4 p-4">{schema && Object.keys(schema.properties).length ? Object.entries(schema.properties).map(([field, descriptor]) => {
        const label = descriptor.title || field, id = 'plugin-config-' + field, value = draft[field], required = schema.required?.includes(field), error = errors[field];
        const change = (next: unknown) => setDraft(current => ({ ...current, [field]: next }));
        return <div key={field} className="max-w-[460px] space-y-1.5"><Label htmlFor={id}>{label}{required && <span aria-hidden="true" className="text-destructive"> *</span>}</Label>{descriptor.description && <p className="text-xs text-faint">{descriptor.description}</p>}{descriptor.type === 'boolean' ? <Switch id={id} aria-label={label} checked={Boolean(value)} onCheckedChange={change} /> : descriptor.type === 'string' && descriptor.enum ? <Select value={typeof value === 'string' ? value : ''} onValueChange={change}><SelectTrigger className="bg-ground" id={id} aria-label={label} aria-invalid={Boolean(error)}><SelectValue /></SelectTrigger><SelectContent>{descriptor.enum.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent></Select> : <Input className="bg-ground" id={id} aria-label={label} aria-required={required} min={descriptor.minimum} max={descriptor.maximum} minLength={descriptor.minLength} maxLength={descriptor.maxLength} aria-invalid={Boolean(error)} aria-describedby={error ? id + '-error' : undefined} type={descriptor.sensitive ? 'password' : descriptor.type === 'integer' || descriptor.type === 'number' ? 'number' : 'text'} autoComplete={descriptor.sensitive ? 'new-password' : undefined} step={descriptor.type === 'integer' ? 1 : descriptor.type === 'number' ? 'any' : undefined} value={typeof value === 'string' || typeof value === 'number' ? String(value) : ''} placeholder={descriptor.sensitive && meta?.secretFields?.[field]?.configured ? c('secret') : undefined} onChange={event => change(descriptor.type === 'integer' || descriptor.type === 'number' ? event.target.value === '' ? undefined : Number(event.target.value) : event.target.value)} />}{error && <p id={id + '-error'} role="alert" className="text-xs text-destructive">{error}</p>}</div>;
      }) : <p className="text-muted-foreground">{c('noConfig')}</p>}</fieldset></form>
      <LastRecordedError lastFailureAt={data.lastFailureAt} lastFailureMessage={data.lastFailureMessage} />
      <section aria-labelledby="plugin-about" className="overflow-hidden rounded-lg border border-border"><h2 id="plugin-about" className="border-b border-border px-4 py-3 font-semibold">{c('about')}</h2><dl className="divide-y divide-border px-4 py-1">{(['description', 'version', 'slug', 'signature', 'capabilities', 'category'] as const).map(key => <div key={key} className="flex flex-wrap gap-x-4 gap-y-1 py-2"><dt className="w-24 text-muted-foreground">{c(key)}</dt><dd className="min-w-0 flex-1 basis-[280px] break-words">{key === 'signature' ? <>{status.data && <PluginTrustLabel plugin={data} testSigningMode={status.data.testSigningMode} />}</> : key === 'capabilities' ? <>{capabilityLabels.join(', ') || c('none')}<p className="text-xs text-faint">{c('capabilityNote')}</p></> : <span className={key === 'slug' || key === 'version' ? 'font-mono text-xs' : undefined}>{key === 'slug' ? slug : key === 'category' && data.category ? pluginCategoryLabel(locale, data.category) ?? c('none') : data[key] || c('none')}</span>}</dd></div>)}</dl></section>
    </div>
    <AlertDialog open={destination !== null} onOpenChange={value => { if (!value && !busy) setDestination(null); }}><AlertDialogContent {...dialogLayout} onCloseAutoFocus={event => { if (!errorFromDialog.current) return; event.preventDefault(); errorFromDialog.current = false; const field = firstError.current ? document.getElementById('plugin-config-' + firstError.current) : null; field?.focus(); field?.scrollIntoView?.({ block: 'center' }); firstError.current = null; }}><AlertDialogHeader className="text-left"><AlertDialogTitle className="text-[15px]">{leave('leaveTitle')}</AlertDialogTitle><AlertDialogDescription>{leave('leaveNote')}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><Button variant="outline" size="sm" className="bg-ground disabled:text-faint disabled:opacity-100" disabled={busy} onClick={() => setDestination(null)}>{leave('keepEditing')}</Button><Button variant="outline" size="sm" className="bg-ground disabled:text-faint disabled:opacity-100" disabled={busy} onClick={() => { setDraft(baseline); dirtyRef.current = false; destination?.(); setDestination(null); }}>{leave('leaveWithout')}</Button><Button disabled={busy} onClick={async () => { if (await save()) { destination?.(); setDestination(null); } }}>{leave('saveLeave')}</Button></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </section>;
}
