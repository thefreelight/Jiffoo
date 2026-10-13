'use client';
import { useT } from 'shared/src/i18n/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { generateId } from '@/lib/utils';
export interface EditableVariant {
  id?: string; tempId?: string; name: string; salePrice: number; costPrice?: number | null; stock: number; skuCode?: string; isActive?: boolean; attributes?: Record<string, unknown>;
}
export function VariantsEditor({ variants, onChange }: { variants: EditableVariant[]; onChange: (variants: EditableVariant[]) => void; productId?: string }) {
  const t = useT(), c = (key: string, values?: Record<string, string | number>) => t('merchant.catalog.' + key, values);
  const change = (index: number, data: Partial<EditableVariant>) => onChange(variants.map((v, i) => i === index ? { ...v, ...data } : v));
  return <div className="space-y-3">{variants.map((v, i) => {
    const prefix = 'variant-' + (v.id || v.tempId || i);
    return <div key={prefix} className="space-y-3 rounded-md border border-border p-3"><div className="grid grid-cols-2 gap-3">
      <div className="space-y-1"><Label htmlFor={prefix + '-name'}>{c('name')}</Label><Input id={prefix + '-name'} required value={v.name} onChange={e => change(i, { name: e.target.value })} /></div>
      <div className="space-y-1"><Label htmlFor={prefix + '-sku'}>{c('sku')}</Label><Input id={prefix + '-sku'} className="font-mono" value={v.skuCode ?? ''} onChange={e => change(i, { skuCode: e.target.value })} /></div>
      <div className="space-y-1"><Label htmlFor={prefix + '-price'}>{c('price')}</Label><Input id={prefix + '-price'} className="font-mono" type="number" min="0" step="0.01" required value={v.salePrice} onChange={e => change(i, { salePrice: Number(e.target.value) })} /></div>
      <div className="space-y-1"><Label htmlFor={prefix + '-stock'}>{c('stock')}</Label><Input id={prefix + '-stock'} className="font-mono" type="number" min="0" step="1" required value={v.stock} onChange={e => change(i, { stock: Number(e.target.value) })} /></div>
    </div><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><Switch id={prefix + '-active'} checked={v.isActive !== false} onCheckedChange={value => change(i, { isActive: value })} /><Label htmlFor={prefix + '-active'}>{c('available')}</Label></div><Button type="button" variant="ghost" disabled={variants.length <= 1} aria-label={c('removeVariant', { name: v.name })} onClick={() => onChange(variants.filter((_, n) => n !== i))}>{c('delete')}</Button></div></div>;
  })}<Button type="button" variant="outline" onClick={() => onChange([...variants, { tempId: generateId(), name: '', salePrice: 0, stock: 0, skuCode: '', isActive: true }])}>{c('addVariant')}</Button></div>;
}
