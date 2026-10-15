'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale, useT } from 'shared/src/i18n/react';
import { formatStoreTimestamp } from 'shared';
import { ArrowUpRight, MoreHorizontal } from 'lucide-react';
import { useThemeAssets } from '@/lib/theme-assets';
import { useStoreDate } from '@/lib/store-time';
import { AdminApiError } from '@/lib/api';
import { themesApi, type HomeSection, type Locale, type ThemeConfig, type ThemeRecord, type ThemeTarget } from '@/lib/themes';
import { themeError, themeMessage, type ThemeLabel } from 'shared/src/i18n/messages/admin-themes';
import { ThemeSettingField } from './ThemeSettingsForm';
import { HomeSectionsEditor } from './HomeSectionsEditor';
import { registerNavigationGuard } from '@/lib/pending-navigation';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';

const valuesOf = (config: ThemeConfig) => Object.fromEntries(config.settings.map(setting => [setting.id, config.values[setting.id] ?? setting.default]));
const homeOf = (config: ThemeConfig) => (config.values.$homeSections as HomeSection[] | undefined) ?? config.homeSections ?? [];

export function ThemeEditor({ target, slug }: { target: ThemeTarget; slug: string }) {
  const locale = useLocale() as Locale, t = useT(), router = useRouter(), { timezone } = useStoreDate();
  const { storeUrl } = useThemeAssets();
  const c = (key: ThemeLabel) => themeMessage(locale, key), leave = (key: string) => t('merchant.profileView.' + key);
  const [theme, setTheme] = useState<ThemeRecord | null>(null), [config, setConfig] = useState<ThemeConfig | null>(null);
  const [draft, setDraft] = useState<Record<string, unknown>>({}), [home, setHome] = useState<HomeSection[] | null>([]);
  const [homeTouched, setHomeTouched] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [conflict, setConflict] = useState(false);
  const invalidSetting = useRef<string | null>(null);
  useEffect(() => {
    if (busy || !invalidSetting.current) return;
    const field = document.getElementById(`theme-${invalidSetting.current}`);
    field?.focus();
    field?.scrollIntoView({ block: 'center' });
    invalidSetting.current = null;
  }, [busy, error]);
  const [confirmation, setConfirmation] = useState<'restore' | 'reset' | null>(null), [destination, setDestination] = useState<null | (() => void)>(null);
  const dirty = config !== null && (JSON.stringify(draft) !== JSON.stringify(valuesOf(config)) || home === null || JSON.stringify(home) !== JSON.stringify(homeOf(config)));
  const dirtyRef = useRef(false), bypass = useRef(false), saving = useRef(false); dirtyRef.current = dirty;
  const accept = useCallback((next: ThemeConfig) => { setHomeTouched(false); setConfig(next); setDraft(valuesOf(next)); setHome(homeOf(next)); setConflict(false); setError(''); dirtyRef.current = false; }, []);
  const message = useCallback((cause: unknown) => { if (cause instanceof AdminApiError && cause.code === 'THEME_CONFIG_CONFLICT') setConflict(true); else setError(cause instanceof AdminApiError ? themeError(locale, cause.code, cause.details) : themeMessage(locale, 'failed')); }, [locale]);
  const load = useCallback(async () => { const [list, next] = await Promise.all([themesApi.list(), themesApi.config(slug)]); const found = list.find(item => item.slug === slug && item.target === target); if (!found) throw new Error('Theme not found'); setTheme(found); accept(next); }, [slug, target, accept]);
  useEffect(() => { void load().catch(message); }, [load, message]);
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
  async function save() {
    if (!config || saving.current || conflict) return false;
    saving.current = true; setBusy(true); setError('');
    try { accept(await themesApi.save(slug, draft, config.revision, target === 'shop' && homeTouched ? home : undefined)); if (target === 'admin') router.refresh(); return true; }
    catch (cause) {
      message(cause);
      if (cause instanceof AdminApiError && cause.code === 'THEME_CONFIG_INVALID') {
        const path = (cause.details as { path?: string } | undefined)?.path;
        const settingId = path?.match(/^\/values\/([^/]+)/)?.[1];
        invalidSetting.current = settingId ?? null;
      }
      return false;
    } finally { saving.current = false; setBusy(false); }
  }
  const title = theme ? `${c('customize')} ${theme.name}` : error ? c('failed') : c('loading');
  return <section className="min-w-0 text-[13px]">
    <header className="sticky top-0 z-30 border-b border-border bg-ground"><div className="mx-auto max-w-[760px] space-y-2.5 px-8 pb-3.5 pt-4"><Link href={`/${locale}/themes?target=${target}`} className="text-muted-foreground">{c('back')}</Link><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex min-w-0 flex-wrap items-baseline gap-2.5"><h1 style={{ fontSize: 22, letterSpacing: '-0.02em' }} className="break-words text-[22px] font-semibold tracking-[-0.02em]">{title}</h1>{theme && <span className="rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground">{c(target === 'shop' ? 'shopTarget' : 'adminTarget')}{theme.activatedAt ? ` · ${c('active')}` : ''}</span>}</div><div className="flex flex-wrap items-center gap-2"><span className={`text-xs ${dirty ? 'text-attention' : 'text-faint'}`}>{!config ? '' : dirty ? c('dirty') : config.configurationSavedAt ? `${c('savedState')} · ${formatStoreTimestamp(config.configurationSavedAt, timezone)}` : c('savedState')}</span>{target === 'shop' && <Button asChild size="sm" variant="outline" className="gap-1 bg-ground"><a href={storeUrl} target="_blank" rel="noreferrer">{c('viewShop')}<ArrowUpRight aria-hidden="true" size={11} /></a></Button>}<DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="icon" aria-label={c('more')}><MoreHorizontal size={16} /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem disabled={busy || !config || config.revision === 0} onSelect={() => setConfirmation('restore')}>{c('restoreConfig')}</DropdownMenuItem>{target === 'shop' && <DropdownMenuItem disabled={busy || !config} onSelect={() => setConfirmation('reset')}>{c('resetHome')}</DropdownMenuItem>}</DropdownMenuContent></DropdownMenu>{dirty && <Button variant="outline" size="sm" disabled={busy} onClick={() => config && accept(config)}>{c('discard')}</Button>}<Button className={!dirty ? 'bg-raised text-faint disabled:opacity-100' : undefined} size="sm" form="theme-editor" type="submit" disabled={!dirty || busy || conflict}>{c('save')}</Button></div></div>{config?.configurationSavedAt && <p className="text-xs text-faint">{c('timeZone').replace('{timezone}', timezone)}</p>}</div></header>
    <div className="mx-auto max-w-[760px] space-y-5 px-8 pb-16 pt-6">{error && <p role="alert" className="text-destructive">{error}</p>}{conflict && <div role="alert" className="flex flex-wrap items-center gap-2.5 rounded-lg border border-attention-line bg-attention-soft px-3.5 py-3 text-attention"><p className="flex-1 basis-[280px]">{c('conflict')}</p><Button variant="outline" size="sm" disabled={busy} onClick={() => void load().catch(message)}>{c('loadLatest')}</Button></div>}
      {config && theme && <form id="theme-editor" className="space-y-5" onSubmit={event => { event.preventDefault(); void save(); }}><fieldset disabled={busy} className="overflow-hidden rounded-lg border border-border"><div className="space-y-0.5 border-b border-border px-4 py-3"><h2 className="font-semibold">{c('settingsTitle')}</h2><p className="text-xs text-faint">{c('settingsNote')}</p></div><div className="space-y-4 p-4">{config.settings.length ? config.settings.map(setting => <ThemeSettingField key={setting.id} setting={setting} locale={locale} value={draft[setting.id]} imageSrc={setting.type === 'image' ? String(draft[setting.id]).startsWith('assets/') ? `/api/v1/themes/${theme.slug}/${theme.packageHash}/${draft[setting.id]}` : String(draft[setting.id]) : undefined} onChange={value => setDraft(current => ({ ...current, [setting.id]: value }))} />) : <p className="text-muted-foreground">{c('noSettings')}</p>}</div></fieldset>{target === 'shop' && <fieldset disabled={busy}><HomeSectionsEditor locale={locale} sections={home ?? config.homeSections ?? []} onChange={sections => { setHome(sections); setHomeTouched(true); }} /></fieldset>}</form>}
    </div>
    <AlertDialog open={confirmation !== null} onOpenChange={open => { if (!open && !busy) setConfirmation(null); }}><AlertDialogContent className="z-[100] w-[calc(100%-32px)]" overlayClassName="z-[90]"><AlertDialogHeader><AlertDialogTitle>{c(confirmation === 'reset' ? 'resetHome' : 'restoreConfig')}</AlertDialogTitle><AlertDialogDescription>{c(confirmation === 'reset' ? 'resetNote' : 'restoreNote')}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><Button variant="outline" disabled={busy} onClick={() => setConfirmation(null)}>{c('cancel')}</Button><Button disabled={busy} onClick={async () => { if (confirmation === 'reset') { setHome(null); setHomeTouched(true); setConfirmation(null); return; } setBusy(true); try { await themesApi.restoreConfig(slug); accept(await themesApi.config(slug)); if (target === 'admin') router.refresh(); setConfirmation(null); } catch (cause) { message(cause); } finally { setBusy(false); } }}>{c('confirmAction')}</Button></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <AlertDialog open={destination !== null} onOpenChange={open => { if (!open && !busy) setDestination(null); }}><AlertDialogContent className="z-[100] w-[calc(100%-32px)]" overlayClassName="z-[90]"><AlertDialogHeader><AlertDialogTitle>{leave('leaveTitle')}</AlertDialogTitle><AlertDialogDescription>{leave('leaveNote')}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter className="gap-2"><Button variant="outline" disabled={busy} onClick={() => setDestination(null)}>{leave('keepEditing')}</Button><Button variant="outline" disabled={busy} onClick={() => { bypass.current = true; dirtyRef.current = false; destination?.(); setDestination(null); }}>{leave('leaveWithout')}</Button><Button disabled={busy} onClick={async () => { if (await save()) { bypass.current = true; destination?.(); setDestination(null); } }}>{leave('saveLeave')}</Button></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </section>;
}
