'use client';

import { Button } from '@/components/ui/button';
import { useT } from 'shared/src/i18n/react';
import { formatStoreTimestamp } from 'shared';
import { useStoreDate } from '@/lib/store-time';
import { useHealthSummary } from '@/lib/hooks/use-api';
import { PluginDatabaseAudit } from '@/components/extensions/PluginDatabaseAudit';

export default function HealthMonitoringPage() {
  const t = useT(), c = (key: string, values?: Record<string, string | number>) => t(`merchant.healthView.${key}`, values);
  const { timezone } = useStoreDate();
  const { data: summary, isLoading, error, refetch } = useHealthSummary();
  const down = summary?.database.status === 'error' || summary?.redis.status === 'error';
  const stopped = summary && !summary.worker.running;
  const state = down ? 'redisDown' : stopped ? 'workerDown' : 'healthy';
  const parts = summary ? [
    { key: 'database', ok: summary.database.status === 'ok', detail: '' },
    { key: 'redis', ok: summary.redis.status === 'ok', detail: '' },
    { key: 'worker', ok: summary.worker.running, detail: [summary.worker.running ? c('running', { count: summary.worker.instances }) : '', summary.worker.lastBeatAt ? c('lastBeat', { time: formatStoreTimestamp(summary.worker.lastBeatAt, timezone) }) : c('noBeat')].filter(Boolean).join(' · ') },
    { key: 'plugins', ok: summary.pluginRuntime.status === 'ok', detail: c('loaded', { count: summary.pluginRuntime.loaded }) },
  ] : [];
  return <section className="mx-auto w-full max-w-[760px] space-y-5 px-4 pb-10 text-[13px] text-foreground sm:px-8">
    <header className="flex flex-wrap items-start justify-between gap-3"><div className="space-y-1.5"><h1 className="text-[26px] font-semibold tracking-tight">{c('title')}</h1><p className="text-muted-foreground">{c('description')}</p><p className="text-xs text-faint">{c('timeZone', { timezone })}</p></div><Button size="sm" variant="outline" disabled={isLoading} onClick={() => void refetch()}>{c('refresh')}</Button></header>
    {isLoading && <p role="status">{c('loading')}</p>}
    {error && <p role="alert" className="text-destructive">{c('failed')}</p>}
    {summary && <>
      <section aria-label={c('overall')} className={`flex gap-3 rounded-[10px] border p-4 ${down ? 'border-destructive-line bg-destructive-soft' : stopped ? 'border-attention-line bg-attention-soft' : 'border-border bg-raised'}`}>
        <span aria-hidden="true" className={`mt-1.5 size-2.5 shrink-0 rounded-full ${down ? 'bg-destructive' : stopped ? 'bg-attention' : 'bg-foreground'}`} /><div className="space-y-1 leading-relaxed"><h2 className={`font-semibold ${down ? 'text-destructive' : stopped ? 'text-attention' : ''}`}>{c(state)}</h2><p className="text-muted-foreground">{summary.database.status === 'error' ? c('databaseDown') : c(`${state}Note`)}</p></div>
      </section>
      <section aria-label={c('services')} className="overflow-hidden rounded-[10px] border border-border"><h2 className="border-b border-border px-4 py-3 font-semibold">{c('services')}</h2>{parts.map(part => <div key={part.key} role="group" aria-label={c(part.key)} className="flex flex-wrap justify-between gap-x-4 gap-y-2 border-b border-border px-4 py-3 last:border-0"><div className="flex-1 basis-60 space-y-0.5"><h3 className="font-medium">{c(part.key)}</h3><p className="text-xs leading-relaxed text-faint">{c(`${part.key}Note`)}</p></div><div className="max-w-full space-y-0.5 text-right"><p className={`flex items-center justify-end gap-2 ${part.ok ? '' : part.key === 'worker' ? 'text-attention' : 'text-destructive'}`}><span aria-hidden="true" className={`size-[7px] rounded-full border border-current ${part.ok ? 'bg-current' : ''}`} />{c(part.ok ? 'ok' : part.key === 'worker' ? 'stopped' : 'unavailable')}</p>{part.detail && <p className="break-words text-xs text-faint">{part.detail}</p>}</div></div>)}</section>
      <section className="overflow-hidden rounded-[10px] border border-border"><h2 className="border-b border-border px-4 py-3 font-semibold">{c('version')}</h2><dl className="px-4 py-1"><div className="flex gap-4 border-b border-border py-2"><dt className="w-24 shrink-0 text-muted-foreground">{c('jiffooVersion')}</dt><dd className="break-all font-mono text-xs">{summary.version}{summary.gitSha !== 'development' && <span className="text-faint"> · {summary.gitSha.slice(0, 7)}</span>}</dd></div><div className="flex gap-4 py-2"><dt className="w-24 shrink-0 text-muted-foreground">{c('uptime')}</dt><dd>{c('duration', { days: Math.floor(summary.uptime / 86400), hours: Math.floor(summary.uptime / 3600) % 24, minutes: Math.floor(summary.uptime / 60) % 60 })}</dd></div></dl></section>
    </>}
    <PluginDatabaseAudit />
  </section>;
}
