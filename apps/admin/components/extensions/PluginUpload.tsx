'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useLocale, useT } from 'shared/src/i18n/react';
import { pluginMessage, pluginCategoryLabel, type PluginLabel } from 'shared/src/i18n/messages/admin-plugins';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { pluginUploadApi, pluginUploadErrorKey, type PluginUploadPreview, type PluginUploadOperation } from '@/lib/plugin-upload';
import { PluginTrustLabel } from './PluginTrust';
import { usePluginDialogLayout } from '@/lib/plugin-dialog';

export function PluginInstallPreview({ preview, testSigningMode }: { preview: PluginUploadPreview; testSigningMode: boolean }) {
  const locale = useLocale(), c = (key: PluginLabel) => pluginMessage(locale, key);
  return <dl className="divide-y divide-border rounded-lg border border-border px-3.5">
    <div className="flex flex-wrap gap-3 py-2"><dt className="w-[88px] text-muted-foreground">{c('title')}</dt><dd className="min-w-0 break-words"><span>{preview.package.name}</span> <span className="font-mono text-xs text-muted-foreground">{preview.package.slug} · {preview.package.version}</span></dd></div>
    <div className="flex flex-wrap gap-3 py-2"><dt className="w-[88px] text-muted-foreground">{c('signature')}</dt><dd>{preview.package.publisher ? <><PluginTrustLabel compact plugin={{ trustLevel: preview.package.trust, signingRoot: preview.package.publisher.signingRoot }} testSigningMode={testSigningMode} /> {preview.package.publisher.publisherName}</> : <span className="text-attention">{c('unsigned')}</span>}</dd></div>
    <div className="flex flex-wrap gap-3 py-2"><dt className="w-[88px] text-muted-foreground">{c('capabilities')}</dt><dd className="min-w-0 flex-1 break-words">{preview.package.declaredCapabilities.map(name => pluginCategoryLabel(locale, name)).filter((label): label is string => Boolean(label)).join(', ') || c('none')}<p className="text-xs text-faint">{c('capabilityNote')}</p></dd></div>
    <div className="flex flex-wrap gap-3 py-2"><dt className="w-[88px] text-muted-foreground">{c('databaseChanges')}</dt><dd className="min-w-0 flex-1 break-words"><p>{preview.migrationPlan.provisionNamespace && c('provision')} <span className="font-mono text-xs">{preview.migrationPlan.schemaName}</span></p><p>{pluginMessage(locale, 'pending', { count: preview.migrationPlan.pending.length })}</p><ul>{preview.migrationPlan.pending.map(item => <li className="break-all font-mono text-xs" key={item.id}>{item.path}</li>)}</ul>{preview.migrationPlan.changesDatabase && <p className="text-xs text-faint">{c('backup')}</p>}</dd></div>
  </dl>;
}

