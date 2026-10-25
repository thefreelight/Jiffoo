'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
import { useLocale, useT } from 'shared/src/i18n/react';
import { useQueryClient } from '@tanstack/react-query';
import { useCategories } from '@/lib/hooks/use-api';
import { toast } from 'sonner';
import { apiClient, unwrapApiResponse } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ContentTranslations, useStoreDefaultLocale, type ContentTranslation } from '@/components/products/ContentTranslations';
import { resolveApiErrorMessage } from '@/lib/error-utils';
import { MoreHorizontal, ChevronRight } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
type Category = { id: string; name: string; slug: string; description: string | null; translations: ContentTranslation[]; productCount: number; childCount: number };
const empty = { name: '', slug: '', description: '', translations: [] as ContentTranslation[] };
export default function CategoriesPage() {
  const t = useT(), locale = useLocale(), client = useQueryClient(), c = (key: string, values?: Record<string, string | number>) => t('merchant.catalog.' + key, values);
  const store = useStoreDefaultLocale();
  const list = useCategories();
  const [translationsOpen, setTranslationsOpen] = useState(false);
  const [selected, setSelected] = useState<Category | null>(null), [mode, setMode] = useState<'edit' | 'delete' | null>(null), [form, setForm] = useState(empty), [error, setError] = useState(''), [pending, setPending] = useState(false);
  const addTrigger = useRef<HTMLButtonElement>(null), dialogTrigger = useRef<HTMLElement | null>(null), menuDialogOpening = useRef(false);
  const invalidate = async () => { await client.invalidateQueries({ queryKey: ['categories'] }); await client.invalidateQueries({ queryKey: ['products'] }); };
  const edit = async (category: Category | null, trigger: HTMLElement | null) => {
    dialogTrigger.current = trigger;
    setSelected(category); setMode('edit'); setError(''); setForm(empty); setTranslationsOpen(false);
    if (!category) return;
    setPending(true);
    try { const full = unwrapApiResponse(await apiClient.get<Category>('/admin/products/categories/' + category.id)); setForm({ name: full.name, slug: full.slug, description: full.description ?? '', translations: full.translations ?? [] }); }
    catch (failure) { setError(resolveApiErrorMessage(failure, t)); }
    finally { setPending(false); }
  };
  const submit = async (event?: React.FormEvent) => {
    event?.preventDefault(); setPending(true); setError('');
    try {
      if (mode === 'delete' && selected) { unwrapApiResponse(await apiClient.delete('/admin/products/categories/' + selected.id)); dialogTrigger.current = addTrigger.current; }
      else { const data = { ...form, translations: form.translations.filter(row => row.name.trim()) }; unwrapApiResponse(selected ? await apiClient.put('/admin/products/categories/' + selected.id, data) : await apiClient.post('/admin/products/categories', data)); }
      await invalidate(); toast.success(c(mode === 'delete' ? 'categoryDeleted' : 'categorySaved')); setMode(null);
    } catch (failure) { setError(resolveApiErrorMessage(failure, t)); }
    finally { setPending(false); }
  };
  const deleteReason = (cat: Category) => [cat.productCount > 0 ? c('categoryProducts', { count: cat.productCount }) : '', cat.childCount > 0 ? c('categoryChildren', { count: cat.childCount }) : ''].filter(Boolean).join(' ');
  const actions = (cat: Category) => { let trigger: HTMLButtonElement | null = null; return <DropdownMenu><DropdownMenuTrigger asChild><Button ref={element => { trigger = element; }} size="icon" variant="ghost" className="size-[30px]" aria-label={c('more', { name: cat.name })}><MoreHorizontal aria-hidden="true" className="size-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" onCloseAutoFocus={event => { if (menuDialogOpening.current) { event.preventDefault(); menuDialogOpening.current = false; } }}><DropdownMenuItem onSelect={() => { menuDialogOpening.current = true; void edit(cat, trigger); }}>{c('edit')}</DropdownMenuItem><DropdownMenuItem disabled={!!deleteReason(cat)} onSelect={() => { dialogTrigger.current = trigger; menuDialogOpening.current = true; setSelected(cat); setMode('delete'); setError(''); }} className="flex max-w-72 flex-col items-start"><span>{c('delete')}</span>{deleteReason(cat) && <span className="whitespace-normal text-xs text-faint">{deleteReason(cat)}</span>}</DropdownMenuItem></DropdownMenuContent></DropdownMenu>; };
  return <section className="min-w-0 space-y-5 [&:not(:first-child)]:mt-6"><Link href={'/' + locale + '/products'} className="text-muted-foreground">{c('back')}</Link><header className="flex flex-wrap items-center justify-between gap-3"><div className="space-y-1"><h1 className="text-[26px] font-semibold">{c('categories')}</h1><p className="text-muted-foreground">{c('categoryDescription')}</p></div><Button ref={addTrigger} onClick={event => void edit(null, event.currentTarget)}>{c('addCategory')}</Button></header>
    {list.error ? <div role="alert"><p>{c('categoryError')}</p><Button variant="outline" onClick={() => list.refetch()}>{c('retry')}</Button></div> : list.isLoading ? <p role="status">{c('loadingCategories')}</p> : <>
      <div className="hidden overflow-x-auto rounded-lg border border-border min-[769px]:block"><table className="w-full min-w-[600px] text-left"><thead className="bg-raised text-xs text-faint"><tr>{['name', 'slug', 'productCount', 'actions'].map(key => <th key={key} scope="col" className={key === 'productCount' ? 'px-4 py-2.5 text-right font-medium' : 'px-4 py-2.5 font-medium'}>{key === 'actions' ? <span className="sr-only">{c(key)}</span> : c(key)}</th>)}</tr></thead><tbody>{list.data?.length ? list.data.map(cat => <tr key={cat.id} className="cursor-pointer border-t border-border hover:bg-active" onClick={event => { if (!(event.target as Element).closest('button,[role^="menuitem"]')) void edit(cat, event.currentTarget.querySelector('button')); }}><td className="px-4 py-2.5"><button type="button" className="font-medium hover:underline" onClick={event => void edit(cat, event.currentTarget)}>{cat.name}</button><p className="mt-0.5 text-xs text-faint">{cat.description || c('noDescription')}</p></td><td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{cat.slug}</td><td className="px-4 py-2.5 text-right font-mono text-xs">{cat.productCount}</td><td className="py-1.5 pl-3 pr-4 text-right">{actions(cat)}</td></tr>) : <tr><td colSpan={4} className="py-12 text-center text-muted-foreground">{c('emptyCategories')}</td></tr>}</tbody></table></div>
      <div className="divide-y divide-border rounded-lg border border-border min-[769px]:hidden">{list.data?.length ? list.data.map(cat => <article key={cat.id} aria-label={cat.name} className="space-y-2 p-4"><div className="flex items-center justify-between gap-3"><button type="button" className="font-medium" onClick={event => void edit(cat, event.currentTarget)}>{cat.name}</button>{actions(cat)}</div><p className="text-xs text-faint">{cat.description || c('noDescription')}</p><p className="break-all font-mono text-xs text-muted-foreground">{cat.slug}</p><p className="flex justify-between"><span>{c('productCount')}</span><span className="font-mono">{cat.productCount}</span></p></article>) : <p className="py-12 text-center text-muted-foreground">{c('emptyCategories')}</p>}</div>
      {list.data && <p className="text-faint">{c('categoryFooter', { count: list.data.length })}</p>}
    </>}
    <Dialog open={mode !== null} onOpenChange={value => { if (!value && !pending) setMode(null); }}><DialogContent onCloseAutoFocus={event => { event.preventDefault(); const trigger = dialogTrigger.current; (trigger?.isConnected ? trigger : addTrigger.current)?.focus(); }} closeLabel={c('close')} overlayClassName="bg-overlay/45" className="max-h-[90dvh] w-[calc(100%_-_32px)] max-w-[480px] overflow-y-auto rounded-lg p-5 sm:top-[120px] sm:max-h-[calc(100dvh_-_136px)] sm:translate-y-0"><DialogHeader><DialogTitle>{mode === 'delete' ? c('deleteTitle', { name: selected?.name ?? '' }) : c(selected ? 'editCategory' : 'addCategory')}</DialogTitle><DialogDescription>{mode === 'delete' ? c('deleteHint') : c('categoryDialogHint')}</DialogDescription></DialogHeader>
      <form onSubmit={submit} className="space-y-4"><fieldset disabled={pending} className="space-y-4">{mode === 'edit' && <>
        <div className="space-y-1"><Label htmlFor="category-name">{c('name')}</Label><Input id="category-name" required value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></div>
        <div className="space-y-1"><Label htmlFor="category-slug">{c('slug')}</Label><Input id="category-slug" required pattern="[a-z0-9-]+" className="font-mono" value={form.slug} onChange={event => setForm({ ...form, slug: event.target.value })} /><p className="text-xs text-faint">{c('slugHint')}</p></div>
        <div className="space-y-1"><Label htmlFor="category-description">{c('optionalDescription')}</Label><Textarea id="category-description" value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} /></div>
        <Collapsible open={translationsOpen} onOpenChange={setTranslationsOpen}><CollapsibleTrigger asChild><Button type="button" variant="ghost" className="h-auto w-full justify-between border-t border-border px-0 py-2"><span>{t('merchant.contentTranslations.title')}</span><span className="text-xs text-faint">{['en', 'zh-Hans', 'zh-Hant'].filter(value => value !== (store.data ?? 'en')).map(value => c(form.translations.some(row => row.locale === value && row.name.trim()) ? 'translationFilled' : 'translationEmpty', { locale: t('merchant.contentTranslations.locales.' + value) })).join(' · ')}</span><ChevronRight aria-hidden="true" className={translationsOpen ? 'size-3 rotate-90' : 'size-3'} /></Button></CollapsibleTrigger><CollapsibleContent className="pt-3"><ContentTranslations showHeading={false} defaultLocale={store.data ?? 'en'} translations={form.translations} onChange={translations => setForm({ ...form, translations })} /></CollapsibleContent></Collapsible>
      </>}</fieldset>{error && <p role="alert" className="text-destructive">{error}</p>}<DialogFooter><Button type="button" variant="outline" disabled={pending} onClick={() => setMode(null)}>{c('cancel')}</Button><Button type="submit" disabled={pending} variant={mode === 'delete' ? 'destructive' : 'default'}>{c(mode === 'delete' ? 'delete' : 'save')}</Button></DialogFooter></form>
    </DialogContent></Dialog>
  </section>;
}
