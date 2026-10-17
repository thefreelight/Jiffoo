'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useT } from 'shared/src/i18n/react';
import { pluginUploadApi } from '@/lib/plugin-upload';
import { Button } from '@/components/ui/button';
import { useStoreDate } from '@/lib/store-time';
import { formatStoreTimestamp } from 'shared';

export function PluginDatabaseAudit() {
  const t = useT(), text = (key: string, values?: Record<string, string | number>) => t(`merchant.healthView.${key}`, values);
  const { timezone } = useStoreDate();
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
  return <section aria-label={text('audit')} className="overflow-hidden rounded-[10px] border border-border text-[13px] text-foreground">
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3"><div className="space-y-0.5"><h2 className="font-semibold">{text('audit')}</h2><p className="text-xs text-faint">{text('auditNote')}</p></div><Button size="sm" variant="outline" onClick={scan} disabled={busy}>{text(busy ? 'scanning' : 'scan')}</Button></div>
    <p className="px-4 pt-3 text-xs leading-relaxed text-faint">{t('merchant.plugins.databaseAudit.notice')}</p>
    {query.isLoading ? <p role="status" className="p-4">{text('scanning')}</p> : query.error || failed ? <p role="alert" className="p-4 text-destructive">{text('scanFailed')}</p> : null}
    {latest ? <div><dl className="grid grid-cols-3 gap-3 px-4 py-4">{(['installed', 'blocking', 'warnings'] as const).map((key, index) => <div key={key}><dt className="text-xs text-muted-foreground">{text(key)}</dt><dd className={`mt-1 font-mono text-lg ${key === 'blocking' && latest.counts.blocking > 0 ? 'text-attention' : ''}`}>{[latest.counts.plugins, latest.counts.blocking, latest.counts.warning][index]}</dd></div>)}</dl>{!latest.complete && <p role="status" className="px-4 pb-3 text-attention">{text('incomplete')}</p>}<p className="px-4 pb-3 text-xs leading-relaxed text-faint"><time dateTime={latest.finishedAt}>{text('scannedAt', { time: formatStoreTimestamp(latest.finishedAt, timezone), timezone })}</time></p></div> : !query.isLoading && !query.error && <p className="p-4 text-muted-foreground">{text('notScanned')}</p>}
  </section>;
}