export function PluginUpload({ testSigningMode }: { testSigningMode: boolean }) {
  const locale = useLocale(), t = useT(), c = (key: PluginLabel) => pluginMessage(locale, key), client = useQueryClient();
  const dialogLayout = usePluginDialogLayout('install');
  const [open, setOpen] = useState(false), [file, setFile] = useState<File | null>(null), [preview, setPreview] = useState<PluginUploadPreview | null>(null);
  const [typed, setTyped] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(''), [done, setDone] = useState(false);
  const [operation, setOperation] = useState<PluginUploadOperation | null>(null), [warning, setWarning] = useState('');
  const submitting = useRef(false);
  function select(next: File | null) { setFile(next); setPreview(null); setTyped(''); setError(''); setOperation(null); setDone(false); setWarning(''); }
  async function inspect() {
    if (!file || submitting.current) return;
    submitting.current = true; setBusy(true); setError('');
    try { setPreview(await pluginUploadApi.preview(file)); }
    catch (cause) { setError(t('merchant.plugins.upload.' + pluginUploadErrorKey(cause))); }
    finally { submitting.current = false; setBusy(false); }
  }
  async function install() {
    if (!file || !preview || submitting.current || !preview.compatibility.compatible || preview.requiresUnsignedConfirmation && typed !== preview.package.slug) return;
    submitting.current = true; setBusy(true); setError('');
    try {
      const result = operation?.terminal && ['FAILED', 'NEEDS_RECOVERY'].includes(operation.phase)
        ? await pluginUploadApi.retry(operation.operationId, setOperation)
        : await pluginUploadApi.install(file, preview, preview.requiresUnsignedConfirmation ? typed : undefined, setOperation);
      await Promise.all([client.invalidateQueries({ queryKey: ['plugins'] }), client.invalidateQueries({ queryKey: ['extensions'] }), client.invalidateQueries({ queryKey: ['plugin-recovery'] })]);
      setDone(true); if (result.warnings.length) setWarning(t('merchant.plugins.upload.installedWithWarning'));
    } catch (cause) {
      const key = (cause as { phase?: string } | null)?.phase === 'NEEDS_RECOVERY' ? 'needsRecovery' : pluginUploadErrorKey(cause);
      setError(t('merchant.plugins.upload.' + key));
    }
    finally { submitting.current = false; setBusy(false); }
  }
  const installing = busy && Boolean(preview);
  const needsRecovery = operation?.terminal && ['FAILED', 'NEEDS_RECOVERY'].includes(operation.phase);
  const totalChanges = preview ? preview.migrationPlan.applied.length + preview.migrationPlan.pending.length : 0;
  return <><Button variant="outline" className="bg-ground" size="sm" onClick={() => { select(null); setOpen(true); }}><Upload size={14} aria-hidden="true" />{c('upload')}</Button>
    <Dialog open={open} onOpenChange={value => { if (!busy) setOpen(value); }}><DialogContent {...dialogLayout} showCloseButton={false}><DialogHeader className="text-left"><DialogTitle className="text-[15px]">{c(done ? 'done' : installing ? 'installing' : preview ? 'confirm' : 'upload')}</DialogTitle><DialogDescription className="sr-only">{c('chooseNote')}</DialogDescription></DialogHeader>
      {error && <p role="alert" className="text-destructive">{error}</p>}
      {done ? <><p>{preview?.current.state === 'installed' ? t('merchant.plugins.upload.success') : pluginMessage(locale, 'doneNote', { name: preview?.package.name ?? '' })}</p>{warning && <p role="status">{warning}</p>}<div className="flex justify-end gap-2"><Button variant="outline" className="bg-ground" onClick={() => setOpen(false)}>{t('common.actions.close')}</Button><Button asChild><Link href={`/${locale}/plugins/${preview?.package.slug}`}>{c('configure')}</Link></Button></div></> : installing ? <div role="status" className="space-y-2">{totalChanges > 0 && <div role="progressbar" aria-label={c('installing')} aria-valuemin={0} aria-valuemax={totalChanges} aria-valuenow={operation?.committedPrefix ?? 0} className="h-1.5 overflow-hidden rounded-full border border-border bg-raised"><div className="h-full bg-foreground" style={{ width: `${Math.min(100, (operation?.committedPrefix ?? 0) / totalChanges * 100)}%` }} /></div>}<p>{pluginMessage(locale, 'progress', { name: preview?.package.name ?? '', count: totalChanges ? `${operation?.committedPrefix ?? 0} / ${totalChanges}` : operation?.committedPrefix ?? 0 })}</p></div> : <>
        {needsRecovery ? <><p>{t('merchant.plugins.upload.migrationApplied')}: {operation.committedPrefix}</p><p>{c('backup')}</p></> : !preview ? <><label className="relative flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border border-dashed border-border p-6 text-center focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring" onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); if (!busy) select(event.dataTransfer.files[0] ?? null); }}><Upload size={20} aria-hidden="true" /><span>{c('choose')}</span><span className="text-xs text-faint">{file?.name || c('drop')}</span><input className="sr-only" aria-label={c('choose')} type="file" accept=".zip,application/zip" disabled={busy} onChange={event => select(event.target.files?.[0] ?? null)} /></label><p className="text-xs text-muted-foreground">{c('chooseNote')}</p></> : <><PluginInstallPreview preview={preview} testSigningMode={testSigningMode} />{!preview.compatibility.compatible && <p role="alert">{t('merchant.plugins.upload.incompatible')}: {preview.compatibility.reason}</p>}{preview.requiresUnsignedConfirmation && <><p role="alert" className="rounded-lg border border-destructive-line bg-destructive-soft p-3 text-destructive">{c('unsignedWarning')}</p><label className="space-y-1.5">{pluginMessage(locale, 'confirmSlug', { slug: preview.package.slug })}<input aria-label={t('merchant.plugins.upload.confirmationSlug')} className="block h-[34px] w-full rounded-md border border-border bg-ground px-2.5 font-mono text-xs" value={typed} onChange={event => setTyped(event.target.value)} /></label></>}</>}
        <div className="flex justify-end gap-2"><Button variant="outline" className="bg-ground" disabled={busy} onClick={() => setOpen(false)}>{t('common.actions.cancel')}</Button><Button className="disabled:bg-raised disabled:text-faint disabled:opacity-100" disabled={busy || (!preview ? !file : !preview.compatibility.compatible || preview.requiresUnsignedConfirmation && typed !== preview.package.slug)} onClick={() => void (preview ? install() : inspect())}>{needsRecovery ? t('merchant.plugins.upload.migrationRetry') : preview ? c('confirm') : c('check')}</Button></div>
      </>}
    </DialogContent></Dialog>
  </>;
}
