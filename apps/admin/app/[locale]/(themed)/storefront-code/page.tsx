'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useT } from 'shared/src/i18n/react';
import { formatStoreTimestamp, storefrontCodeProviderPatterns, storefrontCodeSlotCap, storefrontCodeCharacterCount, isStorefrontCodeProviderId } from 'shared';
import { codeViewMessage, type CodeViewLabel } from 'shared/src/i18n/messages/admin-code-view';
import { themeMessage, type ThemeLabel } from 'shared/src/i18n/messages/admin-themes';
import type { Locale } from '@/lib/themes';
import { useStoreDate } from '@/lib/store-time';
import { AdminApiError, staffApi, unwrapApiResponse } from '@/lib/api';
import { storefrontCodeApi, type CodeConfiguration, type CodeFields, type CodeHistory, type CodeRevision } from '@/lib/storefront-code';
import { registerNavigationGuard } from '@/lib/pending-navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter } from '@/components/ui/alert-dialog';

const providers = Object.keys(storefrontCodeProviderPatterns) as Array<keyof typeof storefrontCodeProviderPatterns>;
const slots = ['headCode', 'bodyStartCode', 'bodyEndCode'] as const;
type Draft = Record<keyof CodeFields, string>;
const draftOf = (value: CodeFields): Draft => ({ ga4MeasurementId: value.ga4MeasurementId ?? '', metaPixelId: value.metaPixelId ?? '', baiduSiteKey: value.baiduSiteKey ?? '', headCode: value.headCode, bodyStartCode: value.bodyStartCode, bodyEndCode: value.bodyEndCode });
export function invalidCodeFields(draft: Draft): (keyof Draft)[] {
  return [...providers.filter(key => draft[key] !== '' && !isStorefrontCodeProviderId(key, draft[key])), ...slots.filter(key => storefrontCodeCharacterCount(draft[key]) > storefrontCodeSlotCap)];
}

