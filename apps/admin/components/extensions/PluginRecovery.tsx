'use client';

import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useT } from 'shared/src/i18n/react';
import { pluginMessage } from 'shared/src/i18n/messages/admin-plugins';
import { pluginUploadApi } from '@/lib/plugin-upload';
import { usePluginDialogLayout } from '@/lib/plugin-dialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const phaseKey = (phase: string) => phase === 'QUEUED' ? 'queued' : phase === 'NEEDS_RECOVERY' ? 'needsRecovery' : phase === 'FAILED' ? 'failed' : phase === 'SUCCESS' || phase === 'RECOVERED' ? 'completed' : 'working';

export function PluginRecovery() {
  const locale = useLocale(), t = useT(), text = (key: string) => t('merchant.plugins.recovery.' + key);
  const dialogLayout = usePluginDialogLayout('confirm');
  const query = useQuery({ queryKey: ['plugin-recovery'], queryFn: pluginUploadApi.recovery, refetchInterval: 10_000 });
  const client = useQueryClient();
  const [target, setTarget] = useState<string | null>(null), [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false), [failed, setFailed] = useState(false), submitting = useRef(false);
  const items = query.data?.items.filter(item => item.maintenanceRequired || item.operations.some(operation => operation.publicationWarning || ['FAILED', 'NEEDS_RECOVERY'].includes(operation.phase))) ?? [];
  async function retry() {
    if (!target || !confirmed || submitting.current) return;
    submitting.current = true; setBusy(true); setFailed(false);
    try {
      await pluginUploadApi.retry(target);
      await Promise.all([client.invalidateQueries({ queryKey: ['plugin-recovery'] }), client.invalidateQueries({ queryKey: ['plugins'] }), client.invalidateQueries({ queryKey: ['extensions'] })]);
      setTarget(null); setConfirmed(false);
    } catch { setFailed(true); }
    finally { submitting.current = false; setBusy(false); }
  }
  if (query.isLoading) return null;
  if (query.error) return <p role="alert" className="text-attention">{text('loadFailed')}</p>;
  if (!items.length) return null;
  return <>
    <section role="alert" aria-label={text('title')} className="space-y-2.5 rounded-lg border border-attention-line bg-attention-soft px-3.5 py-3 text-attention">
      {items.map(item => <article key={item.slug} aria-label={item.slug} className="space-y-2.5">
        {item.maintenanceRequired && <p>{item.slug}: {text('maintenance')}</p>}
        {item.operations.filter(operation => operation.publicationWarning || ['FAILED', 'NEEDS_RECOVERY'].includes(operation.phase)).map(operation => <div key={operation.operationId} className="space-y-2.5">
          <p>{operation.publicationWarning ? `${item.slug}: ${text('publicationWarning')}` : pluginMessage(locale, 'recoveryNotice', { name: item.slug, count: operation.committedPrefix })}</p>
          {operation.retryAvailable && !item.maintenanceRequired && <Button size="sm" disabled={busy} onClick={() => { setTarget(operation.operationId); setConfirmed(false); setFailed(false); }}>{pluginMessage(locale, 'retryInstall')}</Button>}
        </div>)}
        {item.operations.length > 0 && <details><summary className="w-fit cursor-pointer list-none underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring">{t('merchant.plugins.viewDetails')}</summary><dl className="mt-2 space-y-1">{item.operations.map(operation => <div key={operation.operationId}><dt className="font-mono">{operation.version}</dt><dd>{text(phaseKey(operation.phase))}</dd><dd>{text('committed')}: {operation.committedPrefix}</dd></div>)}</dl></details>}
      </article>)}
    </section>
    <Dialog open={target !== null} onOpenChange={open => { if (!open && !busy) setTarget(null); }}><DialogContent {...dialogLayout} showCloseButton={false}><DialogHeader className="text-left"><DialogTitle className="text-[15px]">{pluginMessage(locale, 'retryInstall')}</DialogTitle><DialogDescription>{t('merchant.plugins.upload.backupRecommended')}</DialogDescription></DialogHeader>
      <label className="flex items-start gap-2"><input className="mt-0.5 accent-foreground" type="checkbox" checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)} />{text('confirmRetry')}</label>
      {failed && <p role="alert">{text('retryFailed')}</p>}
      <div className="flex justify-end gap-2"><Button variant="outline" className="bg-ground" disabled={busy} onClick={() => setTarget(null)}>{t('common.actions.cancel')}</Button><Button disabled={busy || !confirmed} onClick={() => void retry()}>{text('retry')}</Button></div>
    </DialogContent></Dialog>
  </>;
}
