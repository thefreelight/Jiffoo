'use client';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useT } from 'shared/src/i18n/react';
import { pluginUploadApi } from '@/lib/plugin-upload';
import { Button } from '@/components/ui/button';

export function PluginRecovery() {
  const t = useT(), text = (key: string) => t(`merchant.plugins.recovery.${key}`);
  const query = useQuery({ queryKey: ['plugin-recovery'], queryFn: pluginUploadApi.recovery, refetchInterval: 10_000 });
  const client = useQueryClient();
  const [confirmed, setConfirmed] = useState<string | null>(null), [busy, setBusy] = useState<string | null>(null), [failed, setFailed] = useState(false);
  if (query.isLoading) return <p role="status">{text('loading')}</p>;
  if (query.error) return <p role="alert">{text('loadFailed')}</p>;
  if (!query.data?.items.length) return null;
  const retry = async (id: string) => {
    if (busy || confirmed !== id) return;
    setBusy(id); setFailed(false);
    try { await pluginUploadApi.retry(id); await Promise.all([client.invalidateQueries({ queryKey: ['plugin-recovery'] }), client.invalidateQueries({ queryKey: ['plugins'] }), client.invalidateQueries({ queryKey: ['extensions'] })]); setConfirmed(null); }
    catch { setFailed(true); } finally { setBusy(null); }
  };
  return <section aria-label={text('title')} className="rounded-xl border border-cool-soft bg-surface p-5 space-y-3">
    <h2>{text('title')}</h2>
    {failed && <p role="alert">{text('retryFailed')}</p>}
    {query.data.items.map(item => <article key={item.slug} aria-label={item.slug} className="space-y-2">
      <h3>{item.slug}</h3>
      {item.maintenanceRequired && <p role="alert">{text('maintenance')}</p>}
      {item.operations.map(operation => <div key={operation.operationId}>
        <p>{operation.version}: {text(operation.phase === 'QUEUED' ? 'queued' : operation.phase === 'NEEDS_RECOVERY' ? 'needsRecovery' : operation.phase === 'FAILED' ? 'failed' : operation.phase === 'SUCCESS' || operation.phase === 'RECOVERED' ? 'completed' : 'working')}</p>
        <p>{text('committed')}: {operation.committedPrefix}</p>
        {operation.publicationWarning && <p role="status">{text('publicationWarning')}</p>}
        {operation.retryAvailable && !item.maintenanceRequired && <>
          <p>{t('merchant.plugins.upload.backupRecommended')}</p>
          <label><input type="checkbox" checked={confirmed === operation.operationId} disabled={Boolean(busy)} onChange={event => setConfirmed(event.target.checked ? operation.operationId : null)} />{text('confirmRetry')}</label>
          <Button disabled={Boolean(busy) || confirmed !== operation.operationId} onClick={() => void retry(operation.operationId)}>{text('retry')}</Button>
        </>}
      </div>)}
    </article>)}
  </section>;
}
