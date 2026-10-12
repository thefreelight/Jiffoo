'use client';

import { useStoreDate } from '@/lib/store-time';
import { storeLocalToUtc } from 'shared';
import { Fragment, useEffect, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, ScrollText } from 'lucide-react';
import { useT } from 'shared/src/i18n/react';
import { auditActionKeys, auditEventsApi, summaryText, type AuditEvent, type AuditFilters, type AuditQuery } from '@/lib/audit-events';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function AuditEventsPage() {
  const { date: storeDate, timezone } = useStoreDate();
  const t = useT();
  const label = (key: string) => t(`merchant.auditEvents.${key}`);
  const actionLabel = (action: string) => Object.prototype.hasOwnProperty.call(auditActionKeys, action)
    ? label(`actions.${auditActionKeys[action]}`) : action;
  const eventLabel = (item: AuditEvent) => item.action === 'CORE_UPDATE' && item.summary !== null && typeof item.summary === 'object' && 'runKind' in item.summary && item.summary.runKind === 'plan'
    ? label('corePlan') : actionLabel(item.action);
  const [filters, setFilters] = useState<AuditFilters>({ actions: [], targetTypes: [], actors: [] });
  const [query, setQuery] = useState<AuditQuery>({});
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<AuditEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    auditEventsApi.filters().then((data) => { if (active) setFilters(data); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : String(reason)); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setExpanded(null);
    auditEventsApi.list(page, query).then((data) => {
      if (active) { setItems(data.items); setTotal(data.total); setTotalPages(data.totalPages); }
    }).catch((reason: unknown) => {
      if (active) {
        setError(reason instanceof Error ? reason.message : String(reason));
        setItems([]); setTotal(0); setTotalPages(0);
      }
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [page, query]);

  function change(key: keyof AuditQuery, value: string) {
    setQuery((current) => ({ ...current, [key]: value || undefined }));
    setPage(1);
  }
  const changeTime = (key: 'from' | 'to', value: string) => {
    try { change(key, value ? storeLocalToUtc(value, timezone) : ''); setError(''); }
    catch { setError(label('invalidTime')); }
  };

  const inputClass = 'h-10 w-full min-w-0 rounded border border-neutral-soft bg-surface px-3 text-sm';
  return (
    <main className="mx-auto w-full max-w-7xl space-y-5 px-4 pb-6 pt-20 md:px-6 lg:pt-6">
      <h1 className="flex items-center gap-2 text-2xl font-semibold"><ScrollText className="h-5 w-5" />{label('title')}</h1>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <label className="min-w-0 space-y-1 text-sm">{label('actor')}
          <select className={inputClass} value={query.actorId ?? ''} onChange={(event) => change('actorId', event.target.value)}>
            <option value="">{label('allActors')}</option>
            {filters.actors.map((actor) => <option key={actor.id} value={actor.id}>{actor.email} ({actor.username})</option>)}
          </select>
        </label>
        <label className="min-w-0 space-y-1 text-sm">{label('action')}
          <select className={inputClass} value={query.action ?? ''} onChange={(event) => change('action', event.target.value)}>
            <option value="">{label('allActions')}</option>
            {filters.actions.map((action) => <option key={action} value={action}>{actionLabel(action)}</option>)}
          </select>
        </label>
        <label className="min-w-0 space-y-1 text-sm">{label('targetType')}
          <select className={inputClass} value={query.targetType ?? ''} onChange={(event) => change('targetType', event.target.value)}>
            <option value="">{label('allTargets')}</option>
            {filters.targetTypes.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
        </label>
        <label className="min-w-0 space-y-1 text-sm">{label('from')} ({timezone})
          <input aria-label={label('from')} className={inputClass} type="datetime-local" step="0.001"
            onChange={(event) => changeTime('from', event.target.value)} />
        </label>
        <label className="min-w-0 space-y-1 text-sm">{label('to')} ({timezone})
          <input aria-label={label('to')} className={inputClass} type="datetime-local" step="0.001"
            onChange={(event) => changeTime('to', event.target.value)} />
        </label>
      </div>
      {error && <p role="alert" className="text-sm text-danger-deep">{error}</p>}
      <Table aria-label={label('title')} aria-busy={loading}>
        <TableHeader><TableRow>
          <TableHead>{label('time')}</TableHead><TableHead>{label('actor')}</TableHead>
          <TableHead>{label('action')}</TableHead><TableHead>{label('target')}</TableHead>
          <TableHead><span className="sr-only">{label('details')}</span></TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {!loading && items.map((item) => <Fragment key={item.id}>
            <TableRow>
              <TableCell className="whitespace-nowrap">{storeDate(item.createdAt)}</TableCell>
              <TableCell className="min-w-40 break-all">
                {item.actor ? <>{item.actor.email}<span className="block text-xs text-neutral-base">{item.actor.username}</span>
                  {!item.actor.isActive && <span className="block text-xs text-danger-deep">{label('deactivated')}</span>}</> : item.targetType === 'core' ? item.actorId : label('deletedAccount')}
              </TableCell>
              <TableCell className="min-w-40">{eventLabel(item)}
                {item.targetType === 'core' && item.summary !== null && typeof item.summary === 'object' && 'result' in item.summary &&
                  <span className="block text-xs">{label(`coreResults.${String(item.summary.result)}`)}</span>}
              </TableCell>
              <TableCell className="min-w-40 break-all">{item.targetType}<span className="block text-xs text-neutral-base">{item.targetId}</span></TableCell>
              <TableCell><Button variant="ghost" size="icon" title={label('details')}
                aria-label={`${label('details')} ${item.id}`} aria-expanded={expanded === item.id}
                onClick={() => setExpanded((current) => current === item.id ? null : item.id)}>
                {expanded === item.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button></TableCell>
            </TableRow>
            {expanded === item.id && <TableRow><TableCell colSpan={5}>
              <pre aria-label={label('summary')} className="max-w-full whitespace-pre-wrap break-all rounded bg-neutral-faint p-3 text-xs">
                {summaryText(item.summary, label('notRecorded'))}
              </pre>
            </TableCell></TableRow>}
          </Fragment>)}
          {loading && <TableRow><TableCell colSpan={5} className="py-10 text-center">{label('loading')}</TableCell></TableRow>}
          {!loading && !error && items.length === 0 && <TableRow><TableCell colSpan={5} className="py-10 text-center">{label('empty')}</TableCell></TableRow>}
        </TableBody>
      </Table>
      <div className="flex flex-wrap items-center justify-end gap-3 text-sm">
        <span aria-label={label('total')}>{total}</span>
        <Button variant="outline" size="icon" title={label('previous')} aria-label={label('previous')}
          disabled={loading || page <= 1} onClick={() => setPage((value) => value - 1)}><ChevronLeft className="h-4 w-4" /></Button>
        <span aria-label={label('page')}>{page} / {Math.max(totalPages, 1)}</span>
        <Button variant="outline" size="icon" title={label('next')} aria-label={label('next')}
          disabled={loading || page >= totalPages} onClick={() => setPage((value) => value + 1)}><ChevronRight className="h-4 w-4" /></Button>
      </div>
    </main>
  );
}
