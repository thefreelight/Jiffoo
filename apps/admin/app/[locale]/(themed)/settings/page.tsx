'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useT } from 'shared/src/i18n/react';
import { formatStoreTimestamp, storeTimezones } from 'shared';
import { settingsApi, uploadApi, unwrapApiResponse, type SystemSettingsMap } from '@/lib/api';
import { useStoreDate } from '@/lib/store-time';
import { registerNavigationGuard } from '@/lib/pending-navigation';
import { Choice } from '@/components/operations/Choice';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ApiTokenPanel } from '@/components/settings/ApiTokenPanel';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter } from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';

const countriesKey = 'checkout.address.countries_require_state_postal';
const policiesKey = 'fulfillment.policies';
const catalogKey = 'fulfillment.policy_catalog';
const defaults = ['US', 'CA', 'AU', 'CN', 'GB'];
const keys = ['orders.number_prefix', 'branding.platform_name', 'branding.store_description', 'branding.logo', 'contact.email', 'contact.phone', 'contact.address', 'localization.locale', 'localization.currency', 'localization.timezone', policiesKey];
const currencies = ['USD', 'EUR', 'GBP', 'CNY', 'HKD', 'TWD'];
const zones = storeTimezones();
const text = (value: unknown) => typeof value === 'string' ? value : '';
/** One entry of the catalogue of the fulfilment policies the API publishes. */
type FulfillmentPolicyEntry = { name: string; productType: string; policy?: { requiresShippingAddress?: boolean; requiresShippingQuote?: boolean; tracksInventory?: boolean } };
/** The selection of the fulfilment policies: the policy of a product type. */
const selectionOf = (value: unknown): Record<string, string> => value && typeof value === 'object' && !Array.isArray(value) ? Object.fromEntries(Object.entries(value as Record<string, unknown>).filter(([, policy]) => typeof policy === 'string')) as Record<string, string> : {};
const catalogOf = (value: unknown): FulfillmentPolicyEntry[] => Array.isArray(value) ? value.filter((entry): entry is FulfillmentPolicyEntry => !!entry && typeof entry === 'object' && typeof (entry as FulfillmentPolicyEntry).name === 'string' && typeof (entry as FulfillmentPolicyEntry).productType === 'string') : [];
const draftOf = (map: SystemSettingsMap) => ({ ...Object.fromEntries(keys.map(key => [key, key === policiesKey ? selectionOf(map[key]) : text(map[key]) || (key === 'orders.number_prefix' ? 'JF' : key === 'localization.locale' ? 'en' : key === 'localization.currency' ? 'USD' : key === 'localization.timezone' ? 'UTC' : '')])), [countriesKey]: Array.isArray(map[countriesKey]) ? map[countriesKey] : defaults });
type Draft = Record<string, unknown>;

