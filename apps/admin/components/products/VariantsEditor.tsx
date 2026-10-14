'use client';
import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useT } from 'shared/src/i18n/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { generateId } from '@/lib/utils';
import { applyVariantValues, variantFieldId } from '@/lib/product-editor';

export interface EditableVariant {
  id?: string; tempId?: string; name: string; salePrice: number | string; costPrice?: number | null; stock: number | string; skuCode?: string; isActive?: boolean; hasOrders?: boolean; attributes?: Record<string, unknown>;
}
export function VariantsEditor({ variants, onChange, errors = {}, currency }: { variants: EditableVariant[]; onChange: (variants: EditableVariant[]) => void; errors?: Record<string, string>; currency: string }) {
  const t = useT(), c = (key: string, values?: Record<string, string | number>) => t('merchant.catalog.' + key, values);
  const [open, setOpen] = useState(false), [price, setPrice] = useState(''), [stock, setStock] = useState(''), [bulkError, setBulkError] = useState('');
  const popup = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null), priceInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!open) return;
    priceInput.current?.focus();
    const outside = (event: MouseEvent) => { if (!popup.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', outside); return () => document.removeEventListener('mousedown', outside);
  }, [open]);
  const apply = () => {
    if ((price !== '' && (!Number.isFinite(Number(price)) || Number(price) < 0)) || (stock !== '' && (!Number.isInteger(Number(stock)) || Number(stock) < 0))) { setBulkError(c('bulkInvalid')); return; }
    onChange(applyVariantValues(variants, price, stock)); setOpen(false); trigger.current?.focus();
  };
  const symbol = new Intl.NumberFormat(undefined, { style: 'currency', currency, currencyDisplay: 'narrowSymbol' }).formatToParts(0).find(part => part.type === 'currency')?.value ?? currency;
  const change = (index: number, patch: Partial<EditableVariant>) => onChange(variants.map((variant, i) => i === index ? { ...variant, ...patch } : variant));
  return <section className="overflow-visible rounded-lg border border-border" aria-labelledby="variants-title">
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3"><h2 id="variants-title" className="font-semibold">{c('variantsTitle')}</h2><div className="flex flex-wrap gap-1.5">
      <div className="relative"><Button ref={trigger} type="button" variant="outline" className="h-7 px-2.5" aria-haspopup="dialog" aria-expanded={open} onClick={() => { setPrice(''); setStock(''); setBulkError(''); setOpen(value => !value); }}>{c('bulkValues')}</Button>
        {open && <div ref={popup} role="dialog" aria-label={c('bulkValues')} className="absolute left-0 top-full z-40 md:left-auto md:right-0 mt-2 w-64 space-y-3 rounded-lg border border-border bg-ground p-4 shadow-lg" onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setOpen(false); trigger.current?.focus(); } if (event.key === 'Enter') { event.preventDefault(); apply(); } }}>
          <div className="space-y-1"><Label htmlFor="bulk-price">{c('bulkPrice')}</Label><Input ref={priceInput} id="bulk-price" type="number" min="0" step="0.01" value={price} onChange={event => setPrice(event.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor="bulk-stock">{c('bulkStock')}</Label><Input id="bulk-stock" type="number" min="0" step="1" value={stock} onChange={event => setStock(event.target.value)} /></div>
          {bulkError && <p role="alert" className="text-xs text-destructive">{bulkError}</p>}<p className="text-xs text-faint">{c('bulkHint')}</p><Button type="button" className="h-8" disabled={!price && !stock} onClick={apply}>{c('apply')}</Button>
        </div>}
      </div><Button type="button" variant="outline" className="h-7 px-2.5" onClick={() => onChange([...variants, { tempId: generateId(), name: '', salePrice: '', stock: 0, skuCode: '', isActive: true }])}>{c('addVariant')}</Button>
    </div></div>
    <table className="block w-full text-left md:table md:table-fixed" aria-label={c('variantsTitle')}><thead className="hidden bg-raised text-xs text-faint md:table-header-group"><tr>{['variantName', 'sku', 'price', 'stock', 'available', 'remove'].map(key => <th key={key} className={'px-2 py-2 font-medium first:pl-4 ' + (key === 'price' ? 'w-[116px]' : key === 'stock' ? 'w-20' : key === 'available' ? 'w-[52px]' : key === 'remove' ? 'w-12' : '')}>{key === 'price' ? c(key) + ' (' + currency + ')' : key === 'remove' ? <span className="sr-only">{c(key)}</span> : c(key)}</th>)}</tr></thead><tbody className="block md:table-row-group">
      {variants.map((variant, index) => {
        const prefix = variantFieldId(variant, index, ''), name = variant.name || c('newVariant', { n: index + 1 });
        return <tr key={prefix} className="block border-t border-border align-top md:table-row">
          {(['name', 'sku', 'price', 'stock'] as const).map(field => {
            const key = field === 'name' ? 'variantName' : field, id = variantFieldId(variant, index, field), error = errors[id];
            return <td key={field} className="block px-4 py-2 md:table-cell md:px-2 md:first:pl-4"><Label htmlFor={id} className="mb-1 block text-xs text-muted-foreground md:sr-only">{c(key)}</Label><div className={field === 'price' ? 'flex h-[30px] items-center gap-1 rounded-md border border-border bg-raised px-2 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring ' + (error ? 'border-destructive' : '') : ''}>
              {field === 'price' && <span aria-hidden="true" className="text-faint">{symbol}</span>}<Input id={id} aria-label={c(key) + ': ' + name} aria-invalid={!!error} aria-describedby={error ? id + '-error' : undefined} type={field === 'price' || field === 'stock' ? 'number' : 'text'} min={field === 'price' || field === 'stock' ? '0' : undefined} step={field === 'price' ? '0.01' : field === 'stock' ? '1' : undefined}
                className={field === 'price' ? 'h-auto min-w-0 border-0 bg-transparent p-0 text-right font-mono shadow-none focus-visible:ring-0' : 'h-[30px] min-w-0 bg-raised ' + (field === 'name' ? '' : 'font-mono') + (field === 'stock' ? ' text-right' : '')} placeholder={field === 'sku' ? c('skuPlaceholder') : undefined}
                value={field === 'name' ? variant.name : field === 'sku' ? variant.skuCode ?? '' : field === 'price' ? variant.salePrice : variant.stock}
                onChange={event => change(index, { [field === 'sku' ? 'skuCode' : field === 'price' ? 'salePrice' : field]: event.target.value })} /></div>
              {error && <p id={id + '-error'} role="alert" className="mt-1 text-xs text-destructive">{error}</p>}
            </td>;
          })}
          <td className="inline-block px-4 py-2 md:table-cell md:px-2"><Switch id={variantFieldId(variant, index, 'active')} aria-label={c('available') + ': ' + name} checked={variant.isActive !== false} onCheckedChange={value => change(index, { isActive: value })} /><Label htmlFor={variantFieldId(variant, index, 'active')} className="ml-2 text-xs md:sr-only">{c('available')}</Label></td>
          <td title={variant.hasOrders ? c('orderedVariantRemove') : undefined} className="inline-block px-4 py-2 text-right md:table-cell md:pl-0"><Button type="button" size="icon" variant="ghost" className="size-7" aria-label={c('removeVariant', { name })} title={variant.hasOrders ? c('orderedVariantRemove') : variants.length === 1 ? c('lastVariant') : c('remove')} disabled={variant.hasOrders || variants.length <= 1} onClick={() => onChange(variants.filter((_, i) => i !== index))}><X aria-hidden="true" className="size-3.5" /></Button></td>
        </tr>;
      })}
    </tbody></table><p className="border-t border-border px-4 py-2.5 text-xs text-faint">{c('skuHint')}</p>
  </section>;
}
