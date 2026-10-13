'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale, useT } from 'shared/src/i18n/react';
import { useCategories, useCreateProduct, useUpdateProduct, useUploadProductImage } from '@/lib/hooks/use-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { VariantsEditor, type EditableVariant } from './VariantsEditor';
import { ContentTranslations, useStoreDefaultLocale, type ContentTranslation } from './ContentTranslations';
import { resolveApiErrorMessage } from '@/lib/error-utils';
import type { AdminProductDetailDTO } from 'shared';
type FormData = { name: string; description: string; translations: ContentTranslation[]; categoryId: string | null; requiresShipping: boolean; images: string[]; isActive: boolean; variants: EditableVariant[] };
function initial(product?: AdminProductDetailDTO): FormData {
  return { name: product?.name ?? '', description: product?.description ?? '', translations: (product as (AdminProductDetailDTO & { translations?: ContentTranslation[] }) | undefined)?.translations ?? [], categoryId: product?.categoryId ?? null, requiresShipping: product?.requiresShipping !== false, images: product?.images ?? [], isActive: product?.isActive !== false,
    variants: product?.variants?.map(v => ({ ...v, skuCode: v.skuCode ?? '', salePrice: Number(v.salePrice), stock: Number(v.stock), isActive: v.isActive !== false })) ?? [{ name: '', salePrice: 0, stock: 0, skuCode: '', isActive: true }] };
}
export function ProductForm({ product }: { product?: AdminProductDetailDTO }) {
  const t = useT(), locale = useLocale(), router = useRouter(), c = (key: string, values?: Record<string, string | number>) => t('merchant.catalog.' + key, values);
  const baseline = useRef(initial(product)), [data, setData] = useState(baseline.current), [revision, setRevision] = useState(0);
  const dirty = JSON.stringify(data) !== JSON.stringify(baseline.current);
  const categories = useCategories(), store = useStoreDefaultLocale(), create = useCreateProduct(), update = useUpdateProduct(), upload = useUploadProductImage();
  const [failure, setFailure] = useState(''), [uploadError, setUploadError] = useState(''), [orderedVariant, setOrderedVariant] = useState(false);
  const pending = create.isPending || update.isPending || upload.isPending;
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, revision]);
  const change = <K extends keyof FormData>(field: K, value: FormData[K]) => setData(current => ({ ...current, [field]: value }));
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setFailure(''); setOrderedVariant(false);
    const payload = { ...data, translations: data.translations.filter(row => row.name.trim()), variants: data.variants.map(({ tempId, ...variant }) => variant) };
    try {
      if (product) {
        const result = await update.mutateAsync({ id: product.id, data: payload });
        const saved = initial(result); baseline.current = saved; setData(saved); setRevision(value => value + 1);
      } else { const { isActive, ...newProduct } = payload; await create.mutateAsync(newProduct); baseline.current = data; setRevision(value => value + 1); router.push('/' + locale + '/products'); }
    } catch (error) { setFailure(resolveApiErrorMessage(error, t)); setOrderedVariant((error as { code?: string }).code === 'PRODUCT_HAS_ORDERS'); }
  };
  const panel = (title: string, body: React.ReactNode) => <section className="space-y-4 rounded-[10px] border border-border p-4"><h2 className="font-semibold">{c(title)}</h2>{body}</section>;
  return <form onSubmit={save} className="min-w-0 space-y-5">
    <header className="space-y-3"><Link href={'/' + locale + '/products'} className="text-muted-foreground hover:text-foreground">{c('back')}</Link><div className="flex flex-wrap items-center justify-between gap-3"><div className="min-w-0"><h1 className="break-words text-[26px] font-semibold">{data.name || c('newProduct')}</h1>{dirty && <p className="text-xs text-muted-foreground">{c('unsaved')}</p>}</div><div className="flex gap-2"><Button variant="outline" asChild><Link href={'/' + locale + '/products'}>{c('cancel')}</Link></Button><Button type="submit" disabled={pending}>{c(product ? 'save' : 'create')}</Button></div></div></header>
    {failure && <div role="alert" className="space-y-2 text-destructive"><p>{failure}</p>{orderedVariant && <><p>{c('orderedVariantHint')}</p><Button type="button" variant="outline" onClick={() => { change('variants', [...data.variants, ...baseline.current.variants.filter(v => v.id && !data.variants.some(next => next.id === v.id))]); }}>{c('retry')}</Button></>}</div>}
    <fieldset disabled={pending} className="grid min-w-0 gap-5 lg:grid-cols-3"><div className="min-w-0 space-y-5 lg:col-span-2">
      {panel('details', <><div className="space-y-1"><Label htmlFor="product-name">{c('name')}</Label><Input id="product-name" required value={data.name} onChange={e => change('name', e.target.value)} /></div><div className="space-y-1"><Label htmlFor="product-description">{c('description')}</Label><Textarea id="product-description" value={data.description} onChange={e => change('description', e.target.value)} /></div><ContentTranslations defaultLocale={store.data ?? 'en'} translations={data.translations} onChange={value => change('translations', value)} /></>)}
      {panel('images', <><Label htmlFor="product-images" className="inline-block rounded-md border border-dashed border-border p-4">{c('upload')}<Input id="product-images" type="file" accept="image/jpeg,image/png,image/webp" multiple className="mt-2" onChange={async e => {
        const files = Array.from(e.target.files ?? []); e.target.value = ''; setUploadError('');
        for (const file of files) { try { const result = await upload.mutateAsync(file); setData(current => ({ ...current, images: [...current.images, result.url] })); } catch (error) { setUploadError(resolveApiErrorMessage(error, t)); break; } }
      }} /></Label>{uploadError && <p role="alert" className="text-destructive">{uploadError}</p>}<div className="flex flex-wrap gap-3">{data.images.map((url, i) => <div key={url + i} className="space-y-1"><img src={url} alt="" className="size-24 rounded-md border border-border object-cover" /><Button type="button" variant="ghost" aria-label={c('removeImage', { n: i + 1 })} onClick={() => change('images', data.images.filter((_, n) => n !== i))}>{c('delete')}</Button></div>)}</div></>)}
      {panel('variants', <VariantsEditor variants={data.variants} onChange={value => change('variants', value)} />)}
    </div><div className="min-w-0 space-y-5">
      {product && panel('status', <><div className="flex items-center gap-2"><Switch id="product-active" checked={data.isActive} onCheckedChange={value => change('isActive', value)} /><Label htmlFor="product-active">{c('activeSwitch')}</Label></div><p className="text-xs text-muted-foreground">{c('activeHint')}</p></>)}
      {panel('organization', <><div className="space-y-1"><Label htmlFor="product-category">{c('category')}</Label><select id="product-category" value={data.categoryId ?? ''} onChange={e => change('categoryId', e.target.value || null)} className="h-8 w-full rounded-md border border-border bg-raised px-2"><option value="">{c('uncategorized')}</option>{categories.data?.map((cat: { id: string; name: string }) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}</select></div><div className="flex items-center gap-2"><Switch id="product-shipping" checked={data.requiresShipping} onCheckedChange={value => change('requiresShipping', value)} /><Label htmlFor="product-shipping">{c('shipping')}</Label></div><p className="text-xs text-muted-foreground">{c('shippingHint')}</p></>)}
    </div></fieldset>
  </form>;
}
