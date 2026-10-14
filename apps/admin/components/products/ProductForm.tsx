'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import { useLocale, useT } from 'shared/src/i18n/react';
import { formatStoreTimestamp, type AdminProductDetailDTO } from 'shared';
import { useCategories, useCreateProduct, useUpdateProduct, useProductNeighbors, useProductEditorContext } from '@/lib/hooks/use-api';
import { useStoreDate } from '@/lib/store-time';
import { productListQuery } from '@/lib/product-list-state';
import { cloneDraft, duplicateDraft, productDraft, productPayload, validateProductDraft, variantFieldId, type ProductDraft } from '@/lib/product-editor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuRadioGroup, DropdownMenuRadioItem } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { VariantsEditor } from './VariantsEditor';
import { ProductImages } from './ProductImages';
import { ContentTranslations } from './ContentTranslations';
import { resolveApiErrorMessage } from '@/lib/error-utils';
import { registerNavigationGuard } from '@/lib/pending-navigation';

type Destination = { href: string } | { duplicate: true } | { resume: () => void };
export function ProductForm({ product, source, categoryId, storefrontUrl = '' }: { product?: AdminProductDetailDTO; source?: AdminProductDetailDTO; categoryId?: string; storefrontUrl?: string }) {
  const t = useT(), locale = useLocale(), router = useRouter(), { timezone } = useStoreDate();
  const c = (key: string, values?: Record<string, string | number>) => t('merchant.catalog.' + key, values);
  const baseline = useRef(productDraft(product, c('defaultVariant'), categoryId || null));
  const [data, setData] = useState(() => source ? duplicateDraft(source, c('defaultVariant')) : cloneDraft(baseline.current));
  const [savedAt, setSavedAt] = useState(product?.updatedAt ?? '');
  const categories = useCategories(), context = useProductEditorContext(), create = useCreateProduct(), update = useUpdateProduct();
  const [errors, setErrors] = useState<Record<string, string>>({}), [failure, setFailure] = useState(''), [saving, setSaving] = useState(false), [uploading, setUploading] = useState(false);
  const [destination, setDestination] = useState<Destination | null>(null);
  const [listUrl, setListUrl] = useState('/' + locale + '/products');
  const busy = useRef(false), bypass = useRef(false), dirtyRef = useRef(false);
  const form = useRef<HTMLFormElement>(null);
  const dirty = JSON.stringify(data) !== JSON.stringify(baseline.current);
  dirtyRef.current = dirty || uploading;
  const pending = saving || uploading || create.isPending || update.isPending;
  const neighbors = useProductNeighbors(product?.id ?? '', productListQuery(listUrl));
  useEffect(() => {
    const url = sessionStorage.getItem('products-list:' + locale), path = '/' + locale + '/products';
    if (url === path || url?.startsWith(path + '?')) setListUrl(url);
  }, [locale]);
  const proceed = (target: Destination) => {
    bypass.current = true;
    if ('resume' in target) target.resume();
    else router.push('href' in target ? target.href : '/' + locale + '/products/create?duplicate=' + encodeURIComponent(product!.id));
  };
  const requestNavigation = (target: Destination) => { if (dirtyRef.current) setDestination(target); else proceed(target); };
  useEffect(() => {
    const unregister = registerNavigationGuard(resume => {
      if (!dirtyRef.current || bypass.current) return false;
      setDestination({ resume }); return true;
    });
    const unload = (event: BeforeUnloadEvent) => { if (dirtyRef.current && !bypass.current) { event.preventDefault(); event.returnValue = ''; } };
    const click = (event: MouseEvent) => {
      if (!dirtyRef.current || bypass.current || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element).closest?.('a[href]') as HTMLAnchorElement | null;
      if (!link || link.target === '_blank' || link.hasAttribute('download')) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin || (url.pathname === window.location.pathname && url.search === window.location.search)) return;
      event.preventDefault(); event.stopPropagation(); setDestination({ href: url.pathname + url.search + url.hash });
    };
    document.addEventListener('click', click, true); window.addEventListener('beforeunload', unload);
    return () => { unregister(); document.removeEventListener('click', click, true); window.removeEventListener('beforeunload', unload); };
  }, []);
  const change = <K extends keyof ProductDraft>(field: K, value: ProductDraft[K]) => { setData(current => ({ ...current, [field]: value })); setErrors({}); setFailure(''); };
  const discard = () => { setData(cloneDraft(baseline.current)); setErrors({}); setFailure(''); };
  const save = async (mode: 'stay' | 'continue' = 'stay', leaving = false): Promise<boolean> => {
    if (busy.current) return false;
    const invalid = validateProductDraft(data, c); setErrors(invalid); setFailure('');
    if (Object.keys(invalid).length) return false;
    busy.current = true; setSaving(true);
    try {
      const payload = productPayload(data);
      const result = product ? await update.mutateAsync({ id: product.id, data: payload }) : await create.mutateAsync(payload);
      const saved = productDraft(result, c('defaultVariant')); baseline.current = saved; setData(cloneDraft(saved)); setSavedAt(result.updatedAt); dirtyRef.current = false;
      if (!product && !leaving) {
        bypass.current = true;
        if (mode === 'continue') {
          const fresh = productDraft(undefined, c('defaultVariant'), data.categoryId); baseline.current = fresh; setData(cloneDraft(fresh)); setSavedAt('');
          router.replace('/' + locale + '/products/create' + (data.categoryId ? '?categoryId=' + encodeURIComponent(data.categoryId) : '')); bypass.current = false;
        } else router.replace('/' + locale + '/products/' + result.id + '/edit');
      }
      return true;
    } catch (error) {
      const typed = error as { code?: string; details?: { field?: string; variantIndex?: number } }, details = typed.details;
      const message = resolveApiErrorMessage(error, t);
      if (['SPU_CODE_TAKEN', 'SKU_CODE_TAKEN', 'INVALID_PRODUCT_CODE'].includes(typed.code ?? '') && details?.field) {
        const index = details.variantIndex;
        if (details.field === 'spuCode') setErrors({ 'product-spu': message });
        else if (index !== undefined && data.variants[index]) setErrors({ [variantFieldId(data.variants[index], index, 'sku')]: message });
        else setFailure(message);
      } else setFailure(message);
      return false;
    } finally { busy.current = false; setSaving(false); }
  };
  const focusError = () => {
    const field = form.current?.querySelector<HTMLElement>('[aria-invalid="true"]') ?? document.getElementById('product-name');
    field?.scrollIntoView({ block: 'center', behavior: 'smooth' }); field?.focus({ preventScroll: true });
  };
  const availableInStore = !!product && baseline.current.isActive && data.isActive && baseline.current.variants.some(variant => variant.isActive !== false);
  const storeLink = product?.slug && storefrontUrl ? storefrontUrl.replace(/\/$/, '') + '/products/' + encodeURIComponent(product.slug) : '';
  const errorCount = Object.keys(errors).length;
  const panel = 'space-y-3.5 rounded-lg border border-border p-4';
  const fieldError = (id: string) => errors[id] && <p id={id + '-error'} role="alert" className="text-xs text-destructive">{errors[id]}</p>;
  return <form ref={form} noValidate onSubmit={event => { event.preventDefault(); void save(); }} className="mx-auto min-w-0 max-w-[760px] [&:not(:first-child)]:mt-6">
    <header className="sticky top-0 z-30 space-y-2.5 border-b border-border bg-ground px-4 pb-3.5 pt-4 sm:px-8">
      <div className="flex flex-wrap items-center justify-between gap-2"><Link href={listUrl} className="text-muted-foreground hover:underline">{c('back')}</Link>
        {product && <nav aria-label={c('productNavigation')} className="flex items-center gap-1"><span className="mr-1 font-mono text-xs text-faint">{neighbors.data ? (neighbors.data.position ?? '—') + ' / ' + neighbors.data.total : '— / —'}</span>{(['previous', 'next'] as const).map(direction => { const id = direction === 'previous' ? neighbors.data?.previousId : neighbors.data?.nextId, Icon = direction === 'previous' ? ChevronLeft : ChevronRight; return id ? <Button asChild key={direction} variant="outline" size="icon" className="size-7"><Link aria-label={c(direction === 'previous' ? 'previousProduct' : 'nextProduct')} href={'/' + locale + '/products/' + id + '/edit' + (listUrl.includes('?') ? '?' + listUrl.split('?')[1] : '')}><Icon aria-hidden="true" className="size-3" /></Link></Button> : <Button key={direction} type="button" disabled variant="outline" size="icon" className="size-7" aria-label={c(direction === 'previous' ? 'previousProduct' : 'nextProduct')}><Icon aria-hidden="true" className="size-3" /></Button>; })}</nav>}
      </div>
      {neighbors.error && product && <p role="alert" className="text-xs text-muted-foreground">{c('neighborsError')} <Button type="button" variant="outline" size="sm" onClick={() => neighbors.refetch()}>{c('retry')}</Button></p>}
      <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex min-w-0 flex-wrap items-center gap-2.5"><h1 className="break-words text-[22px] font-semibold tracking-tight">{product ? data.name || c('editProduct') : c('newProduct')}</h1>
        <DropdownMenu><DropdownMenuTrigger asChild><Button id="product-active" type="button" variant="outline" disabled={pending} className="h-[26px] gap-1.5 rounded-full bg-raised px-2 text-xs" aria-label={c('productStatus')}><span aria-hidden="true" className={'size-[7px] rounded-full border border-foreground ' + (data.isActive ? 'bg-foreground' : '')} />{c(data.isActive ? 'active' : 'inactive')}<ChevronDown aria-hidden="true" className="size-2.5 text-faint" /></Button></DropdownMenuTrigger><DropdownMenuContent><DropdownMenuRadioGroup value={data.isActive ? 'active' : 'inactive'}>{['active', 'inactive'].map(value => <DropdownMenuRadioItem key={value} value={value} onSelect={() => change('isActive', value === 'active')}>{c(value)}</DropdownMenuRadioItem>)}</DropdownMenuRadioGroup></DropdownMenuContent></DropdownMenu>
      </div><div className="flex flex-wrap items-center gap-2"><span className={'inline-flex items-center gap-1.5 text-xs ' + (dirty || !product ? 'text-foreground' : 'text-faint')}>{(dirty || !product) && <span aria-hidden="true" className="size-1.5 rounded-full bg-attention" />}{product ? dirty ? c('unsaved') : c('savedAt', { time: savedAt ? formatStoreTimestamp(savedAt, timezone) : '—', timezone }) : c('newUnsaved')}</span>
        <DropdownMenu><DropdownMenuTrigger asChild><Button type="button" variant="outline" size="icon" className="size-8" disabled={pending} aria-label={c('editorMore')}><MoreHorizontal aria-hidden="true" className="size-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end">
          <DropdownMenuItem disabled={!product} onSelect={() => requestNavigation({ duplicate: true })}>{c('duplicateProduct')}{!product && <span className="ml-2 text-xs text-faint">{c('unsavedViewReason')}</span>}</DropdownMenuItem>
          {availableInStore && storeLink ? <DropdownMenuItem asChild><a href={storeLink} target="_blank" rel="noopener noreferrer">{c('viewInStore')}</a></DropdownMenuItem> : <DropdownMenuItem disabled className="flex max-w-72 flex-col items-start"><span>{c('viewInStore')}</span><span className="text-xs text-faint">{c(product ? 'inactiveViewReason' : 'unsavedViewReason')}</span></DropdownMenuItem>}
        </DropdownMenuContent></DropdownMenu>
        {dirty && <Button type="button" variant="outline" className="h-8" disabled={pending} onClick={discard}>{c('discardChanges')}</Button>}
        {!product && <Button type="button" variant="outline" className="h-8" disabled={pending || !context.data?.currency} onClick={() => void save('continue')}>{c('saveAndAdd')}</Button>}
        <Button type="submit" className="h-8" disabled={pending || !context.data?.currency || (!!product && !dirty)}>{c('save')}</Button>
      </div></div>
    </header>
    <div className="space-y-5 px-4 pb-16 pt-6 sm:px-8">
      {(errorCount > 0 || failure) && <div role="alert" className="flex flex-wrap items-center gap-2 rounded-md border border-destructive-line px-3.5 py-2.5 text-destructive"><p className="min-w-0 flex-1">{errorCount ? c('saveFailure', { count: errorCount }) : c('saveFailureGeneral')} {failure}</p><Button type="button" variant="ghost" className="h-auto p-0 text-destructive underline" onClick={focusError}>{c('goFix')}</Button></div>}
      {context.error && <div role="alert"><p>{c('editorContextError')}</p><Button type="button" variant="outline" onClick={() => context.refetch()}>{c('retry')}</Button></div>}
      <fieldset disabled={pending} className="min-w-0 space-y-5">
        <section aria-labelledby="basic-title" className={panel}><h2 id="basic-title" className="font-semibold">{c('details')}</h2>
          <div className="space-y-1.5"><Label htmlFor="product-name">{c('name')}</Label><Input id="product-name" className="h-[34px] bg-raised" value={data.name} aria-invalid={!!errors['product-name']} aria-describedby={errors['product-name'] ? 'product-name-error' : undefined} onChange={event => change('name', event.target.value)} />{fieldError('product-name')}</div>
          <div className="space-y-1.5"><Label htmlFor="product-spu">{c('spu')}</Label><Input id="product-spu" className="h-[34px] bg-raised font-mono text-xs" value={data.spuCode} placeholder={c('spuPlaceholder')} aria-invalid={!!errors['product-spu']} aria-describedby={'product-spu-hint' + (errors['product-spu'] ? ' product-spu-error' : '')} onChange={event => change('spuCode', event.target.value)} /><p id="product-spu-hint" className="text-xs text-faint">{c('spuHint')}</p>{fieldError('product-spu')}</div>
          <div className="space-y-1.5"><Label htmlFor="product-description">{c('description')}</Label><Textarea id="product-description" rows={4} className="bg-raised" value={data.description} onChange={event => change('description', event.target.value)} /></div>
        </section>
        {context.data?.currency && <VariantsEditor variants={data.variants} currency={context.data.currency} errors={errors} onChange={value => change('variants', value)} />}
        <ProductImages disabled={pending} images={data.images} onPending={setUploading} onChange={updateImages => setData(current => ({ ...current, images: updateImages(current.images) }))} />
        <section aria-labelledby="organization-title" className={panel}><h2 id="organization-title" className="font-semibold">{c('organization')}</h2><div className="space-y-1.5"><Label htmlFor="product-category">{c('category')}</Label>
          <DropdownMenu><DropdownMenuTrigger asChild><Button id="product-category" type="button" variant="outline" aria-label={c('category')} className="h-[34px] w-full min-w-0 justify-between bg-raised px-3"><span className="min-w-0 whitespace-normal text-left break-words">{categories.data?.find((category: { id: string; name: string }) => category.id === data.categoryId)?.name ?? c('editorUncategorized')}</span><ChevronDown aria-hidden="true" className="size-3 shrink-0 text-faint" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="start" aria-label={c('category')} className="w-[var(--radix-dropdown-menu-trigger-width)] max-w-[calc(100vw-32px)] p-1"><DropdownMenuRadioGroup value={data.categoryId ?? ''} className="max-h-64 overflow-y-auto"><DropdownMenuRadioItem value="" onSelect={() => change('categoryId', null)}>{c('editorUncategorized')}</DropdownMenuRadioItem>{categories.data?.map((category: { id: string; name: string }) => <DropdownMenuRadioItem key={category.id} value={category.id} className="whitespace-normal break-words" onSelect={() => change('categoryId', category.id)}>{category.name}</DropdownMenuRadioItem>)}</DropdownMenuRadioGroup></DropdownMenuContent>
          </DropdownMenu></div>
          {categories.error && <p role="alert">{c('categoryError')}</p>}<div className="flex items-center gap-3 border-t border-border pt-3"><div className="flex-1"><Label htmlFor="product-shipping">{c('shipping')}</Label><p className="mt-0.5 text-muted-foreground">{c('editorShippingHint')}</p></div><Switch id="product-shipping" checked={data.requiresShipping} onCheckedChange={value => change('requiresShipping', value)} /></div>
        </section>
        <section aria-labelledby="translations-title" className="overflow-hidden rounded-lg border border-border"><h2 id="translations-title" className="border-b border-border px-4 py-3 font-semibold">{t('merchant.contentTranslations.title')} <span className="font-normal text-faint">{c('translationsHint')}</span></h2>
          {['en', 'zh-Hans', 'zh-Hant'].filter(language => language !== context.data?.defaultLocale).map(language => <Collapsible key={language}><CollapsibleTrigger asChild><Button type="button" variant="ghost" className="h-auto w-full justify-between rounded-none border-b border-border px-4 py-3"><span>{t('merchant.contentTranslations.locales.' + language)}</span><span className="ml-auto mr-2 text-faint">{c(data.translations.some(row => row.locale === language && row.name.trim()) ? 'filled' : 'notFilled')}</span><ChevronRight aria-hidden="true" className="size-3" /></Button></CollapsibleTrigger><CollapsibleContent className="p-4"><ContentTranslations onlyLocale={language} showHeading={false} defaultLocale={context.data?.defaultLocale ?? ''} translations={data.translations} onChange={value => change('translations', value)} /></CollapsibleContent></Collapsible>)}
        </section>
      </fieldset>
    </div>
    <AlertDialog open={destination !== null} onOpenChange={open => { if (!open && !saving) setDestination(null); }}><AlertDialogContent overlayClassName="bg-overlay-ink/45" className="w-[calc(100%_-_32px)] max-w-[420px] rounded-lg p-5 sm:top-[160px] sm:translate-y-0"><AlertDialogHeader><AlertDialogTitle className="text-base">{c('leaveTitle')}</AlertDialogTitle><AlertDialogDescription>{c('leaveDescription')}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter className="gap-2">
      <Button type="button" variant="outline" className="text-destructive" disabled={pending} onClick={() => { const target = destination!; setDestination(null); proceed(target); }}>{c('leaveWithoutSaving')}</Button>
      <AlertDialogCancel disabled={pending}>{c('keepEditing')}</AlertDialogCancel>
      <Button type="button" disabled={pending} onClick={async () => { const target = destination!; if (await save('stay', true)) { setDestination(null); proceed(target); } else setDestination(null); }}>{c('saveAndLeave')}</Button>
    </AlertDialogFooter></AlertDialogContent></AlertDialog>
  </form>;
}
