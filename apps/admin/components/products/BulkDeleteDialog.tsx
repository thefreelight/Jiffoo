'use client';
import { useT } from 'shared/src/i18n/react';
import type { ProductBulkResult } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from '@/components/ui/alert-dialog';

export function BulkDeleteDialog({ result, pending, error, onCancel, onConfirm }: { result: ProductBulkResult | null; pending: boolean; error: string; onCancel: () => void; onConfirm: () => void }) {
  const t = useT(), c = (key: string, values?: Record<string, string | number>) => t('merchant.catalog.' + key, values);
  const names = result?.processedPreview.map(product => product.name).join('、') ?? '';
  const sold = result?.skipped.filter(product => product.reason === 'HAS_ORDERS') ?? [];
  const missing = result?.skipped.filter(product => product.reason === 'NOT_FOUND') ?? [];
  return <AlertDialog open={result !== null} onOpenChange={open => { if (!open && !pending) onCancel(); }}><AlertDialogContent overlayClassName="bg-overlay-ink/45" className="max-h-[90dvh] w-[calc(100%_-_32px)] max-w-[440px] overflow-y-auto rounded-lg p-5 sm:top-[160px] sm:max-h-[calc(100dvh_-_176px)] sm:translate-y-0"><AlertDialogHeader>
    <AlertDialogTitle>{c('deleteCountTitle', { count: result?.matched ?? 0 })}</AlertDialogTitle>
    <AlertDialogDescription asChild><div className="space-y-2 text-muted-foreground">
      {!!result?.processed && <p>{c('deleteProducts', { count: result.processed, names: result.processed > result.processedPreview.length ? c('namesMore', { names, count: result.processed }) : names })}</p>}
      {!!sold.length && <p className="rounded-md border border-border bg-raised px-3 py-2.5">{result?.processed === 0 && !missing.length ? c('deleteAllSkipped') : c('deleteSkipped', { names: sold.map(product => product.name || product.id).join('、') })}</p>}
      {!!missing.length && <p className="rounded-md border border-border bg-raised px-3 py-2.5">{c('deleteMissing', { names: missing.map(product => product.name || product.id).join('、') })}</p>}
    </div></AlertDialogDescription>
  </AlertDialogHeader>{error && <p role="alert" className="text-destructive">{error}</p>}<AlertDialogFooter>
    <AlertDialogCancel disabled={pending}>{c('cancel')}</AlertDialogCancel>
    {!!result?.processed && <Button variant="destructive" disabled={pending} onClick={onConfirm}>{c('deleteCount', { count: result.processed })}</Button>}
  </AlertDialogFooter></AlertDialogContent></AlertDialog>;
}
