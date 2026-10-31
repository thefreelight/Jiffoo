'use client';

import { useState } from 'react';
import { useT } from 'shared/src/i18n/react';
import { productsApi, type BulkPriceMode, type BulkPriceRequest, type BulkPriceResult, type ProductSelection } from '@/lib/api';
import { resolveApiErrorMessage } from '@/lib/error-utils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

const DECIMAL = /^-?\d+(\.\d+)?$/;

type PriceMode = 'amount' | 'percentage';
type PendingAction = 'preview' | 'apply' | null;

export function BulkPriceEditDialog({ selection, onClose, onApplied }: {
  selection: ProductSelection;
  onClose: () => void;
  onApplied: (result: BulkPriceResult) => void;
}) {
  const t = useT();
  const c = (key: string, values?: Record<string, string | number>) => t('merchant.bulkActions.price.' + key, values);
  const [target] = useState<ProductSelection>(selection);
  const [saleEnabled, setSaleEnabled] = useState(false), [compareEnabled, setCompareEnabled] = useState(false);
  const [clearCompare, setClearCompare] = useState(false);
  const [saleMode, setSaleMode] = useState<PriceMode>('amount'), [compareMode, setCompareMode] = useState<PriceMode>('amount');
  const [saleValue, setSaleValue] = useState(''), [compareValue, setCompareValue] = useState('');
  const [saleError, setSaleError] = useState(''), [compareError, setCompareError] = useState(''), [formError, setFormError] = useState('');
  const [failure, setFailure] = useState('');
  const [preview, setPreview] = useState<BulkPriceResult | null>(null), [applied, setApplied] = useState<BulkPriceResult | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const pending = pendingAction !== null;

  const reasonText = (reason: string) => {
    const key = 'merchant.bulkActions.price.reasons.' + reason;
    const value = t(key);
    return value === key ? reason : value;
  };
  const price = (value: number | null | undefined) => value === null || value === undefined ? '—' : value.toFixed(2);

  const validateValue = (mode: PriceMode, value: string) => {
    const trimmed = value.trim();
    if (!trimmed || !DECIMAL.test(trimmed)) return c('invalidValue');
    if (mode === 'percentage' && Number(trimmed) <= -100) return c('invalidPercentage');
    return '';
  };
  const buildRequest = (): BulkPriceRequest => {
    const request: BulkPriceRequest = { selection: target };
    const payload = (mode: PriceMode, value: string): BulkPriceMode => mode === 'amount' ? { mode: 'amount', value } : { mode: 'percentage', value };
    if (saleEnabled) request.salePrice = payload(saleMode, saleValue.trim());
    if (clearCompare) request.clearCompareAtPrice = true;
    else if (compareEnabled) request.compareAtPrice = payload(compareMode, compareValue.trim());
    return request;
  };
  const validate = () => {
    if (!saleEnabled && !compareEnabled && !clearCompare) { setFormError(c('chooseOne')); setSaleError(''); setCompareError(''); return false; }
    const nextSale = saleEnabled ? validateValue(saleMode, saleValue) : '';
    const nextCompare = compareEnabled && !clearCompare ? validateValue(compareMode, compareValue) : '';
    setSaleError(nextSale); setCompareError(nextCompare); setFormError('');
    return !nextSale && !nextCompare;
  };

  const previewChanges = async () => {
    if (!validate()) return;
    setPendingAction('preview'); setFailure(''); setApplied(null);
    try {
      const result = await productsApi.bulkPrices({ ...buildRequest(), dryRun: true });
      setPreview(result);
    } catch (error) { setFailure(resolveApiErrorMessage(error, t)); } finally { setPendingAction(null); }
  };
  const applyChanges = async () => {
    if (!validate()) return;
    setPendingAction('apply'); setFailure('');
    try {
      const result = await productsApi.bulkPrices(buildRequest());
      setApplied(result); setPreview(null); onApplied(result);
    } catch (error) { setFailure(resolveApiErrorMessage(error, t)); } finally { setPendingAction(null); }
  };

  return <Dialog open onOpenChange={next => { if (!next && !pending) onClose(); }}>
    <DialogContent closeLabel={c('cancel')} className="max-h-[90dvh] w-[calc(100%_-_32px)] max-w-[520px] overflow-y-auto">
      <DialogHeader><DialogTitle>{c('title')}</DialogTitle><DialogDescription>{c('description')}</DialogDescription></DialogHeader>

      <fieldset className="space-y-2 rounded-md border border-border p-3">
        <legend className="px-1 text-[13px] font-medium">{c('salePrice')}</legend>
        <label className="flex items-center gap-2 text-[13px]">
          <input type="checkbox" aria-label={c('changeSalePrice')} checked={saleEnabled} onChange={event => setSaleEnabled(event.target.checked)} />
          {c('changeSalePrice')}
        </label>
        {saleEnabled && <>
          <label className="flex items-center gap-2 text-[13px]">
            <input type="radio" name="bulk-sale-price-mode" aria-label={c('saleAmount')} checked={saleMode === 'amount'} onChange={() => setSaleMode('amount')} />
            {c('setAmount')}
          </label>
          <label className="flex items-center gap-2 text-[13px]">
            <input type="radio" name="bulk-sale-price-mode" aria-label={c('salePercentage')} checked={saleMode === 'percentage'} onChange={() => setSaleMode('percentage')} />
            {c('changePercentage')}
          </label>
          <label className="block space-y-1 text-xs text-muted-foreground">
            {c('value')}
            <Input aria-label={c('saleValue')} placeholder={c('value')} value={saleValue} onChange={event => setSaleValue(event.target.value)} />
          </label>
          <p className="text-xs text-faint">{saleMode === 'percentage' ? c('percentageHint') : c('amountHint')}</p>
          {saleError && <p role="alert" className="text-xs text-destructive">{saleError}</p>}
        </>}
      </fieldset>

      <fieldset className="space-y-2 rounded-md border border-border p-3">
        <legend className="px-1 text-[13px] font-medium">{c('compareAtPrice')}</legend>
        <label className="flex items-center gap-2 text-[13px]">
          <input type="checkbox" aria-label={c('changeCompareAtPrice')} checked={compareEnabled && !clearCompare}
            onChange={event => { setCompareEnabled(event.target.checked); if (event.target.checked) setClearCompare(false); }} />
          {c('changeCompareAtPrice')}
        </label>
        <label className="flex items-center gap-2 text-[13px]">
          <input type="checkbox" aria-label={c('clearCompareAtPrice')} checked={clearCompare}
            onChange={event => { setClearCompare(event.target.checked); if (event.target.checked) setCompareEnabled(false); }} />
          {c('clearCompareAtPrice')}
        </label>
        {compareEnabled && !clearCompare && <>
          <label className="flex items-center gap-2 text-[13px]">
            <input type="radio" name="bulk-compare-price-mode" aria-label={c('compareAmount')} checked={compareMode === 'amount'} onChange={() => setCompareMode('amount')} />
            {c('setAmount')}
          </label>
          <label className="flex items-center gap-2 text-[13px]">
            <input type="radio" name="bulk-compare-price-mode" aria-label={c('comparePercentage')} checked={compareMode === 'percentage'} onChange={() => setCompareMode('percentage')} />
            {c('changePercentage')}
          </label>
          <label className="block space-y-1 text-xs text-muted-foreground">
            {c('value')}
            <Input aria-label={c('compareValue')} placeholder={c('value')} value={compareValue} onChange={event => setCompareValue(event.target.value)} />
          </label>
          <p className="text-xs text-faint">{compareMode === 'percentage' ? c('percentageHint') : c('amountHint')}</p>
          {compareError && <p role="alert" className="text-xs text-destructive">{compareError}</p>}
        </>}
      </fieldset>

      {formError && <p role="alert" className="text-[13px] text-destructive">{formError}</p>}
      {failure && <p role="alert" className="text-[13px] text-destructive">{failure}</p>}

      {preview && <section aria-label={c('previewTitle')} className="space-y-2 rounded-md border border-border bg-raised p-3 text-[13px]">
        <h3 className="font-medium">{c('previewTitle')}</h3>
        <p>{c('previewSummary', { products: preview.matched, variants: preview.variantsProcessed + preview.variantsSkippedCount })}</p>
        <p>{c('productsChanged', { count: preview.processed })}</p>
        <p>{c('variantsChanged', { count: preview.variantsProcessed })}</p>
        {!!preview.skippedCount && <p>{c('productsSkipped', { count: preview.skippedCount })}</p>}
        {!!preview.variantsSkippedCount && <p>{c('variantsSkipped', { count: preview.variantsSkippedCount })}</p>}
        {!preview.processed && !preview.variantsProcessed && <p>{c('noChanges')}</p>}
        {!!preview.changes.length && <div className="space-y-1">
          <p className="font-medium">{c('changesHeading')}</p>
          <ul className="space-y-1">
            {preview.changes.map(change => <li key={change.variantId} className="flex flex-wrap items-baseline gap-x-2 text-xs">
              <span className="font-medium">{change.productName}</span>
              <span className="text-faint">{c('previousPrice')}: {price(change.previousSalePrice)}</span>
              <span aria-hidden="true">→</span>
              <span>{c('newPrice')}: {price(change.salePrice)}</span>
              {change.previousCompareAtPrice !== change.compareAtPrice && <span className="text-faint">{c('previousPrice')}: {price(change.previousCompareAtPrice)} → {c('newPrice')}: {price(change.compareAtPrice)}</span>}
            </li>)}
          </ul>
        </div>}
        {!!preview.variantsSkipped.length && <div className="space-y-1">
          <p className="font-medium">{c('skippedHeading')}</p>
          <ul className="space-y-1">
            {preview.variantsSkipped.map(skipped => <li key={skipped.variantId} className="text-xs">
              <span className="font-medium">{skipped.productName}</span>
              <span className="text-faint"> — {reasonText(skipped.reason)}</span>
            </li>)}
          </ul>
        </div>}
      </section>}

      {applied && <section aria-label={c('appliedTitle')} className="space-y-1 rounded-md border border-border bg-raised p-3 text-[13px]">
        <h3 className="font-medium">{c('appliedTitle')}</h3>
        <p>{c('appliedSummary', { products: applied.processed, variants: applied.variantsProcessed, skipped: applied.skippedCount + applied.variantsSkippedCount })}</p>
      </section>}

      <DialogFooter>
        <Button type="button" variant="outline" disabled={pending} onClick={onClose}>{c('cancel')}</Button>
        <Button type="button" variant="outline" disabled={pending} onClick={previewChanges}>{pendingAction === 'preview' ? c('previewing') : c('preview')}</Button>
        <Button type="button" disabled={pending || !preview} onClick={applyChanges}>{pendingAction === 'apply' ? c('applying') : c('apply')}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