export default function StorefrontCodePage() {
  const t = useT(), locale = useLocale() as Locale, router = useRouter(), { timezone } = useStoreDate();
  const text = (key: string) => t('merchant.storefrontCode.' + key), c = (key: CodeViewLabel) => codeViewMessage(locale, key), th = (key: ThemeLabel) => themeMessage(locale, key), leave = (key: string) => t('merchant.profileView.' + key);
  const [config, setConfig] = useState<CodeConfiguration | null>(null), [draft, setDraft] = useState<Draft | null>(null), [history, setHistory] = useState<CodeHistory | null>(null);
  const [selected, setSelected] = useState<CodeRevision | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState(''), [conflict, setConflict] = useState(false);
  const [switchPending, setSwitchPending] = useState<boolean | null>(null);
  const [destination, setDestination] = useState<null | (() => void)>(null), dirtyRef = useRef(false), bypass = useRef(false), saving = useRef(false);
  const [actors, setActors] = useState<Record<string, string>>({}), requestedActors = useRef(new Set<string>());
  useEffect(() => {
    for (const id of new Set(history?.items.map(item => item.createdById) ?? [])) {
      if (requestedActors.current.has(id)) continue;
      requestedActors.current.add(id);
      void staffApi.getByUserId(id).then(response => { const actor = unwrapApiResponse(response); setActors(current => ({ ...current, [id]: actor.username })); }).catch(() => {});
    }
  }, [history]);
  const dirty = !!config && !!draft && JSON.stringify(draft) !== JSON.stringify(draftOf(config)); dirtyRef.current = dirty;
  const invalid = draft ? invalidCodeFields(draft) : [];
  const accept = useCallback((next: CodeConfiguration) => { setConfig(next); setDraft(draftOf(next)); setConflict(false); setError(''); setSelected(null); dirtyRef.current = false; }, []);
  const load = useCallback(async () => { const [next, revisions] = await Promise.all([storefrontCodeApi.current(), storefrontCodeApi.history(1)]); accept(next); setHistory(revisions); }, [accept]);
  const showError = useCallback((cause: unknown) => { if (cause instanceof AdminApiError && cause.code === 'STOREFRONT_CODE_CONFIG_CONFLICT') setConflict(true); else setError(t('merchant.storefrontCode.failed')); }, [t]);
  useEffect(() => { void load().catch(showError); }, [load, showError]);
  useEffect(() => {
    const unregister = registerNavigationGuard(resume => { if (!dirtyRef.current || bypass.current) return false; setDestination(() => resume); return true; });
    const unload = (event: BeforeUnloadEvent) => { if (dirtyRef.current && !bypass.current) { event.preventDefault(); event.returnValue = ''; } };
    const click = (event: MouseEvent) => {
      if (!dirtyRef.current || bypass.current || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element).closest?.('a[href]') as HTMLAnchorElement | null;
      if (!link || link.hasAttribute('data-app-navigation') || link.target === '_blank' || link.hasAttribute('download')) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname && url.search === window.location.search) return;
      event.preventDefault(); event.stopPropagation(); setDestination(() => () => router.push(url.pathname + url.search + url.hash));
    };
    document.addEventListener('click', click, true); window.addEventListener('beforeunload', unload);
    return () => { unregister(); document.removeEventListener('click', click, true); window.removeEventListener('beforeunload', unload); };
  }, [router]);
  async function action(work: () => Promise<void>) { if (saving.current) return; saving.current = true; setBusy(true); setError(''); setNotice(''); try { await work(); } catch (cause) { showError(cause); } finally { setBusy(false); saving.current = false; } }
  async function save() {
    if (!draft || !config || conflict || invalid.length || saving.current) return false;
    let success = false;
    await action(async () => { const values: CodeFields = { ...draft, ga4MeasurementId: draft.ga4MeasurementId || null, metaPixelId: draft.metaPixelId || null, baiduSiteKey: draft.baiduSiteKey || null }; accept(await storefrontCodeApi.save(values, config.revision)); setHistory(await storefrontCodeApi.history(1)); setNotice(text('saved')); success = true; });
    return success;
  }
  const stamp = (value: string) => formatStoreTimestamp(value, timezone);
  return <section className="min-w-0 text-[13px]">
    <header className="sticky top-0 z-30 border-b border-border bg-ground"><div className="mx-auto flex max-w-[760px] flex-wrap items-center justify-between gap-3 px-8 pb-4 pt-5"><div className="space-y-1"><h1 style={{ fontSize: 22, letterSpacing: '-0.02em' }} className="text-[22px] font-semibold tracking-[-0.02em]">{c('title')}</h1><p className="text-muted-foreground">{c('intro')}</p></div><div className="flex flex-wrap items-center gap-2"><span className={`text-xs ${dirty ? 'text-attention' : 'text-faint'}`}>{!config ? '' : dirty ? th('dirty') : config.updatedAt ? <>{th('savedState')} · {text('revision')} #<output aria-label={text('currentRevision')}>{config.revision}</output> · {stamp(config.updatedAt)}</> : th('savedState')}</span>{dirty && <Button size="sm" variant="outline" disabled={busy} onClick={() => config && accept(config)}>{th('discard')}</Button>}<Button className={!dirty ? 'bg-raised text-faint disabled:opacity-100' : undefined} type="submit" form="storefront-editor" size="sm" disabled={busy || !dirty || conflict || !!invalid.length}>{th('save')}</Button></div></div></header>
    <div className="mx-auto max-w-[760px] space-y-5 px-8 pb-16 pt-6">{error && <p role="alert" className="text-destructive">{error}</p>}{notice && <p role="status">{notice}</p>}{conflict && <div role="alert" className="flex flex-wrap items-center gap-2.5 rounded-lg border border-attention-line bg-attention-soft px-3.5 py-3 text-attention"><p className="flex-1 basis-[280px] leading-[1.6]">{c('conflict')}</p><Button size="sm" variant="outline" disabled={busy} onClick={() => void action(load)}>{c('loadLatest')}</Button></div>}
      {!config || !draft ? error ? null : <p role="status">{text('loading')}</p> : <>
        <section aria-label={text('enabled')} className="flex flex-wrap items-center gap-3 rounded-lg border border-border px-4 py-3.5"><div className="flex-1 basis-[280px] space-y-1"><h2 className="font-medium">{c((switchPending ?? config.enabled) ? 'on' : 'off')}</h2><p className="leading-[1.6] text-muted-foreground">{c((switchPending ?? config.enabled) ? 'switchOn' : 'switchOff')}</p></div><label className="flex items-center gap-2"><Switch className="h-[18px] w-[34px] [&>span]:size-3.5 [&>span]:data-[state=checked]:translate-x-4" aria-label={text('enabled')} checked={switchPending ?? config.enabled} disabled={busy} onCheckedChange={enabled => { if (saving.current) return; setSwitchPending(enabled); void action(async () => { try { const next = await storefrontCodeApi.switch(enabled); if (JSON.stringify(draftOf(next)) !== JSON.stringify(draftOf(config))) setConflict(true); setConfig(next); setHistory(await storefrontCodeApi.history(1)); } finally { setSwitchPending(null); } }); }} />{c((switchPending ?? config.enabled) ? 'onLabel' : 'offLabel')}</label></section><p className="px-0.5 text-xs leading-[1.7] text-muted-foreground">{c('paymentNote').split(c('paymentNever'))[0]}<span className="text-foreground">{c('paymentNever')}</span>{c('paymentNote').split(c('paymentNever'))[1]}</p>
        <form id="storefront-editor" className="space-y-5" onSubmit={event => { event.preventDefault(); void save(); }}><fieldset disabled={busy} className="overflow-hidden rounded-lg border border-border"><div className="space-y-0.5 border-b border-border px-4 py-3"><h2 className="font-semibold">{c('providers')}</h2><p className="text-xs text-faint">{c('providerNote')}</p></div><div className="space-y-4 p-4">{providers.map((key, index) => <div key={key} className="max-w-[460px] space-y-1.5"><label htmlFor={key}>{text(key)}</label><Input id={key} value={draft[key]} className="h-[34px] bg-ground font-mono text-xs aria-invalid:border-destructive" aria-invalid={invalid.includes(key)} aria-describedby={`${key}-hint`} onChange={event => setDraft({ ...draft, [key]: event.target.value })} /><p id={`${key}-hint`} role={invalid.includes(key) ? 'alert' : undefined} className={`text-xs leading-[1.6] ${invalid.includes(key) ? 'text-destructive' : 'text-faint'}`}>{invalid.includes(key) ? key === 'metaPixelId' ? c('metaError') : text('invalidId') : c((['ga4Hint', 'metaHint', 'baiduHint'] as const)[index])}</p></div>)}</div></fieldset>
          <fieldset disabled={busy} className="overflow-hidden rounded-lg border border-border"><div className="space-y-0.5 border-b border-border px-4 py-3"><h2 className="font-semibold">{text('freeCode')}</h2><p className="text-xs text-faint">{c('codeNote')}</p></div><div className="space-y-4 p-4">{slots.map((key, index) => <div key={key} className="space-y-1.5"><div className="flex justify-between gap-2"><label htmlFor={key}>{index + 1}. {text(key)}</label><output className="font-mono text-[11px] text-faint">{storefrontCodeCharacterCount(draft[key])} / {storefrontCodeSlotCap}</output></div><textarea id={key} aria-label={text(key)} value={draft[key]} rows={4} spellCheck={false} className="block w-full resize-y rounded-md border border-border bg-raised px-2.5 py-2 font-mono text-xs leading-[1.6] focus-visible:outline-2 focus-visible:outline-offset-2" aria-invalid={invalid.includes(key)} aria-describedby={invalid.includes(key) ? `${key}-error` : undefined} onChange={event => setDraft({ ...draft, [key]: event.target.value })} />{invalid.includes(key) && <p id={`${key}-error`} role="alert" className="text-xs text-destructive">{text('tooLong')}</p>}</div>)}</div></fieldset>
        </form>
      </>}
      {history && <section aria-label={c('history')} className="overflow-hidden rounded-lg border border-border"><div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3"><h2 className="font-semibold">{c('history')}</h2><span className="text-xs text-faint">{c('historyNote').split('{count}')[0]}<output aria-label={text('total')}>{history?.total ?? 0}</output>{c('historyNote').split('{count}')[1].replace('{timezone}', timezone)}</span></div>{history?.items.map(revision => <div key={revision.id} className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-2.5"><span className="w-10 font-mono text-xs">#{revision.revision}</span><span className="min-w-0 flex-1 basis-[200px] break-words text-muted-foreground"><time dateTime={revision.createdAt}>{stamp(revision.createdAt)}</time> · {actors[revision.createdById] ?? revision.createdById}</span>{revision.revision === config?.revision ? <span className="text-xs text-muted-foreground">{text('currentRevision')}</span> : <Button variant="outline" size="sm" className="h-7 px-2.5 text-xs" disabled={busy} aria-label={`${c('viewRestore')} #${revision.revision}`} onClick={() => void action(async () => setSelected(await storefrontCodeApi.revision(revision.revision)))}>{c('viewRestore')}</Button>}</div>)}{history?.total === 0 && <p className="p-4 text-muted-foreground">{text('empty')}</p>}<div className="flex justify-end px-4 py-2"><Button variant="outline" size="sm" className="h-7 text-xs" disabled={busy || !history || history.page >= history.totalPages} onClick={() => void action(async () => { const next = await storefrontCodeApi.history(history!.page + 1); setHistory(current => ({ ...next, items: [...current!.items, ...next.items] })); })}>{c('older')}</Button></div><p className="px-4 pb-3 text-xs text-faint">{c('restoreNote')}</p></section>}
    </div>
    <Dialog open={selected !== null} onOpenChange={open => { if (!open && !busy) setSelected(null); }}><DialogContent closeLabel={text('close')} overlayClassName="z-[90]" className="z-[100] max-h-[85dvh] w-[calc(100%-32px)] overflow-y-auto"><DialogHeader><DialogTitle>{text('detail')} #{selected?.revision}</DialogTitle><DialogDescription>{c('restoreNote')}</DialogDescription></DialogHeader>{selected && [...providers, ...slots].map(key => <div key={key} className="min-w-0"><h3 className="font-medium">{text(key)}</h3><pre className="whitespace-pre-wrap break-all rounded-md bg-raised p-2 font-mono text-xs">{selected[key] ?? ''}</pre></div>)}<DialogFooter><Button variant="outline" disabled={busy} onClick={() => setSelected(null)}>{th('cancel')}</Button><Button disabled={busy || conflict || !config || !selected} onClick={() => void action(async () => { accept(await storefrontCodeApi.restore(selected!.revision, config!.revision)); setHistory(await storefrontCodeApi.history(1)); setNotice(text('restored')); })}>{text('restore')}</Button></DialogFooter></DialogContent></Dialog>
    <AlertDialog open={destination !== null} onOpenChange={open => { if (!open && !busy) setDestination(null); }}><AlertDialogContent className="z-[100] w-[calc(100%-32px)]" overlayClassName="z-[90]"><AlertDialogHeader><AlertDialogTitle>{leave('leaveTitle')}</AlertDialogTitle><AlertDialogDescription>{leave('leaveNote')}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter className="gap-2"><Button variant="outline" disabled={busy} onClick={() => setDestination(null)}>{leave('keepEditing')}</Button><Button variant="outline" disabled={busy} onClick={() => { bypass.current = true; dirtyRef.current = false; destination?.(); setDestination(null); }}>{leave('leaveWithout')}</Button><Button disabled={busy || !!invalid.length || conflict} onClick={async () => { if (await save()) { bypass.current = true; destination?.(); setDestination(null); } }}>{leave('saveLeave')}</Button></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </section>;
}
