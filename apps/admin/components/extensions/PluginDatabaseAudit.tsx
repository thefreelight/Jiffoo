'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useT } from 'shared/src/i18n/react';
import { pluginUploadApi } from '@/lib/plugin-upload';
import { Button } from '@/components/ui/button';

export function PluginDatabaseAudit() {
  const t = useT(), text = (key: string) => t(`merchant.plugins.databaseAudit.${key}`);
  const query = useQuery({ queryKey: ['plugin-database-audit'], queryFn: pluginUploadApi.auditSummary });
  const client = useQueryClient();
  const [busy, setBusy] = useState(false), [failed, setFailed] = useState(false);
  const scan = async () => {
    if (busy) return;
    setBusy(true); setFailed(false);
    try { client.setQueryData(['plugin-database-audit'], await pluginUploadApi.audit()); }
    catch { setFailed(true); } finally { setBusy(false); }
  };
  const latest = query.data?.latest;
  return <section aria-label={text('title')} className="rounded-xl border border-cool-soft bg-surface p-5 space-y-3">
    <h2>{text('title')}</h2>
    <p>{text('notice')}</p>
    {query.isLoading ? <p role="status">{text('loading')}</p> : query.error || failed ? <p role="alert">{text('failed')}</p> : latest ? <div>
      <p>{text('scannedAt')}: <time dateTime={latest.finishedAt}>{latest.finishedAt}</time></p>
      <p role="status">{text(latest.complete ? 'complete' : 'incomplete')}</p>
      <p>{text('plugins')}: {latest.counts.plugins}</p>
      <p>{text('blocking')}: {latest.counts.blocking}</p>
      <p>{text('warnings')}: {latest.counts.warning}</p>
    </div> : <p>{text('notScanned')}</p>}
    <Button onClick={scan} disabled={busy}>{text(busy ? 'scanning' : 'scan')}</Button>
  </section>;
}
