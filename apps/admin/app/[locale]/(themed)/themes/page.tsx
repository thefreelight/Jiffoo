'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowUpRight, MoreHorizontal, Upload } from 'lucide-react';
import { useLocale } from 'shared/src/i18n/react';
import { formatStoreTimestamp } from 'shared';
import { useThemeAssets } from '@/lib/theme-assets';
import { useStoreDate } from '@/lib/store-time';
import { AdminApiError } from '@/lib/api';
import { themeError, themeMessage, type ThemeLabel } from 'shared/src/i18n/messages/admin-themes';
import { themesApi, type Locale, type ThemeRecord, type ThemeTarget } from '@/lib/themes';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';

export default function ThemesPage() {
  const router = useRouter(), params = useSearchParams(), locale = useLocale() as Locale, { timezone } = useStoreDate();
  const { storeUrl } = useThemeAssets();
  const target: ThemeTarget = params.get('target') === 'admin' ? 'admin' : 'shop';
  const c = (key: ThemeLabel) => themeMessage(locale, key);
  const [themes, setThemes] = useState<ThemeRecord[]>([]), [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [upload, setUpload] = useState(false);
  const [file, setFile] = useState<File | null>(null), [trusted, setTrusted] = useState(false);
  const message = useCallback((cause: unknown) => cause instanceof AdminApiError ? themeError(locale, cause.code, cause.details) : themeMessage(locale, 'failed'), [locale]);
  const reload = useCallback(async () => { try { setThemes(await themesApi.list()); } catch (cause) { setError(message(cause)); } finally { setLoading(false); } }, [message]);
  useEffect(() => { void reload(); }, [reload]);
  const action = async (work: () => Promise<unknown>, refresh = false) => {
    setBusy(true); setError('');
    try { await work(); await reload(); if (refresh) router.refresh(); }
    catch (cause) { setError(message(cause)); } finally { setBusy(false); }
  };
  const selected = themes.filter(theme => theme.target === target), active = selected.find(theme => theme.activatedAt !== null);
  const others = selected.filter(theme => theme.slug !== active?.slug), broken = selected.filter(theme => theme.packageState.status === 'corrupt').length;
  const preview = target === 'shop' ? active?.manifestJson?.tokens?.core : undefined;
  const source = (theme: ThemeRecord) => c(theme.source === 'builtin' ? 'sourceBuiltin' : 'unsigned');
  const menu = (theme: ThemeRecord) => <DropdownMenu><DropdownMenuTrigger asChild><Button variant={theme.slug === active?.slug ? 'outline' : 'ghost'} className={theme.slug === active?.slug ? 'bg-ground' : 'size-[30px] text-muted-foreground'} size="icon" aria-label={`${c('more')}: ${theme.name}`}><MoreHorizontal size={16} /></Button></DropdownMenuTrigger><DropdownMenuContent align="end">
    {theme.slug === active?.slug && <DropdownMenuItem disabled={busy || !others.length} onSelect={() => void action(() => themesApi.restore(target), target === 'admin')}>{c('restore')}{!others.length ? ` · ${c('noPrevious')}` : ''}</DropdownMenuItem>}
    <DropdownMenuItem disabled={busy || theme.source === 'builtin' || theme.slug === active?.slug} onSelect={() => void action(() => themesApi.uninstall(theme.slug))}>{c('uninstall')}{theme.source === 'builtin' ? ` · ${c('builtinReason')}` : theme.slug === active?.slug ? ` · ${c('activeReason')}` : ''}</DropdownMenuItem>
  </DropdownMenuContent></DropdownMenu>;
  return <section className="mx-auto min-w-0 max-w-[1120px] space-y-4 pb-12 text-[13px]">
    <header className="flex flex-wrap items-start justify-between gap-3"><div className="space-y-1.5"><h1 className="text-[26px] font-semibold tracking-[-0.025em]">{c('themes')}</h1><p className="text-muted-foreground">{c(target === 'shop' ? 'shopIntro' : 'adminIntro')}</p></div><Button variant="outline" size="sm" className="gap-1.5 bg-ground" onClick={() => setUpload(true)}><Upload size={14} />{c('upload')}</Button></header>
    <div role="tablist" aria-label={c('themes')} className="flex gap-5 border-b border-border">{(['shop', 'admin'] as const).map(value => <button key={value} role="tab" aria-selected={target === value} className={`-mb-px h-9 border-b-[1.5px] font-medium focus-visible:outline-2 focus-visible:outline-offset-2 ${target === value ? 'border-foreground' : 'border-transparent text-faint'}`} onClick={() => router.push(`/${locale}/themes?target=${value}`)}>{c(value)}</button>)}</div>
    {error && <p role="alert" className="rounded-lg border border-destructive-line bg-destructive-soft p-3 text-destructive">{error}</p>}
    {!!broken && <p role="alert" className="rounded-lg border border-attention-line bg-attention-soft px-3.5 py-3 text-attention">{c('brokenAlert').replace('{count}', String(broken))}</p>}
    {loading ? <p role="status">{c('loading')}</p> : error && !themes.length ? null : <>
      {active ? <article aria-label={c('active')} className="rounded-lg border border-border p-5"><div className="flex flex-wrap gap-5">
        <div aria-hidden="true" style={{ backgroundColor: preview?.ground, borderColor: preview?.border }} className="flex h-[150px] w-[240px] max-w-full shrink-0 flex-col gap-2 rounded-lg border border-border bg-ground p-3"><div className="flex items-center gap-1.5"><span style={{ backgroundColor: preview?.foreground }} className="size-3.5 rounded bg-foreground" /><span style={{ backgroundColor: preview?.border }} className="h-1.5 w-[60px] rounded bg-border" /></div><div style={{ backgroundColor: preview?.active }} className="flex-1 rounded-md bg-active" /><div className="grid grid-cols-3 gap-1.5">{[1, 2, 3].map(n => <span key={n} style={{ backgroundColor: preview?.active }} className="h-[26px] rounded bg-active" />)}</div></div>
        <div className="min-w-0 flex-1 basis-[280px] space-y-2.5"><span className="text-xs text-muted-foreground">{c('active')}</span><h2 className="break-words text-lg font-semibold">{active.name}</h2><p className="text-muted-foreground"><span className="font-mono text-xs">{active.version}</span> · {source(active)}{active.activatedAt && ` · ${formatStoreTimestamp(active.activatedAt, timezone)} (${timezone})`}</p><p className="break-words leading-[1.6] text-muted-foreground">{active.manifestJson.description}</p><div className="flex flex-wrap gap-2 pt-1"><Button asChild size="sm"><Link href={`/${locale}/themes/${target}/${active.slug}`}>{c(target === 'shop' ? 'customize' : 'viewSettings')}</Link></Button>{target === 'shop' && <Button asChild size="sm" variant="outline" className="gap-1 bg-ground"><a href={`${storeUrl}`} target="_blank" rel="noreferrer">{c('viewShop')}<ArrowUpRight aria-hidden="true" size={11} /></a></Button>}{menu(active)}</div></div>
      </div></article> : <p>{c('empty')}</p>}
      <section aria-labelledby="other-themes" className="overflow-hidden rounded-lg border border-border"><h2 id="other-themes" className="border-b border-border px-4 py-3 font-semibold">{c('others')}</h2>{others.length ? others.map(theme => <article key={theme.slug} aria-label={theme.name} className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3"><div className="min-w-0 flex-1 basis-[220px]"><h3 className="break-words font-medium">{theme.name}</h3><p className="text-xs text-muted-foreground"><span className="font-mono">{theme.version}</span> · {source(theme)}{theme.packageState.status !== 'available' && <span className="text-attention"> · {c(theme.packageState.status === 'corrupt' ? 'brokenReason' : 'unavailable')}</span>}</p></div><Button size="sm" variant="outline" className="h-[30px] bg-ground" disabled={busy || theme.packageState.status !== 'available'} onClick={() => void action(() => themesApi.activate(target, theme.slug), target === 'admin')}>{c('activate')}</Button>{menu(theme)}</article>) : <p className="p-4 text-muted-foreground">{c('noOthers')}</p>}<p className="px-4 py-2.5 text-xs text-faint">{c('footnote')}</p></section>
    </>}
    <Dialog open={upload} onOpenChange={open => { if (!busy) { setUpload(open); if (!open) { setFile(null); setTrusted(false); } } }}><DialogContent closeLabel={c('close')} overlayClassName="z-[90]" className="z-[100] w-[calc(100%-32px)] max-w-[460px]"><DialogHeader><DialogTitle>{c('upload')}</DialogTitle><DialogDescription>{c('uploadNote')}</DialogDescription></DialogHeader><form className="space-y-3.5" onSubmit={event => { event.preventDefault(); if (file && trusted) void action(async () => { await themesApi.install(file, trusted); setUpload(false); setFile(null); setTrusted(false); }); }}>
      <label onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); setFile(event.dataTransfer.files[0] ?? null); }} className="flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border border-dashed border-border px-4 py-[22px]"><Upload size={20} /><span>{file?.name ?? c('choosePackage')}</span><span className="text-xs text-faint">{c('dropPackage')}</span><input aria-label={c('package')} type="file" accept=".zip" className="sr-only" onChange={event => setFile(event.target.files?.[0] ?? null)} /></label><label className="flex items-start gap-2 leading-[1.6]"><input type="checkbox" className="mt-1 accent-foreground" checked={trusted} onChange={event => setTrusted(event.target.checked)} />{c('trust')}</label>{error && <p role="alert" className="text-destructive">{error}</p>}<DialogFooter><Button variant="outline" type="button" disabled={busy} onClick={() => setUpload(false)}>{c('cancel')}</Button><Button type="submit" disabled={busy || !file || !trusted}>{c('install')}</Button></DialogFooter>
    </form></DialogContent></Dialog>
  </section>;
}
