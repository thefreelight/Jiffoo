'use client';
import { useEffect, useState, type MouseEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MoreHorizontal, Package, Download } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useLocale, useT } from 'shared/src/i18n/react';
import { formatStoreTimestamp, type AdminProductListItemDTO } from 'shared';
import { useProducts, useProductStats, useCategories } from '@/lib/hooks/use-api';
import { productsApi, type ProductSelection, type ProductBulkAction, type ProductBulkResult } from '@/lib/api';
import { useListState, useListSelection } from '@/lib/hooks/use-list-state';
import { productListFields as fields } from '@/lib/product-list-state';
import { BulkBar, FilterChips, ListEmpty, ListSearch, ListFilter, PaginationBar, SelectionBanner, SortHeader, StatusTabs } from '@/components/list';
import { BulkDeleteDialog } from '@/components/products/BulkDeleteDialog';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { resolveApiErrorMessage } from '@/lib/error-utils';
import { useStoreDate } from '@/lib/store-time';
import { cn, formatCurrency } from '@/lib/utils';

const statuses = ['all', 'active', 'inactive', 'outOfStock'];
const sharedKeys = ['clearAll', 'clearFilters', 'removeFilter', 'pagination', 'perPage', 'perPageBefore', 'perPageAfter', 'pageLabel'];

