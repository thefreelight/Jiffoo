'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useLocale, useT } from 'shared/src/i18n/react';
import { formatStoreTimestamp, storeLocalToUtc } from 'shared';
import { useStoreDate } from '@/lib/store-time';
import { auditActionKeys, auditEventsApi, summaryText, type AuditEvent, type AuditFilters, type AuditQuery } from '@/lib/audit-events';
import { listChoice, useListState, type ListFields } from '@/lib/hooks/use-list-state';
import { Choice } from '@/components/operations/Choice';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/operations/Pagination';

const categories = ['payment', 'plugin', 'theme', 'code', 'settings', 'notification', 'system', 'accounts'];
const operationKeys: Record<string, string> = {
  'customer.deactivated': 'customerDeactivated', 'customer.reactivated': 'customerReactivated', 'customer.renamed': 'customerRenamed', 'customer.deleted': 'customerDeleted',
  NOTIFICATION_RESENT: 'notificationResent', CUSTOMER_PASSWORD_RESET_LINK_GENERATED: 'customerReset', ADMIN_INVITED: 'administratorInvited', ADMIN_REMOVED: 'administratorRemoved', ADMIN_REINVITED: 'administratorReinvited', ADMIN_INVITE_ACCEPTED: 'administratorAccepted', THEME_UNSIGNED_INSTALL_CONFIRMED: 'unsignedThemeConfirmed', BUILTIN_PLUGIN_INSTALLED: 'builtinPluginInstalled',
  PAYMENT_REVIEW_CONFIRMED_PAID: 'paymentConfirmed', PAYMENT_REVIEW_CLOSED_NOT_CHARGED: 'paymentNotCharged', PAYMENT_REVIEW_REQUIRED: 'paymentReview', PAYMENT_OBSERVATION_REVIEW_REQUIRED: 'paymentReview', PAYMENT_REVIEW_CONTRADICTED: 'paymentContradicted', PAYMENT_REFUND_REQUIRED_RESOLVED: 'refundResolved',
};
const fields: ListFields = {
  category: listChoice(['', ...categories]), actorId: { default: '', valid: () => true },
  from: { default: '', valid: value => !value || /^\d{4}-\d{2}-\d{2}T/.test(value) }, to: { default: '', valid: value => !value || /^\d{4}-\d{2}-\d{2}T/.test(value) },
  sort: listChoice(['newest', 'oldest']), page: { default: '1', valid: value => /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value)) }, pageSize: listChoice(['20', '50', '100']),
};
const categoryOf = (item: AuditEvent) => item.action.startsWith('CORE_') ? 'system' : item.action.startsWith('storefront-code.') ? 'code' : /^(STAFF_|CUSTOMER_|api_token)/.test(item.action) || ['staff', 'user', 'customer', 'api_token'].includes(item.targetType) ? 'accounts' : categories.includes(item.targetType) ? item.targetType : 'other';

