'use client';
import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useT } from 'shared/src/i18n/react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { pluginUploadApi, pluginUploadErrorKey, type PluginUploadPreview, type PluginUploadOperation } from '@/lib/plugin-upload';
import { PluginTrustLabel } from './PluginTrust';

export function PluginUpload({ testSigningMode }: { testSigningMode: boolean }) {
  const t = useT(); const text = (key: string) => t(`merchant.plugins.upload.${key}`);
  const client = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PluginUploadPreview | null>(null);
  const [dialog, setDialog] = useState(false), [typedSlug, setTypedSlug] = useState('');
  const [busy, setBusy] = useState(false), [feedback, setFeedback] = useState<{ error: boolean; key: string } | null>(null);
  const [operation, setOperation] = useState<PluginUploadOperation | null>(null);
  const submitting = useRef(false), generation = useRef(0);
  const selectFile = (next: File | null) => { generation.current++; setFile(next); setPreview(null); setDialog(false); setTypedSlug(''); setFeedback(null); setOperation(null); };
  const inspect = async () => {
    if (!file || submitting.current) return;
    submitting.current = true; setBusy(true); setFeedback(null); setOperation(null); const selected = generation.current;
    try { const result = await pluginUploadApi.preview(file); if (selected === generation.current) setPreview(result); }
    catch (error) { if (selected === generation.current) setFeedback({ error: true, key: pluginUploadErrorKey(error) }); }
    finally { submitting.current = false; setBusy(false); }
  };
  const install = async (confirmationSlug?: string) => {
    if (!file || !preview || submitting.current || !preview.compatibility.compatible) return;
    if (preview.requiresUnsignedConfirmation && confirmationSlug !== preview.package.slug) return;
    submitting.current = true; setBusy(true); setFeedback(null);
    try {
      const result = await pluginUploadApi.install(file, preview, confirmationSlug, setOperation);
      await Promise.all([client.invalidateQueries({ queryKey: ['plugins'] }), client.invalidateQueries({ queryKey: ['extensions'] })]);
      setFeedback({ error: false, key: result.warnings.length ? 'installedWithWarning' : preview.operation === 'unchanged' ? 'unchangedSuccess' : 'success' });
      setPreview(null); setDialog(false); setTypedSlug('');
    } catch (error) { setDialog(false); setFeedback({ error: true, key: pluginUploadErrorKey(error) }); }
    finally { submitting.current = false; setBusy(false); }
  };
  const retry = async () => {
    if (!operation || submitting.current) return;
    submitting.current = true; setBusy(true); setFeedback(null);
    try {
      const result = await pluginUploadApi.retry(operation.operationId, setOperation);
      await Promise.all([client.invalidateQueries({ queryKey: ['plugins'] }), client.invalidateQueries({ queryKey: ['extensions'] })]);
      setFeedback({ error: false, key: result.warnings.length ? 'installedWithWarning' : 'success' });
      setPreview(null); setDialog(false); setTypedSlug('');
    } catch (error) { setFeedback({ error: true, key: pluginUploadErrorKey(error) }); }
    finally { submitting.current = false; setBusy(false); }
  };
  const migrationPlan = preview && !operation && <div className="space-y-2" aria-label={text('migrationPlan')}>
    <h4 className="font-semibold">{text('migrationPlan')}</h4>
    <p>{text('migrationNamespace')}: {preview.migrationPlan.schemaName}{preview.migrationPlan.provisionNamespace ? ` — ${text('migrationProvision')}` : ''}</p>
    <p>{text('migrationApplied')}: {preview.migrationPlan.applied.length}</p>
    <ul>{preview.migrationPlan.pending.map(item => <li key={item.id}>{item.order}. {item.path}</li>)}</ul>
    {preview.migrationPlan.changesDatabase && <><p>{text('backupRecommended')}</p><p>{text('migrationConfirmation')}</p></>}
  </div>;
  return <section aria-label={text('title')} className="rounded-xl border border-cool-soft bg-surface p-5 space-y-3">
    <h2 className="font-semibold">{text('title')}</h2>
    <label className="block">{text('file')}<input aria-label={text('file')} type="file" accept=".zip,application/zip" disabled={busy} onChange={event => selectFile(event.target.files?.[0] ?? null)} className="block mt-2" /></label>
    <Button disabled={!file || busy} onClick={() => void inspect()}>{busy ? text('working') : text('preview')}</Button>
    {feedback && <p role={feedback.error ? 'alert' : 'status'} className={feedback.error ? 'text-danger-strong' : 'text-success-strong'}>{text(feedback.key)}</p>}
    {busy && operation && !dialog && <p role="status">{text('migrationProgress')}: {operation.committedPrefix}</p>}
    {!busy && operation?.terminal && ['FAILED', 'NEEDS_RECOVERY'].includes(operation.phase) && <>
      {operation.phase === 'NEEDS_RECOVERY' && <p role="alert">{text('needsRecovery')}</p>}
      <p>{text('migrationApplied')}: {operation.committedPrefix}</p>
      <p>{text('backupRecommended')}</p><Button onClick={() => void retry()}>{text('migrationRetry')}</Button>
    </>}
    {preview && <div className="space-y-3">
      <h3 className="font-semibold">{preview.package.name}</h3>
      <p>{text(preview.operation)}: {preview.current.version && preview.operation === 'upgrade' ? `${preview.current.version} → ` : ''}{preview.package.version}</p>
      <PluginTrustLabel plugin={{ trustLevel: preview.package.trust, signingRoot: preview.package.publisher?.signingRoot ?? null }} testSigningMode={testSigningMode} />
      <p>{text('capabilities')}: {preview.package.declaredCapabilities.join(', ')}</p>
      {migrationPlan}
      {!preview.compatibility.compatible && <p role="alert">{text('incompatible')}: {preview.compatibility.reason}</p>}
      {preview.requiresUnsignedConfirmation && <p role="alert" className="text-danger-strong">{text('warning')}</p>}
      {!operation && <><Button disabled={busy || !preview.compatibility.compatible} onClick={() => preview.requiresUnsignedConfirmation ? setDialog(true) : void install()}>{preview.requiresUnsignedConfirmation ? text('continue') : text('installNow')}</Button>
      <Button variant="outline" disabled={busy} onClick={() => { setPreview(null); setTypedSlug(''); }}>{text('cancel')}</Button></>}
    </div>}
    <Dialog open={dialog} onOpenChange={open => { if (!busy) { setDialog(open); setTypedSlug(''); } }}>
      <DialogContent><DialogHeader><DialogTitle>{text('confirmationTitle')}</DialogTitle><DialogDescription>{text('warning')}</DialogDescription></DialogHeader>
        {busy && operation && <p role="status">{text('migrationProgress')}: {operation.committedPrefix}</p>}
        {migrationPlan}
        <p>{text('typeSlug')}: {preview?.package.slug}</p>
        <label>{text('confirmationSlug')}<input aria-label={text('confirmationSlug')} value={typedSlug} disabled={busy} onChange={event => setTypedSlug(event.target.value)} className="block w-full rounded border border-cool-soft p-2 mt-2" /></label>
        <Button disabled={busy || !preview || typedSlug !== preview.package.slug} onClick={() => void install(typedSlug)}>{text('confirmInstall')}</Button>
        <Button variant="outline" disabled={busy} onClick={() => { setDialog(false); setTypedSlug(''); }}>{text('cancel')}</Button>
      </DialogContent>
    </Dialog>
  </section>;
}
