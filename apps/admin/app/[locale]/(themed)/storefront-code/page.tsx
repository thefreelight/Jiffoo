'use client';

import { useCallback, useEffect, useState } from 'react';
import { useT } from 'shared/src/i18n/react';
import { storefrontCodeProviderPatterns, storefrontCodeSlotCap, storefrontCodeCharacterCount, isStorefrontCodeProviderId } from 'shared';
import { ChevronLeft, ChevronRight, RefreshCw, Save, X } from 'lucide-react';
import { AdminApiError } from '@/lib/api';
import { storefrontCodeApi, type CodeConfiguration, type CodeFields, type CodeHistory, type CodeRevision } from '@/lib/storefront-code';

const providers = Object.keys(storefrontCodeProviderPatterns) as Array<keyof typeof storefrontCodeProviderPatterns>;
const slots = ['headCode', 'bodyStartCode', 'bodyEndCode'] as const;
type Draft = Record<keyof CodeFields, string>;
const draftOf = (values: CodeFields): Draft => ({
  ga4MeasurementId: values.ga4MeasurementId ?? '', metaPixelId: values.metaPixelId ?? '',
  baiduSiteKey: values.baiduSiteKey ?? '', headCode: values.headCode,
  bodyStartCode: values.bodyStartCode, bodyEndCode: values.bodyEndCode,
});