export default function AuditEventsPage() {
  const t = useT(), locale = useLocale(), { timezone } = useStoreDate();
  const c = (key: string, values?: Record<string, string | number>) => t(`merchant.auditView.${key}`, values);
  const { state, update } = useListState(fields), page = Number(state.page), size = Number(state.pageSize);
  const [filters, setFilters] = useState<AuditFilters>({ actions: [], targetTypes: [], actors: [] });
  const [items, setItems] = useState<AuditEvent[]>([]), [total, setTotal] = useState(0), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null), [technical, setTechnical] = useState<string | null>(null), [exporting, setExporting] = useState(false), [revision, setRevision] = useState(0);
  const query = useMemo(() => {
    try {
      const from = state.from ? storeLocalToUtc(state.from, timezone) : undefined, to = state.to ? storeLocalToUtc(state.to, timezone) : undefined;
      if (from && to && from > to) return null;
      return { category: state.category || undefined, actorId: state.actorId || undefined, from, to, sort: state.sort } satisfies AuditQuery;
    } catch { return null; }
  }, [state.category, state.actorId, state.from, state.to, state.sort, timezone]);
  useEffect(() => { let active = true; auditEventsApi.filters().then(value => { if (active) setFilters(value); }).catch(() => { if (active) setError('failed'); }); return () => { active = false; }; }, [revision]);
  useEffect(() => {
    let active = true; setError(''); setExpanded(null); setTechnical(null);
    if (!query) { setError('invalidTime'); setLoading(false); setItems([]); setTotal(0); return; }
    setLoading(true);
    auditEventsApi.list(page, query, size).then(data => { if (active) { setItems(data.items); setTotal(data.total); } }).catch(() => { if (active) { setError('failed'); setItems([]); setTotal(0); } }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [page, size, query, revision]);
  const filter = (patch: Record<string, string>) => update({ ...patch, page: '1' });
  const actionLabel = (item: AuditEvent) => Object.prototype.hasOwnProperty.call(operationKeys, item.action) ? c(operationKeys[item.action]) : Object.prototype.hasOwnProperty.call(auditActionKeys, item.action) ? t(`merchant.auditEvents.actions.${auditActionKeys[item.action]}`) : item.action;
  const actorLabel = (item: AuditEvent) => item.actor?.username || item.actor?.email || (item.actorId === 'system' ? c('systemActor') : c('missingActor'));
  const toggle = (id: string) => { setExpanded(current => current === id ? null : id); setTechnical(null); };
  async function exportRecords() {
    if (!query || exporting) return;
    setExporting(true); setError('');
    try {
      const first = await auditEventsApi.list(1, query, 100), records = [...first.items];
      for (let index = 2; index <= first.totalPages; index++) records.push(...(await auditEventsApi.list(index, query, 100)).items);
      const url = URL.createObjectURL(new Blob([JSON.stringify({ timezone, filters: query, records }, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a'); link.href = url; link.download = 'audit-events.json'; link.click(); URL.revokeObjectURL(url);
    } catch { setError('exportFailed'); } finally { setExporting(false); }
  }
  const details = (item: AuditEvent) => {
    const summary = item.summary && typeof item.summary === 'object' && !Array.isArray(item.summary) ? item.summary as Record<string, unknown> : {};
    const labels: Record<string, string> = { from: 'before', to: 'after', result: 'result', reason: 'note', note: 'note', email: 'email', amount: 'amount', currency: 'amount', orderId: 'target', paymentId: 'target', refundId: 'target', reference: 'note', outcome: 'result', version: 'after', previousVersion: 'before', revision: 'after', fromRevision: 'before', slug: 'target', operation: 'operation', target: 'target', toRevision: 'after' };
    const facts = Object.entries({ ...summary, ...(typeof summary.orderId === 'string' && item.context?.path.startsWith('/orders/') ? { orderId: item.context.label } : {}), ...(Array.isArray(summary.changedFields) ? { note: summary.changedFields.filter(value => typeof value === 'string').join(', ') } : {}), ...(item.paymentContext ? { amount: `${item.paymentContext.currency} ${item.paymentContext.amount} · ${c('paymentAttempt', { count: item.paymentContext.attemptNumber })}` } : {}) }).filter(([key, value]) => key in labels && ['string', 'number', 'boolean'].includes(typeof value));
    return <div className="space-y-2 rounded-[10px] border border-border bg-ground px-3.5 py-1"><dl><div className="flex flex-wrap gap-x-3 gap-y-1 border-b border-border py-2"><dt className="w-24 text-muted-foreground">{c('target')}</dt><dd className="min-w-0 flex-1 basis-48 break-all">{item.context?.path ? <Link className={item.context.path.startsWith('/orders/') ? 'font-mono underline' : 'underline'} href={`/${locale}${item.context.path}`}>{item.context.label} →</Link> : item.targetLabel || item.targetId}</dd></div>{facts.map(([key, value]) => <div className="flex flex-wrap gap-x-3 gap-y-1 border-b border-border py-2" key={key}><dt className="w-24 text-muted-foreground">{c(labels[key])}</dt><dd className={`min-w-0 flex-1 basis-48 break-words ${key === 'orderId' ? 'font-mono' : ''}`}>{String(value)}</dd></div>)}</dl>{!facts.length && <p className="py-2 text-xs text-faint">{c('noFacts')}</p>}<button className="min-h-[34px] text-muted-foreground" aria-expanded={technical === item.id} onClick={() => setTechnical(current => current === item.id ? null : item.id)}>{c('technical')} ›</button>{technical === item.id && <pre className="max-w-full whitespace-pre-wrap break-all pb-3 font-mono text-xs">{summaryText(item, c('noFacts'))}</pre>}</div>;
  };
  const control = 'h-[34px] min-w-0 rounded-[7px] border border-border bg-raised px-3 text-foreground';
  return <section className="mx-auto w-full max-w-[1120px] space-y-4 px-4 pb-10 text-[13px] text-foreground sm:px-8">
    <header className="flex flex-wrap items-start justify-between gap-3"><div className="space-y-1.5"><h1 className="text-[26px] font-semibold tracking-tight">{c('title')}</h1><p className="text-muted-foreground">{c('description')}</p></div><Button size="sm" variant="outline" disabled={exporting || !query || loading || total === 0} onClick={() => void exportRecords()}>{c(exporting ? 'exporting' : 'export')}</Button></header>
    <div className="flex flex-wrap gap-2"><Choice label={c('category')} prefix value={state.category} onChange={category => filter({ category })} options={[{ value: '', label: c('all') }, ...categories.map(value => ({ value, label: c(value) }))]} /><Choice label={c('actor')} prefix value={state.actorId} onChange={actorId => filter({ actorId })} options={[{ value: '', label: c('all') }, ...filters.actors.map(actor => ({ value: actor.id, label: `${actor.username} · ${actor.email}` }))]} className="max-w-60" /><details className="rounded-[7px] border border-border bg-raised"><summary className="cursor-pointer px-3 py-2 text-muted-foreground">{c('time')}</summary><div className="flex flex-wrap gap-2 p-3">{(['from', 'to'] as const).map(key => <label key={key} className="flex min-w-0 flex-col gap-1 text-faint">{c(key)} ({timezone})<input className={control + ' max-w-full'} type="datetime-local" step="0.001" value={state[key]} onChange={event => filter({ [key]: event.target.value })} /></label>)}</div></details></div>
    {['category', 'actorId', 'from', 'to'].some(key => state[key]) && <div className="flex flex-wrap items-center gap-1.5">{['category', 'actorId', 'from', 'to'].filter(key => state[key]).map(key => { const label = key === 'category' ? c(state[key]) : key === 'actorId' ? filters.actors.find(actor => actor.id === state[key])?.username ?? state[key] : state[key]; return <Button key={key} size="sm" variant="outline" className="h-[26px] rounded-full bg-raised" aria-label={c('remove', { value: label })} onClick={() => filter({ [key]: '' })}>{label} ×</Button>; })}<Button size="sm" variant="ghost" className="underline underline-offset-4" onClick={() => filter({ category: '', actorId: '', from: '', to: '' })}>{c('clear')}</Button></div>}
    {error && <div role="alert" className="flex flex-wrap items-center gap-3 text-destructive">{c(error)}<Button size="sm" variant="outline" onClick={() => setRevision(value => value + 1)}>{c('retry')}</Button></div>}
    {loading ? <p role="status" className="py-10 text-center text-muted-foreground">{c('loading')}</p> : ['failed', 'invalidTime'].includes(error) ? null : !items.length ? <p className="rounded-[10px] border border-border py-10 text-center text-muted-foreground">{c('empty')}</p> : <>
      <div className="hidden overflow-hidden rounded-[10px] border border-border md:block"><table aria-label={c('title')} aria-busy={loading} className="w-full border-collapse text-left"><thead className="bg-raised text-xs text-faint"><tr><th className="w-44 px-4 py-2.5 font-medium" aria-sort={state.sort === 'newest' ? 'descending' : 'ascending'}><button onClick={() => filter({ sort: state.sort === 'newest' ? 'oldest' : 'newest' })}>{c('timeHeader', { timezone })} {state.sort === 'newest' ? '↓' : '↑'}</button></th><th className="px-3 py-2.5 font-medium">{c('operation')}</th><th className="px-3 py-2.5 font-medium">{c('actor')}</th><th><span className="sr-only">{c('technical')}</span></th></tr></thead><tbody>{items.map(item => <Fragment key={item.id}><tr className={`cursor-pointer border-t border-border hover:bg-raised ${expanded === item.id ? 'bg-active' : ''}`} onClick={() => toggle(item.id)}><td className="whitespace-nowrap px-4 py-2.5 align-top text-muted-foreground">{formatStoreTimestamp(item.createdAt, timezone)}</td><td className="px-3 py-2.5 align-top"><p>{actionLabel(item)}{(item.targetLabel || item.context) && <span className={item.context?.path.startsWith('/orders/') ? 'font-mono' : undefined}> · {item.targetLabel || item.context?.label}</span>}</p><p className="text-xs text-faint">{c(categoryOf(item))}</p></td><td className="max-w-48 break-words px-3 py-2.5 align-top">{actorLabel(item)}</td><td className="px-4 py-1.5 align-top"><Button size="sm" variant="ghost" aria-expanded={expanded === item.id} aria-label={c(expanded === item.id ? 'collapse' : 'expand', { action: actionLabel(item) })} onClick={event => { event.stopPropagation(); toggle(item.id); }}>{expanded === item.id ? '⌄' : '›'}</Button></td></tr>{expanded === item.id && <tr className="bg-active"><td /><td colSpan={3} className="px-3 pb-3.5">{details(item)}</td></tr>}</Fragment>)}</tbody></table></div>
      <div className="space-y-2 md:hidden"><button className="min-h-[34px] text-xs text-faint" onClick={() => filter({ sort: state.sort === 'newest' ? 'oldest' : 'newest' })}>{c('timeHeader', { timezone })} {state.sort === 'newest' ? '↓' : '↑'}</button>{items.map(item => <article key={item.id} className="overflow-hidden rounded-[10px] border border-border"><button className="block w-full space-y-2 p-4 text-left" aria-expanded={expanded === item.id} aria-label={c(expanded === item.id ? 'collapse' : 'expand', { action: actionLabel(item) })} onClick={() => toggle(item.id)}><span className="block break-words font-medium">{actionLabel(item)}{(item.targetLabel || item.context) && <span className={item.context?.path.startsWith('/orders/') ? 'font-mono' : undefined}> · {item.targetLabel || item.context?.label}</span>}</span><span className="block text-xs text-faint">{c(categoryOf(item))}</span><span className="flex flex-wrap justify-between gap-2 text-muted-foreground"><span>{formatStoreTimestamp(item.createdAt, timezone)}</span><span className="break-all">{actorLabel(item)}</span></span></button>{expanded === item.id && <div className="px-4 pb-4">{details(item)}</div>}</article>)}</div>
    </>}
    <Pagination page={page} size={size} total={loading || ['failed', 'invalidTime'].includes(error) ? null : total} busy={loading} onChange={(next, pageSize) => update({ page: String(next), pageSize: String(pageSize) })} /><p className="text-xs leading-relaxed text-faint">{c('footnote')}</p>
  </section>;
}
