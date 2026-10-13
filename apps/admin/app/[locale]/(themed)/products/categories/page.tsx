'use client';
import { useState } from 'react';
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
type Category = { id: string; name: string; slug: string; description: string | null; translations: ContentTranslation[] };
const empty = { name: '', slug: '', description: '', translations: [] as ContentTranslation[] };
export default function CategoriesPage() {
  const t = useT(), locale = useLocale(), client = useQueryClient(), c = (key: string, values?: Record<string, string | number>) => t('merchant.catalog.' + key, values);
  const store = useStoreDefaultLocale();
  const list = useCategories();
  const [selected, setSelected] = useState<Category | null>(null), [mode, setMode] = useState<'edit' | 'delete' | null>(null), [form, setForm] = useState(empty), [error, setError] = useState(''), [pending, setPending] = useState(false);
  const invalidate = async () => { await client.invalidateQueries({ queryKey: ['categories'] }); await client.invalidateQueries({ queryKey: ['products'] }); };
  const edit = async (category: Category | null) => {
    setSelected(category); setMode('edit'); setError(''); setForm(empty);
    if (!category) return;
    setPending(true);
    try { const full = unwrapApiResponse(await apiClient.get<Category>('/admin/products/categories/' + category.id)); setForm({ name: full.name, slug: full.slug, description: full.description ?? '', translations: full.translations ?? [] }); }
    catch (failure) { setError(resolveApiErrorMessage(failure, t)); }
    finally { setPending(false); }
  };
  const submit = async (event?: React.FormEvent) => {
    event?.preventDefault(); setPending(true); setError('');
    try {
      if (mode === 'delete' && selected) unwrapApiResponse(await apiClient.delete('/admin/products/categories/' + selected.id));
      else { const data = { ...form, translations: form.translations.filter(row => row.name.trim()) }; unwrapApiResponse(selected ? await apiClient.put('/admin/products/categories/' + selected.id, data) : await apiClient.post('/admin/products/categories', data)); }
      await invalidate(); toast.success(c(mode === 'delete' ? 'categoryDeleted' : 'categorySaved')); setMode(null);
    } catch (failure) { setError(resolveApiErrorMessage(failure, t)); }
    finally { setPending(false); }
  };
  const actions = (cat: Category) => <div className="flex gap-3"><Button variant="ghost" aria-label={c('edit') + ': ' + cat.name} onClick={() => edit(cat)}>{c('edit')}</Button><Button variant="ghost" aria-label={c('delete') + ': ' + cat.name} onClick={() => { setSelected(cat); setMode('delete'); setError(''); }}>{c('delete')}</Button></div>;
  return <section className="min-w-0 space-y-5"><Link href={'/' + locale + '/products'} className="text-muted-foreground">{c('back')}</Link><header className="flex items-center justify-between gap-3"><h1 className="text-[26px] font-semibold">{c('categories')}</h1><Button onClick={() => edit(null)}>{c('addCategory')}</Button></header>
    {list.error ? <div role="alert"><p>{c('categoryError')}</p><Button variant="outline" onClick={() => list.refetch()}>{c('retry')}</Button></div> : list.isLoading ? <p role="status">{c('loadingCategories')}</p> : <>
      <div className="hidden overflow-x-auto rounded-[10px] border border-border min-[769px]:block"><table className="w-full text-left"><thead className="bg-raised text-xs text-faint"><tr>{['name', 'slug', 'description', 'actions'].map(k => <th key={k} className="px-4 py-3 font-normal">{c(k)}</th>)}</tr></thead><tbody>{list.data?.length ? list.data.map(cat => <tr key={cat.id} className="border-t border-border"><td className="px-4 py-3">{cat.name}</td><td className="px-4 py-3 font-mono">{cat.slug}</td><td className="max-w-xs truncate px-4 py-3 text-muted-foreground" title={cat.description ?? undefined}>{cat.description || '—'}</td><td className="px-4 py-3">{actions(cat)}</td></tr>) : <tr><td colSpan={4} className="py-12 text-center text-muted-foreground">{c('emptyCategories')}</td></tr>}</tbody></table></div>
      <div className="divide-y divide-border rounded-[10px] border border-border min-[769px]:hidden">{list.data?.length ? list.data.map(cat => <article key={cat.id} className="space-y-2 p-4"><p>{cat.name}</p><p className="break-all font-mono text-faint">{cat.slug}</p><p className="truncate text-muted-foreground">{cat.description}</p>{actions(cat)}</article>) : <p className="py-12 text-center text-muted-foreground">{c('emptyCategories')}</p>}</div>
    </>}
    <Dialog open={mode !== null} onOpenChange={value => { if (!value && !pending) setMode(null); }}><DialogContent className="max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>{mode === 'delete' ? c('deleteTitle', { name: selected?.name ?? '' }) : c(selected ? 'editCategory' : 'addCategory')}</DialogTitle><DialogDescription>{mode === 'delete' ? c('deleteHint') : t('merchant.contentTranslations.defaultContent') + ': ' + t('merchant.contentTranslations.locales.' + (store.data ?? 'en'))}</DialogDescription></DialogHeader>
      <form onSubmit={submit} className="space-y-4"><fieldset disabled={pending} className="space-y-4">{mode === 'edit' && <><div className="space-y-1"><Label htmlFor="category-name">{c('name')}</Label><Input id="category-name" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div><div className="space-y-1"><Label htmlFor="category-slug">{c('slug')}</Label><Input id="category-slug" required className="font-mono" value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} /></div><div className="space-y-1"><Label htmlFor="category-description">{c('description')}</Label><Textarea id="category-description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div><ContentTranslations defaultLocale={store.data ?? 'en'} translations={form.translations} onChange={translations => setForm({ ...form, translations })} /></>}</fieldset>{error && <p role="alert" className="text-destructive">{error}</p>}<DialogFooter><Button type="button" variant="outline" disabled={pending} onClick={() => setMode(null)}>{c('cancel')}</Button><Button type="submit" disabled={pending} variant={mode === 'delete' ? 'destructive' : 'default'}>{c(mode === 'delete' ? 'delete' : 'save')}</Button></DialogFooter></form>
    </DialogContent></Dialog>
  </section>;
}
