'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Package, MoreHorizontal } from 'lucide-react';
import { useLocale, useT } from 'shared/src/i18n/react';
import { useProducts, useProductStats, useCategories, useDeleteProduct, useUpdateProduct } from '@/lib/hooks/use-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { resolveApiErrorMessage } from '@/lib/error-utils';
import { cn, formatCurrency } from '@/lib/utils';
import type { AdminProductListItemDTO } from 'shared';
const statuses = ['all', 'active', 'inactive', 'outOfStock'] as const;
type Status = typeof statuses[number];
type Action = 'delete' | 'activate' | 'deactivate';
export default function ProductsPage() {
  const t = useT(), locale = useLocale(), router = useRouter(), pathname = usePathname(), params = useSearchParams();
  const c = (key: string, values?: Record<string, string | number>) => t('merchant.catalog.' + key, values);
  const param = params.get('status'), category = params.get('category') ?? '';
  const status: Status = statuses.includes(param as Status) ? param as Status : 'all';
  const urlSearch = params.get('search') ?? '';
  const [search, setSearch] = useState(urlSearch), [query, setQuery] = useState(urlSearch), [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<{ product: AdminProductListItemDTO; action: Action } | null>(null);
  const [failure, setFailure] = useState(''), [hasOrders, setHasOrders] = useState(false);
  const remove = useDeleteProduct(), update = useUpdateProduct(), pending = remove.isPending || update.isPending;
  const filters = (s: Status, cat: string, q = query) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of [['status', s === 'all' ? '' : s], ['category', cat], ['search', q]]) { if (value) next.set(key, value); else next.delete(key); }
    setPage(1); router.replace(pathname + (next.size ? '?' + next.toString() : ''), { scroll: false });
  };
  useEffect(() => { setSearch(urlSearch); setQuery(urlSearch); setPage(1); }, [urlSearch, status, category]);
  useEffect(() => {
    if (search === query) return;
    const timer = setTimeout(() => { setQuery(search); filters(status, category, search); }, 300);
    return () => clearTimeout(timer);
  }, [search, query, status, category]);
  const limit = 20;
  const list = useProducts({ page, limit, search: query, status: status === 'all' ? undefined : status, categoryId: category || undefined });
  const stats = useProductStats(), categories = useCategories(), products = list.data?.data ?? [], pagination = list.data?.pagination;
  const open = (product: AdminProductListItemDTO, action: Action) => { setFailure(''); setHasOrders(false); setDialog({ product, action }); };
  const submit = async () => {
    if (!dialog) return;
    setFailure('');
    try {
      if (dialog.action === 'delete') await remove.mutateAsync(dialog.product.id);
      else await update.mutateAsync({ id: dialog.product.id, data: { isActive: dialog.action === 'activate' } });
      setDialog(null);
    } catch (error) { setFailure(resolveApiErrorMessage(error, t)); setHasOrders((error as { code?: string }).code === 'PRODUCT_HAS_ORDERS'); }
  };
  const state = (p: AdminProductListItemDTO) => p.isActive ? p.stock === 0 ? 'outOfStock' : 'active' : 'inactive';
  const statusText = (p: AdminProductListItemDTO) => <span className={cn('inline-flex items-center gap-2 whitespace-nowrap', state(p) === 'outOfStock' ? 'text-attention' : state(p) === 'inactive' ? 'text-faint' : 'text-foreground')}><span aria-hidden="true" className={cn('size-1.5 rounded-full', state(p) === 'inactive' ? 'border border-current' : 'bg-current')} />{c(state(p))}</span>;
  const identity = (p: AdminProductListItemDTO) => <div className="flex min-w-0 items-center gap-3">{p.images?.[0] ? <img src={p.images[0]} alt="" className="size-10 shrink-0 rounded-md object-cover" /> : <span className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border bg-raised"><Package aria-hidden="true" className="size-4 text-muted-foreground" /></span>}<div className="min-w-0"><Link href={'/' + locale + '/products/' + p.id + '/edit'} className="hover:underline">{p.name}</Link><p className="mt-1 text-xs text-muted-foreground"><span className="font-mono">{p.spuCode}</span>{' · '}{p.categoryName || c('uncategorized')}</p></div></div>;
  const price = (p: AdminProductListItemDTO) => p.variantsActiveCount === 0 ? '—' : p.priceMin !== p.priceMax ? c('fromPrice', { price: formatCurrency(p.priceMin) }) : formatCurrency(p.priceMin);
  const actions = (p: AdminProductListItemDTO) => <div className="flex items-center justify-end gap-3"><Link href={'/' + locale + '/products/' + p.id + '/edit'} className="hover:underline">{c('edit')}</Link><DropdownMenu><DropdownMenuTrigger asChild><Button size="icon" variant="ghost" aria-label={c('more', { name: p.name })}><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => open(p, p.isActive ? 'deactivate' : 'activate')}>{c(p.isActive ? 'deactivate' : 'activate')}</DropdownMenuItem><DropdownMenuItem className="text-destructive" onSelect={() => open(p, 'delete')}>{c('delete')}</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div>;
  const empty = <div className="space-y-3 py-12 text-center text-muted-foreground"><p>{query || category || status !== 'all' ? c('noMatches') : c('empty')}</p>{!query && !category && status === 'all' && <Button asChild><Link href={'/' + locale + '/products/create'}>{c('addProduct')}</Link></Button>}</div>;
  return <section className="min-w-0 space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-[26px] font-semibold tracking-[-0.025em]">{c('products')}</h1><div className="flex gap-2"><Button variant="outline" asChild><Link href={'/' + locale + '/products/categories'}>{c('categories')}</Link></Button><Button asChild><Link href={'/' + locale + '/products/create'}>{c('addProduct')}</Link></Button></div></header>
    <div role="tablist" aria-label={c('status')} className="flex flex-wrap gap-x-5 border-b border-border">{statuses.map((s, i) => <button key={s} role="tab" aria-selected={status === s} tabIndex={status === s ? 0 : -1} onClick={() => filters(s, category)} onKeyDown={event => { const n = event.key === 'ArrowRight' ? (i + 1) % 4 : event.key === 'ArrowLeft' ? (i + 3) % 4 : event.key === 'Home' ? 0 : event.key === 'End' ? 3 : undefined; if (n !== undefined) { event.preventDefault(); filters(statuses[n], category); (event.currentTarget.parentElement?.children[n] as HTMLElement)?.focus(); } }} className={cn('flex items-center gap-2 border-b-[1.5px] py-2.5', status === s ? 'border-foreground' : 'border-transparent text-muted-foreground')}>{c(s)}<span className="font-mono text-xs text-faint">{stats.data?.statusCounts[s] ?? '—'}</span></button>)}</div>
    {stats.error && <p role="status" className="text-muted-foreground">{c('statsError')}</p>}
    <div className="flex flex-col gap-3 min-[769px]:flex-row"><Input aria-label={c('search')} placeholder={c('searchCodes')} value={search} onChange={e => setSearch(e.target.value)} className="h-8 flex-1 bg-raised" /><select aria-label={c('category')} value={category} onChange={e => filters(status, e.target.value)} className="h-8 rounded-md border border-border bg-raised px-3"><option value="">{c('allCategories')}</option>{categories.data?.map((cat: { id: string; name: string }) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}</select></div>
    {list.error ? <div role="alert"><p>{c('listError')}</p><Button variant="outline" onClick={() => list.refetch()}>{c('retry')}</Button></div> : list.isLoading ? <p role="status">{c('loading')}</p> : <>
      <div className="hidden overflow-x-auto rounded-[10px] border border-border min-[769px]:block"><table className="w-full text-left"><thead className="bg-raised text-xs text-faint"><tr>{['products', 'variants', 'price', 'stock', 'status', 'actions'].map(k => <th key={k} className="px-4 py-3 font-normal">{c(k)}</th>)}</tr></thead><tbody>{products.length ? products.map(p => <tr key={p.id} className="border-t border-border hover:bg-accent/60"><td className="px-4 py-3">{identity(p)}</td><td className="px-4 py-3 text-muted-foreground">{c('variantCount', { count: p.variantsCount ?? 0 })}</td><td className="px-4 py-3 font-mono">{price(p)}</td><td className="px-4 py-3 font-mono">{p.stock}</td><td className="px-4 py-3">{statusText(p)}</td><td className="px-4 py-3">{actions(p)}</td></tr>) : <tr><td colSpan={6}>{empty}</td></tr>}</tbody></table></div>
      <div className="divide-y divide-border rounded-[10px] border border-border min-[769px]:hidden">{products.length ? products.map(p => <article key={p.id} className="space-y-3 p-4">{identity(p)}<div className="flex justify-between"><span className="font-mono">{price(p)}</span>{statusText(p)}</div><div className="flex justify-between text-muted-foreground"><span>{c('variantCount', { count: p.variantsCount ?? 0 })}</span><span>{c('stock')}: <span className="font-mono">{p.stock}</span></span></div>{actions(p)}</article>) : empty}</div>
      {pagination && <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground"><p>{c('range', { start: pagination.total ? (page - 1) * limit + 1 : 0, end: Math.min(page * limit, pagination.total), total: pagination.total })}</p><div className="flex gap-2"><Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>{c('previous')}</Button><Button size="sm" variant="outline" disabled={page >= pagination.totalPages} onClick={() => setPage(page + 1)}>{c('next')}</Button></div></div>}
    </>}
    <Dialog open={!!dialog} onOpenChange={v => { if (!v && !pending) setDialog(null); }}><DialogContent><DialogHeader><DialogTitle>{dialog && c(dialog.action + 'Title', { name: dialog.product.name })}</DialogTitle><DialogDescription>{dialog && c(dialog.action + 'Hint')}</DialogDescription></DialogHeader>{failure && <p role="alert" className="text-destructive">{failure}</p>}<DialogFooter><Button variant="outline" disabled={pending} onClick={() => setDialog(null)}>{c('cancel')}</Button>{hasOrders && dialog?.action === 'delete' ? <Button disabled={pending} onClick={() => open(dialog.product, 'deactivate')}>{c('deactivateInstead')}</Button> : <Button variant={dialog?.action === 'delete' ? 'destructive' : 'default'} disabled={pending} onClick={submit}>{dialog && c(dialog.action)}</Button>}</DialogFooter></DialogContent></Dialog>
  </section>;
}