export default function ProductsPage() {
  const t = useT(), locale = useLocale(), router = useRouter(), client = useQueryClient(), { timezone } = useStoreDate();
  const c = (key: string, values?: Record<string, string | number>) => t('merchant.catalog.' + key, values);
  const l = (key: string, values?: Record<string, string | number>) => sharedKeys.includes(key) ? t('merchant.orders.list.' + key, values) : c(key, values);
  const { state, update, url } = useListState(fields), page = Number(state.page), pageSize = Number(state.pageSize);
  const change = (patch: Record<string, string>) => update({ page: '1', ...patch });
  useEffect(() => { sessionStorage.setItem('products-list:' + locale, url); }, [url, locale]);
  const filter = { search: state.search, status: state.status === 'all' ? undefined : state.status, categoryId: state.category || undefined };
  const sort = { sortBy: state.sortBy as 'name' | 'createdAt' | 'updatedAt' | 'price' | 'stock', sortOrder: state.sortOrder as 'asc' | 'desc' };
  const list = useProducts({ ...filter, ...sort, page, limit: pageSize }), stats = useProductStats(), categories = useCategories();
  const products = list.data?.data ?? [], total = list.data?.pagination?.total ?? 0;
  useEffect(() => {
    if (categories.data && state.category && state.category !== 'none' && !categories.data.some(category => category.id === state.category)) change({ category: '' });
  }, [categories.data, state.category]);
  const selection = useListSelection(JSON.stringify(state), filter, products.map(product => product.id), total);
  const [pending, setPending] = useState(false), [failure, setFailure] = useState(''), [message, setMessage] = useState('');
  const [preview, setPreview] = useState<ProductBulkResult | null>(null), [deleteSelection, setDeleteSelection] = useState<ProductSelection | null>(null);
  useEffect(() => { if (list.data?.pagination?.page === page && page > Math.max(1, Math.ceil(total / pageSize))) update({ page: '1' }); }, [list.data?.pagination?.page, page, pageSize, total]);
  const refresh = async () => { await Promise.all(['products', 'product-stats', 'categories'].map(key => client.invalidateQueries({ queryKey: [key] }))); };
  const apply = async (action: ProductBulkAction, selected: ProductSelection = selection.selection, categoryId?: string | null) => {
    setPending(true); setFailure(''); setMessage('');
    try {
      const result = await productsApi.bulk(action, selected, action === 'setCategory' ? { categoryId } : {});
      setMessage(c('bulkResult', { processed: result.processed, skipped: result.skippedCount })); setPreview(null); selection.clear(); await refresh();
    } catch (error) { setFailure(resolveApiErrorMessage(error, t)); } finally { setPending(false); }
  };
  const confirmDelete = async (selected: ProductSelection) => {
    setPending(true); setFailure('');
    try { const result = await productsApi.bulk('delete', selected, { dryRun: true }); setDeleteSelection(selected); setPreview(result); }
    catch (error) { setFailure(resolveApiErrorMessage(error, t)); } finally { setPending(false); }
  };
  const exportProducts = async (selected: boolean) => {
    setPending(true); setFailure(''); setMessage('');
    try {
      const result = await productsApi.export(selected ? selection.selection : { mode: 'filter', filter }, sort, locale);
      const objectUrl = URL.createObjectURL(result.blob), link = document.createElement('a'); link.href = objectUrl; link.download = result.filename;
      document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      if (Number.isFinite(result.count) && Number.isFinite(result.skipped)) setMessage(c('bulkResult', { processed: result.count, skipped: result.skipped }));
      if (selected) { selection.clear(); await refresh(); }
    } catch { setFailure(c('exportError')); } finally { setPending(false); }
  };
  const categoryOptions = [{ value: '', label: c('all') }, { value: 'none', label: c('uncategorized') }, ...(categories.data ?? []).map(category => ({ value: category.id, label: category.name }))];
  const clear = () => change({ search: '', category: '' });
  const chips = state.category ? [{ key: 'category', name: c('category'), value: categoryOptions.find(option => option.value === state.category)?.label ?? state.category, remove: () => change({ category: '' }) }] : [];
  const productState = (product: AdminProductListItemDTO) => product.isActive ? product.stock === 0 ? 'outOfStock' : 'active' : 'inactive';
  const status = (product: AdminProductListItemDTO) => <span className={cn('inline-flex items-center gap-2 whitespace-nowrap', productState(product) === 'outOfStock' ? 'text-attention' : productState(product) === 'inactive' ? 'text-faint' : 'text-foreground')}><span aria-hidden="true" className={cn('size-1.5 rounded-full', productState(product) === 'inactive' ? 'border border-current' : 'bg-current')} />{c(productState(product))}</span>;
  const href = (product: AdminProductListItemDTO) => '/' + locale + '/products/' + product.id + '/edit';
  const open = (event: MouseEvent, product: AdminProductListItemDTO) => { if (!(event.target as Element).closest('a,button,input,label,[role^="menuitem"]')) router.push(href(product)); };
  const identity = (product: AdminProductListItemDTO) => <div className="flex min-w-0 items-center gap-3">{product.images[0] ? <img src={product.images[0]} alt="" className="size-9 shrink-0 rounded-md object-cover" /> : <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-raised"><Package aria-hidden="true" className="size-4 text-faint" /></span>}<div className="min-w-0"><Link href={href(product)} className="font-medium hover:underline">{product.name}</Link><p className="mt-0.5 text-xs text-faint"><span className="font-mono">{product.spuCode}</span>{' · '}{product.categoryName || c('uncategorized')}{' · '}{c('variantCount', { count: product.variantsCount ?? 0 })}</p></div></div>;
  const price = (product: AdminProductListItemDTO) => product.variantsActiveCount === 0 ? '—' : product.priceMin === product.priceMax ? formatCurrency(product.priceMin, product.currency) : c('fromPrice', { price: formatCurrency(product.priceMin, product.currency) });
  const checkbox = (product: AdminProductListItemDTO) => <input type="checkbox" className="size-[15px] shrink-0 accent-foreground" aria-label={c('selectProduct', { name: product.name })} checked={selection.checked(product.id)} onChange={() => selection.toggle(product.id)} />;
  const pageCheckbox = <input type="checkbox" className="size-[15px] accent-foreground" aria-label={c('selectPage')} checked={selection.pageChecked} disabled={!products.length} onChange={selection.togglePage} />;
  const actions = (product: AdminProductListItemDTO) => <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="size-[30px]" aria-label={c('more', { name: product.name })}><MoreHorizontal aria-hidden="true" className="size-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end">
    <DropdownMenuItem asChild><Link href={href(product)}>{c('edit')}</Link></DropdownMenuItem>
    <DropdownMenuItem disabled={pending} onSelect={() => apply(product.isActive ? 'deactivate' : 'activate', { mode: 'ids', ids: [product.id] })}>{c(product.isActive ? 'deactivate' : 'activate')}</DropdownMenuItem>
    <DropdownMenuItem disabled={pending || product.hasOrders} onSelect={() => confirmDelete({ mode: 'ids', ids: [product.id] })} className="flex max-w-72 flex-col items-start"><span>{c('delete')}</span>{product.hasOrders && <span className="whitespace-normal text-xs text-faint">{c('soldReason')}</span>}</DropdownMenuItem>
  </DropdownMenuContent></DropdownMenu>;
  return <section className="mx-auto flex min-h-[calc(100dvh-72px)] min-w-0 max-w-[1120px] flex-col gap-4 [&:not(:first-child)]:mt-6">
    <header className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-[26px] font-semibold">{c('products')}</h1><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" asChild><Link href={'/' + locale + '/products/categories'}>{c('manageCategories')}</Link></Button><Button size="sm" variant="outline" disabled={pending} onClick={() => exportProducts(false)}><Download aria-hidden="true" className="mr-1 size-3.5" />{c('export')}</Button><Button size="sm" asChild><Link href={'/' + locale + '/products/create'}>{c('addProduct')}</Link></Button></div></header>
    <StatusTabs label={c('status')} value={state.status} onChange={status => change({ status })} tabs={statuses.map(value => ({ value, label: c(value), attention: value === 'outOfStock', count: stats.data?.statusCounts[value as keyof typeof stats.data.statusCounts] }))} />
    {stats.error && <p role="status">{c('statsError')}</p>}
    <div className="flex flex-wrap gap-2"><ListSearch label={c('searchCodes')} value={state.search} onChange={search => change({ search })} /><ListFilter label={c('category')} value={state.category} options={categoryOptions} onChange={category => change({ category })} /></div>
    <FilterChips chips={chips} copy={l} clear={clear} />{failure && <p role="alert" className="text-destructive">{failure}</p>}{message && <p role="status">{message}</p>}
    {list.error ? <div role="alert"><p>{c('listError')}</p><Button variant="outline" onClick={() => list.refetch()}>{c('retry')}</Button></div> : list.isLoading ? <p role="status">{c('loading')}</p> : <div className="overflow-hidden rounded-lg border border-border">
      {(selection.pageChecked || selection.selection.mode === 'filter') && <SelectionBanner all={selection.selection.mode === 'filter'} count={selection.selection.mode === 'filter' ? selection.count : products.length} total={total} copy={l} selectAll={selection.allMatching} onlyPage={selection.onlyPage} />}
      <div className="hidden overflow-x-auto min-[769px]:block"><table className="w-full min-w-[760px] text-left text-[13px]"><thead className="bg-raised text-xs text-faint"><tr><th scope="col" className="w-10 py-2.5 pl-4">{pageCheckbox}</th><SortHeader label={c('products')} field="name" {...sort} align="left" onSort={(sortBy, sortOrder) => change({ sortBy, sortOrder })} /><th scope="col" className="px-3 py-2.5 font-medium">{c('status')}</th>{['price', 'stock', 'updatedAt'].map(field => <SortHeader key={field} label={c(field, { timezone })} field={field} {...sort} onSort={(sortBy, sortOrder) => change({ sortBy, sortOrder })} />)}<th scope="col" className="pr-4"><span className="sr-only">{c('actions')}</span></th></tr></thead><tbody>{products.map(product => <tr key={product.id} onClick={event => open(event, product)} className={cn('cursor-pointer border-t border-border hover:bg-active', selection.checked(product.id) && 'bg-active')}><td className="py-2.5 pl-4">{checkbox(product)}</td><td className="px-3 py-2.5">{identity(product)}</td><td className="px-3 py-2.5">{status(product)}</td><td className="whitespace-nowrap px-3 py-2.5 text-right font-mono text-xs">{price(product)}</td><td className={cn('px-3 py-2.5 text-right font-mono text-xs', productState(product) === 'outOfStock' && 'text-attention')}>{product.stock}</td><td className="whitespace-nowrap px-3 py-2.5 text-right text-muted-foreground">{formatStoreTimestamp(product.updatedAt, timezone)}</td><td className="py-1.5 pl-3 pr-4 text-right">{actions(product)}</td></tr>)}</tbody></table></div>
      <div className="divide-y divide-border min-[769px]:hidden"><p className="px-4 py-2 text-xs text-faint">{c('updatedAt', { timezone })}</p>{!!products.length && <label className="flex items-center gap-2 p-4">{pageCheckbox}{c('selectPage')}</label>}{products.map(product => <article aria-label={product.name} key={product.id} onClick={event => open(event, product)} className={cn('space-y-3 p-4', selection.checked(product.id) && 'bg-active')}><div className="flex items-start gap-2">{checkbox(product)}{identity(product)}</div><div className="flex items-center justify-between gap-2">{status(product)}<span className="font-mono">{price(product)}</span></div><p className="flex justify-between text-muted-foreground"><span>{c('stock')}</span><span className="font-mono">{product.stock}</span></p><div className="flex items-center justify-between gap-2"><time dateTime={product.updatedAt} className="text-xs text-faint">{formatStoreTimestamp(product.updatedAt, timezone)}</time>{actions(product)}</div></article>)}</div>
      {!products.length && <ListEmpty filtered={!!state.search || !!state.category || state.status !== 'all'} copy={l} clear={() => change({ status: 'all', category: '', search: '' })} />}
    </div>}
    <PaginationBar copy={l} page={page} pageSize={pageSize} total={total} onPage={page => update({ page: String(page) })} onPageSize={pageSize => change({ pageSize: String(pageSize) })} />
    <BulkBar count={selection.count} copy={l} allMatching={selection.selection.mode === 'filter'} clear={selection.clear}><Button size="sm" variant="outline" disabled={pending} onClick={() => apply('activate')}>{c('activate')}</Button><Button size="sm" variant="outline" disabled={pending} onClick={() => apply('deactivate')}>{c('deactivate')}</Button><ListFilter label={c('changeCategory')} disabled={pending} showValue={false} value="" options={categoryOptions.filter(option => option.value !== '')} onChange={category => { if (!pending) apply('setCategory', selection.selection, category === 'none' ? null : category); }} /><Button size="sm" variant="outline" disabled={pending} onClick={() => exportProducts(true)}>{c('export')}</Button><Button size="sm" variant="outline" disabled={pending} onClick={() => confirmDelete(selection.selection)}>{c('delete')}</Button></BulkBar>
    <BulkDeleteDialog result={preview} pending={pending} error={failure} onCancel={() => setPreview(null)} onConfirm={() => { if (deleteSelection) apply('delete', deleteSelection); }} />
  </section>;
}