export default function SettingsPage() {
  const t = useT(), locale = useLocale(), router = useRouter(), { timezone, setTimezone } = useStoreDate();
  const c = (key: string, values?: Record<string, string | number>) => t(`merchant.settingsView.${key}`, values);
  const leave = (key: string) => t(`merchant.profileView.${key}`);
  const [initial, setInitial] = useState<Draft | null>(null), [draft, setDraft] = useState<Draft | null>(null), [error, setError] = useState('');
  const [catalogue, setCatalogue] = useState<FulfillmentPolicyEntry[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({}), [busy, setBusy] = useState(false), [uploading, setUploading] = useState(false), [savedAt, setSavedAt] = useState<string | null>(null);
  const [destination, setDestination] = useState<null | (() => void)>(null), [countryOpen, setCountryOpen] = useState(false), [countrySearch, setCountrySearch] = useState('');
  const dirty = !!initial && JSON.stringify(initial) !== JSON.stringify(draft), dirtyRef = useRef(false), bypass = useRef(false), saving = useRef(false), form = useRef<HTMLFormElement>(null);
  dirtyRef.current = dirty;
  const accept = useCallback((map: SystemSettingsMap) => { const next = draftOf(map); setInitial(next); setDraft(next); setError(''); setFieldErrors({}); dirtyRef.current = false; const entries = catalogOf(map[catalogKey]); if (entries.length) setCatalogue(entries); }, []);
  const load = useCallback(async () => { try { accept(unwrapApiResponse(await settingsApi.getAll())); } catch { setError('failed'); } }, [accept]);
  useEffect(() => { void load(); }, [load]);
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
  const change = (key: string, value: unknown) => setDraft(current => current ? { ...current, [key]: value } as Draft : current);
  const policySelection = (draft?.[policiesKey] ?? {}) as Record<string, string>;
  const togglePolicy = (productType: string, policy: string, enabled: boolean) => change(policiesKey, enabled ? { ...policySelection, [productType]: policy } : Object.fromEntries(Object.entries(policySelection).filter(([type]) => type !== productType)));
  const policyFlags = (entry: FulfillmentPolicyEntry) => { const policy = entry.policy ?? {}; return [policy.requiresShippingAddress ? c('fulfillmentNeedsAddress') : '', policy.requiresShippingQuote ? c('fulfillmentNeedsQuote') : '', policy.tracksInventory ? c('fulfillmentTracksStock') : ''].filter(Boolean).join(' · '); };
  const focusError = (key: string) => { const field = document.getElementById(key); field?.focus(); field?.scrollIntoView?.({ block: 'center' }); };
  const invalidField = useRef<string | null>(null);
  useEffect(() => { if (!busy && invalidField.current) { focusError(invalidField.current); invalidField.current = null; } }, [busy, error]);
  async function save() {
    if (!draft || !initial || saving.current || uploading) return false;
    const errors: Record<string, string> = {};
    if (!/^[A-Z]{2,6}$(?![\s\S])/.test(text(draft['orders.number_prefix']))) errors['orders.number_prefix'] = 'invalidOrderNumberPrefix';
    if (!text(draft['branding.platform_name']).trim()) errors['branding.platform_name'] = 'required';
    const email = text(draft['contact.email']).trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors['contact.email'] = 'invalidEmail';
    if (!currencies.includes(text(draft['localization.currency']))) errors['localization.currency'] = 'invalidCurrency';
    setFieldErrors(errors);
    if (Object.keys(errors).length) { setError('saveFailed'); focusError(Object.keys(errors)[0]); return false; }
    saving.current = true; setBusy(true); setError('');
    const updates = Object.fromEntries(Object.entries(draft).filter(([key, value]) => JSON.stringify(value) !== JSON.stringify(initial[key as keyof Draft])).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value]));
    try { const next = unwrapApiResponse(await settingsApi.batchUpdate(updates)); accept(next); setTimezone(text(next['localization.timezone'])); setSavedAt(new Date().toISOString()); return true; }
    catch { invalidField.current = Object.keys(updates)[0] ?? 'branding.platform_name'; setError('saveFailed'); return false; }
    finally { saving.current = false; setBusy(false); }
  }
  const regionNames = useMemo(() => new Intl.DisplayNames([locale], { type: 'region' }), [locale]);
  const selectedCountries = (draft?.[countriesKey] ?? []) as string[];
  const allCountries = useMemo(() => Array.from({ length: 26 * 26 }, (_, index) => String.fromCharCode(65 + Math.floor(index / 26), 65 + index % 26)).filter(code => { try { return regionNames.of(code) !== code && !['EU', 'UN', 'QO', 'EZ', 'XA', 'XB', 'ZZ'].includes(code); } catch { return false; } }), [regionNames]);
  const localizationOptions = useMemo(() => {
    const languageNames = new Intl.DisplayNames([locale], { type: 'language' });
    const currencyNames = new Intl.DisplayNames([locale], { type: 'currency' });
    return {
      locale: ['en', 'zh-Hans', 'zh-Hant'].map(value => ({ value, label: languageNames.of(value) ?? value })),
      currency: currencies.map(value => ({ value, label: t('merchant.settingsView.currencyFormat', { name: currencyNames.of(value) ?? value, code: value, symbol: new Intl.NumberFormat(locale, { style: 'currency', currency: value, currencyDisplay: 'narrowSymbol' }).formatToParts(0).find(part => part.type === 'currency')?.value ?? value }) })),
      timezone: zones.map(value => ({ value, label: value })),
    };
  }, [locale, t]);
  const panel = (id: string, children: ReactNode, hint?: string) => <section id={id} aria-labelledby={`heading-${id}`} className="scroll-mt-40 overflow-hidden rounded-[10px] border border-border"><div className="space-y-0.5 border-b border-border px-4 py-3"><h2 id={`heading-${id}`} className="font-semibold">{c(id)}</h2>{hint && <p className="text-xs leading-relaxed text-faint">{c(hint)}</p>}</div><div className="space-y-4 p-4">{children}</div></section>;
  const field = (key: string, label: string, hint?: string, multiline = false, type = 'text') => <div className={["branding.platform_name", "orders.number_prefix"].includes(key) ? "max-w-[460px] space-y-1.5" : "space-y-1.5"}><label htmlFor={key}>{c(label)}</label>{multiline ? <Textarea id={key} rows={2} className="min-h-0 bg-ground" value={text(draft?.[key as keyof Draft])} aria-invalid={!!fieldErrors[key]} aria-describedby={hint ? `${key}-hint` : undefined} onChange={event => change(key, event.target.value)} /> : <Input id={key} type={type} className="h-[34px] bg-ground" value={text(draft?.[key as keyof Draft])} aria-invalid={!!fieldErrors[key]} aria-describedby={fieldErrors[key] ? `${key}-error` : hint ? `${key}-hint` : undefined} onChange={event => change(key, event.target.value)} />}{hint && <p id={`${key}-hint`} className="text-xs leading-relaxed text-faint">{c(hint)}</p>}{fieldErrors[key] && <p id={`${key}-error`} className="text-xs text-destructive">{c(fieldErrors[key])}</p>}</div>;
  return <section className="min-w-0 text-[13px] text-foreground">
    <header className="sticky top-0 z-30 border-b border-border bg-ground"><div className="mx-auto flex max-w-[760px] flex-wrap items-center justify-between gap-3 px-4 pb-4 pt-16 group-has-[[data-settings-banner]]/admin-content:pt-5 min-[769px]:pt-5 sm:px-8"><div className="space-y-1"><h1 style={{ fontSize: 22, letterSpacing: "-0.02em" }} className="text-[22px] font-semibold tracking-tight">{c('title')}</h1><p className="text-muted-foreground">{c('description')}</p></div><div className="flex flex-wrap items-center gap-2"><span className={`text-xs ${dirty ? 'text-attention' : 'text-faint'}`}>{draft && (dirty ? c('dirty') : c('saved') + (savedAt ? ` · ${formatStoreTimestamp(savedAt, timezone)}` : ''))}</span>{dirty && <Button size="sm" variant="outline" disabled={busy || uploading} onClick={() => { setDraft(initial); setError(''); setFieldErrors({}); }}>{c('discard')}</Button>}<Button className={!dirty ? "bg-raised text-faint disabled:opacity-100" : undefined} size="sm" form="settings-editor" type="submit" disabled={!dirty || busy || uploading}>{c(busy ? 'saving' : 'save')}</Button></div></div><nav aria-label={c('sections')} className="mx-auto flex max-w-[760px] flex-wrap gap-x-[18px] px-4 text-muted-foreground sm:px-8">{['store', 'contact', 'region', 'checkout', 'fulfillment', 'tokens'].map(id => <a key={id} href={`#${id}`} className="inline-flex min-h-[34px] items-center">{c(id)}</a>)}</nav></header>
    <div className="mx-auto max-w-[760px] space-y-5 px-4 pb-16 pt-6 sm:px-8">
      {error && <div role="alert" className="space-y-2 text-destructive"><p>{c(error)}</p>{!draft && <Button variant="outline" onClick={() => void load()}>{c('retry')}</Button>}</div>}
      {!draft && !error && <p role="status">{c('loading')}</p>}
      {draft && <><p className="text-xs text-faint">{c('timeZone', { timezone })}</p><form id="settings-editor" ref={form} noValidate onSubmit={event => { event.preventDefault(); void save(); }}><fieldset className="min-w-0 space-y-5" disabled={busy || uploading}>
        {panel('store', <>{field('branding.platform_name', 'name', 'nameHint')}{field('orders.number_prefix', 'orderNumberPrefix', 'orderNumberPrefixHint')}{field('branding.store_description', 'summary', 'summaryHint', true)}<div className="space-y-1.5"><span>{c('logo')}</span><div className="flex flex-wrap items-center gap-2.5">{text(draft['branding.logo']) ? <img src={text(draft['branding.logo'])} alt={c('logo')} className="h-10 w-24 rounded-[7px] border border-border bg-raised object-contain" /> : <span title={text(draft['branding.platform_name'])} className="block h-10 w-24 truncate rounded-[7px] border border-border bg-raised px-2 leading-10 font-semibold text-muted-foreground">{text(draft['branding.platform_name'])}</span>}<label className="relative inline-flex h-[30px] cursor-pointer items-center rounded-[7px] border border-border px-3">{c('changeImage')}<input aria-label={c('changeImage')} type="file" accept="image/jpeg,image/png,image/webp" className="absolute inset-0 w-full cursor-pointer opacity-0" onChange={async event => { const file = event.target.files?.[0]; event.target.value = ''; if (!file) return; setUploading(true); setError(''); try { change('branding.logo', unwrapApiResponse(await uploadApi.uploadProductImage(file)).url); } catch { setError('imageFailed'); } finally { setUploading(false); } }} /></label><Button size="sm" variant="ghost" disabled={!text(draft['branding.logo'])} onClick={() => change('branding.logo', '')}>{c('remove')}</Button></div><p className="text-xs text-faint">{c('logoHint')}</p></div></>)}
        {panel('contact', <><div className="grid gap-4 sm:grid-cols-2">{field('contact.email', 'email', undefined, false, 'email')}{field('contact.phone', 'phone', undefined, false, 'tel')}</div>{field('contact.address', 'address')}</>, 'contactHint')}
        {panel('region', <>{(['locale', 'currency', 'timezone'] as const).map((key, index) => { const setting = `localization.${key}`, label = ['language', 'currency', 'timezone'][index]; return <div key={key} className="max-w-[460px] space-y-1.5"><label htmlFor={setting}>{c(label)}</label><Choice id={setting} label={c(label)} className={`w-full bg-ground ${key === 'currency' && draft[setting] !== initial?.[setting] ? 'border-attention-line' : 'border-border'}`} value={text(draft[setting])} onChange={value => change(setting, value)} options={localizationOptions[key]} /><p className={`text-xs leading-relaxed ${key === 'currency' && draft[setting] !== initial?.[setting] ? 'text-attention' : 'text-faint'}`}>{c(key === 'currency' && draft[setting] !== initial?.[setting] ? 'currencyWarning' : `${label}Hint`)}</p></div>; })}</>)}
        {panel('checkout', <><div className="flex flex-wrap gap-1.5">{selectedCountries.map(code => <span key={code} className="inline-flex h-7 items-center gap-1 rounded-full border border-border bg-raised pl-2.5 pr-1">{regionNames.of(code)}<span className="font-mono text-[11px] text-faint">{code}</span><button type="button" aria-label={c('removeCountry', { country: regionNames.of(code) ?? code })} className="size-5 rounded-full text-muted-foreground" onClick={() => change(countriesKey, selectedCountries.filter(value => value !== code))}>×</button></span>)}<Button variant="outline" size="sm" className="h-7 rounded-full border-dashed" onClick={() => setCountryOpen(true)}>{c('addCountry')}</Button></div>{!selectedCountries.length && <p className="text-xs text-faint">{c('noCountries')}</p>}</>, 'checkoutHint')}
        {panel('fulfillment', <>{catalogue.length ? catalogue.map(entry => <div key={entry.productType} className="flex items-start justify-between gap-3 border-b border-border pb-3 last:border-b-0 last:pb-0"><div className="space-y-0.5"><span className="font-medium">{entry.productType}</span><p className="text-xs leading-relaxed text-faint">{c('fulfillmentPolicyName', { policy: entry.name })}{policyFlags(entry) ? ` · ${policyFlags(entry)}` : ''}</p></div><Switch id={`fulfillment-${entry.productType}`} aria-label={c('fulfillmentPolicyFor', { productType: entry.productType })} checked={policySelection[entry.productType] === entry.name} onCheckedChange={value => togglePolicy(entry.productType, entry.name, value)} /></div>) : <p className="text-xs text-faint">{c('fulfillmentEmpty')}</p>}</>, 'fulfillmentHint')}
      </fieldset></form><ApiTokenPanel /></>}
    </div>
    <AlertDialog open={countryOpen} onOpenChange={setCountryOpen}><AlertDialogContent className="w-[calc(100%-32px)]"><AlertDialogHeader><AlertDialogTitle>{c('country')}</AlertDialogTitle><AlertDialogDescription>{c('checkoutHint')}</AlertDialogDescription></AlertDialogHeader><Input aria-label={c('country')} value={countrySearch} onChange={event => setCountrySearch(event.target.value)} /><div className="max-h-64 overflow-y-auto">{allCountries.filter(code => !selectedCountries.includes(code) && `${code} ${regionNames.of(code)}`.toLowerCase().includes(countrySearch.toLowerCase())).map(code => <Button variant="ghost" key={code} className="block w-full text-left" onClick={() => { change(countriesKey, [...selectedCountries, code]); setCountryOpen(false); setCountrySearch(''); }}>{regionNames.of(code)} {code}</Button>)}</div><Button variant="outline" onClick={() => setCountryOpen(false)}>{c('cancel')}</Button></AlertDialogContent></AlertDialog>
    <AlertDialog open={destination !== null} onOpenChange={open => { if (!open && !busy) setDestination(null); }}><AlertDialogContent className="z-[100] w-[calc(100%-32px)]" overlayClassName="z-[90]"><AlertDialogHeader><AlertDialogTitle>{leave('leaveTitle')}</AlertDialogTitle><AlertDialogDescription>{leave('leaveNote')}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter className="gap-2"><Button variant="outline" disabled={busy} onClick={() => setDestination(null)}>{leave('keepEditing')}</Button><Button variant="outline" disabled={busy} onClick={() => { bypass.current = true; dirtyRef.current = false; destination?.(); setDestination(null); }}>{leave('leaveWithout')}</Button><Button disabled={busy} onClick={async () => { if (await save()) { bypass.current = true; destination?.(); setDestination(null); } }}>{leave('saveLeave')}</Button></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </section>;
}