export default function StorefrontCodePage() {
  const t = useT();
  const text = useCallback((key: string) => t(`merchant.storefrontCode.${key}`), [t]);
  const [config, setConfig] = useState<CodeConfiguration | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [history, setHistory] = useState<CodeHistory | null>(null);
  const [selected, setSelected] = useState<CodeRevision | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [switchPending, setSwitchPending] = useState<boolean | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [conflict, setConflict] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<Draft>>({});
  const load = useCallback(async () => {
    const [current, revisions] = await Promise.all([storefrontCodeApi.current(), storefrontCodeApi.history(1)]);
    setConfig(current); setDraft(draftOf(current)); setHistory(revisions);
    setFieldErrors({}); setConflict(false); setError(''); setSelected(null); setConfirm(false);
  }, []);
  const showError = useCallback((cause: unknown) => {
    if (cause instanceof AdminApiError && cause.code === 'STOREFRONT_CODE_CONFIG_CONFLICT') {
      setConflict(true); setError(text('conflict'));
    } else {
      setError(text('failed'));
      if (cause instanceof AdminApiError && cause.code === 'VALIDATION_ERROR') {
        const issues = (cause.details as { issues?: Array<{ path: string; message: string }> } | undefined)?.issues;
        setFieldErrors(Object.fromEntries((issues ?? []).map((issue) => [issue.path, issue.message])));
      }
    }
  }, [text]);
  useEffect(() => { void load().catch(showError); }, [load, showError]);
  const action = async (work: () => Promise<void>) => {
    setBusy(true); setError(conflict ? text('conflict') : ''); setNotice('');
    try { await work(); } catch (cause) { showError(cause); } finally { setBusy(false); }
  };
  const saved = async (current: CodeConfiguration, message: string) => {
    setConfig(current); setDraft(draftOf(current)); setConflict(false); setFieldErrors({});
    setNotice(message); setSelected(null); setConfirm(false);
    setHistory(await storefrontCodeApi.history(1));
  };
  const save = async () => {
    if (!draft || !config || conflict) return;
    const errors: Partial<Draft> = {};
    for (const key of providers) {
      if (draft[key] && !isStorefrontCodeProviderId(key, draft[key]))
        errors[key] = text('invalidId');
    }
    for (const key of slots) {
      if (storefrontCodeCharacterCount(draft[key]) > storefrontCodeSlotCap) errors[key] = text('tooLong');
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;
    const values: CodeFields = { ...draft,
      ga4MeasurementId: draft.ga4MeasurementId || null, metaPixelId: draft.metaPixelId || null,
      baiduSiteKey: draft.baiduSiteKey || null,
    };
    await action(async () => saved(await storefrontCodeApi.save(values, config.revision), text('saved')));
  };
  const restore = async () => {
    if (!selected || !config || conflict) return;
    await action(async () => saved(await storefrontCodeApi.restore(selected.revision, config.revision), text('restored')));
  };
  const button = 'inline-flex items-center justify-center gap-2 rounded border bg-surface px-3 py-2 text-sm disabled:opacity-50';
  return <main className="min-h-screen bg-neutral-veil px-4 pb-6 pt-20 text-neutral-deepest sm:px-8 lg:pt-6">
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
        <h1 className="text-xl font-semibold">{text('title')}</h1>
        <button className={button} disabled={busy} onClick={() => void action(load)}>
          <RefreshCw size={16} />{text('reload')}</button>
      </header>
      {error && <div role="alert" className="border-l-4 border-danger-strong bg-danger-veil p-3 text-sm">
        <p>{error}</p>{conflict && <button className={`${button} mt-2`} disabled={busy}
          onClick={() => void action(load)}>{text('reload')}</button>}
      </div>}
      {notice && <p role="status" className="border-l-4 border-success-strong bg-success-veil p-3 text-sm">{notice}</p>}
      {!config || !draft ? <p>{text('loading')}</p> : <>
        <section className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
          <label className="flex items-center gap-3 font-medium"><input type="checkbox" role="switch"
            checked={switchPending ?? config.enabled} disabled={busy} onChange={(event) => {
              const enabled = event.target.checked;
              setSwitchPending(enabled);
              void action(async () => {
                try {
                  setConfig(await storefrontCodeApi.switch(enabled));
                  setHistory(await storefrontCodeApi.history(1));
                } finally { setSwitchPending(null); }
              });
            }} />{text('enabled')}</label>
          <p className="text-sm text-neutral-strong">{text('currentRevision')}: <output aria-label={text('currentRevision')}>{config.revision}</output></p>
        </section>
        <form onSubmit={(event) => { event.preventDefault(); void save(); }} className="space-y-6">
          <fieldset disabled={busy} className="space-y-5">
            <legend className="mb-4 text-lg font-semibold">{text('providers')}</legend>
            <div className="grid gap-5 md:grid-cols-3">{providers.map((key, index) => <div key={key}>
              <label htmlFor={key} className="text-sm font-medium">{text(key)}</label>
              <input id={key} value={draft[key]} className="mt-1 block w-full rounded border bg-surface p-2 font-mono text-sm"
                aria-invalid={!!fieldErrors[key]} aria-describedby={`${key}-hint${key === 'baiduSiteKey' ? ' baidu-spa-hint baidu-commerce-hint' : ''}${fieldErrors[key] ? ` ${key}-error` : ''}`}
                onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} />
              <p id={`${key}-hint`} className="mt-1 text-xs text-neutral-strong">{text(['ga4Hint', 'metaHint', 'baiduHint'][index])}</p>
              {key === 'baiduSiteKey' && <>
                <p id="baidu-spa-hint" className="mt-1 text-xs text-neutral-strong">{text('baiduSpaHint')}</p>
                <p id="baidu-commerce-hint" className="mt-1 text-xs text-neutral-strong">{text('baiduCommerceHint')}</p>
              </>}
              {fieldErrors[key] && <p id={`${key}-error`} role="alert" className="mt-1 text-sm text-danger-dark">{fieldErrors[key]}</p>}
            </div>)}</div>
          </fieldset>
          <fieldset disabled={busy} className="space-y-4 border-t pt-5">
            <legend className="text-lg font-semibold">{text('freeCode')}</legend>
            <p className="border-l-4 border-neutral-soft pl-3 text-sm text-neutral-strong">{text('notice')}</p>
            {slots.map((key) => <div key={key}>
              <div className="flex items-center justify-between gap-3">
                <label htmlFor={key} className="text-sm font-medium">{text(key)}</label>
                <output className="text-xs text-neutral-strong" aria-label={`${text(key)} ${storefrontCodeSlotCap}`}>
                  {storefrontCodeCharacterCount(draft[key])} / {storefrontCodeSlotCap}</output>
              </div>
              <textarea id={key} value={draft[key]} rows={5} spellCheck={false}
                className="mt-1 block w-full resize-y rounded border bg-surface p-3 font-mono text-sm"
                aria-invalid={!!fieldErrors[key]} aria-describedby={fieldErrors[key] ? `${key}-error` : undefined}
                onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} />
              {fieldErrors[key] && <p id={`${key}-error`} role="alert" className="text-sm text-danger-dark">{fieldErrors[key]}</p>}
            </div>)}
          </fieldset>
          <button type="submit" disabled={busy || conflict} className={`${button} bg-action-strong text-surface`}><Save size={16} />{text('save')}</button>
        </form>
      </>}
      <section aria-label={text('history')} className="space-y-3 border-t pt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{text('history')}</h2>
          <p className="text-sm">{text('total')}: <output aria-label={text('total')}>{history?.total ?? 0}</output></p>
        </div>
        <div className="overflow-x-auto"><table className="w-full text-left text-sm">
          <thead><tr className="border-b">{['revision', 'time', 'actor'].map((key) => <th key={key} className="p-2">{text(key)}</th>)}</tr></thead>
          <tbody>{history?.items.map((revision) => <tr key={revision.id} className="border-b">
            <td className="p-2"><button disabled={busy} className="whitespace-nowrap text-action-strong underline"
              onClick={() => void action(async () => { setSelected(await storefrontCodeApi.revision(revision.revision)); setConfirm(false); })}>
              {text('revision')} {revision.revision}</button></td>
            <td className="whitespace-nowrap p-2"><time dateTime={revision.createdAt}>{revision.createdAt}</time></td>
            <td className="p-2 font-mono">{revision.createdById}</td>
          </tr>)}</tbody>
        </table></div>
        {history?.total === 0 && <p>{text('empty')}</p>}
        <div className="flex items-center justify-end gap-3">
          <button className={button} aria-label={text('previous')} title={text('previous')} disabled={busy || !history || history.page <= 1}
            onClick={() => void action(async () => setHistory(await storefrontCodeApi.history(history!.page - 1)))}><ChevronLeft size={16} /></button>
          <span className="text-sm">{text('page')} {history?.page ?? 1} / {Math.max(1, history?.totalPages ?? 1)}</span>
          <button className={button} aria-label={text('next')} title={text('next')} disabled={busy || !history || history.page >= history.totalPages}
            onClick={() => void action(async () => setHistory(await storefrontCodeApi.history(history!.page + 1)))}><ChevronRight size={16} /></button>
        </div>
      </section>
      {selected && <section aria-label={text('detail')} className="space-y-4 border-t pt-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{text('detail')}: {selected.revision}</h2>
          <button className={button} aria-label={text('close')} title={text('close')} onClick={() => { setSelected(null); setConfirm(false); }}><X size={16} /></button>
        </div>
        {[...providers, ...slots].map((key) => <div key={key}><h3 className="text-sm font-medium">{text(key)}</h3>
          <pre className="mt-1 whitespace-pre-wrap break-all border-l-2 pl-3 font-mono text-sm">{selected[key] ?? ''}</pre></div>)}
        <button className={button} disabled={busy || conflict || !config} onClick={() => setConfirm(true)}>{text('restore')}</button>
        {confirm && <div role="alertdialog" aria-label={text('confirmRestore')} className="space-y-3 border-l-4 border-action-strong p-4">
          <p>{text('restoreNotice')}</p><div className="flex gap-3">
            <button className={button} disabled={busy || conflict} onClick={() => void restore()}>{text('confirmRestore')}</button>
            <button className={button} disabled={busy} onClick={() => setConfirm(false)}>{text('cancel')}</button>
          </div>
        </div>}
      </section>}
    </div>
  </main>;
}
