'use client';
import { useState } from 'react';
import { useT } from 'shared/src/i18n/react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { resolveApiErrorMessage } from '@/lib/error-utils';

import { Textarea } from '@/components/ui/textarea';
import { useRefundOrder } from '@/lib/hooks/use-api';
import type { AdminOrderDetailDTO } from 'shared';
import { formatCurrency } from '@/lib/utils';
interface RefundDialogProps { order: AdminOrderDetailDTO; open: boolean; onOpenChange: (open: boolean) => void; onSuccess?: () => void; payment?: { paymentId: string; providerPaymentId: string; amount: number; currency: string } }
export function RefundDialog({ order, open, onOpenChange, onSuccess, payment }: RefundDialogProps) {
  const t = useT(), text = (key: string, values?: Record<string, string | number>) => t('merchant.orders.detailView.' + key, values);
  const mutation = useRefundOrder();
  const [reason, setReason] = useState(''), [reference, setReference] = useState('');
  const [requestKey] = useState(() => crypto.randomUUID()), [error, setError] = useState<unknown>(null);
  const amount = formatCurrency(payment?.amount ?? order.totalAmount, payment?.currency ?? order.currency);
  const refund = async () => {
    setError(null);
    try {
      await mutation.mutateAsync({ id: order.id, paymentId: payment?.paymentId, providerPaymentId: payment?.providerPaymentId, data: { reason, idempotencyKey: requestKey, reference: reference.trim() } });
      onOpenChange(false); setReason(''); setReference(''); onSuccess?.();
    } catch (failure) { setError(failure); }
  };
  return <Dialog open={open} onOpenChange={value => { if (!mutation.isPending) onOpenChange(value); }}>
    <DialogContent className="w-[calc(100vw-2rem)] max-w-[440px] max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-[10px] border-border bg-background p-5 text-foreground shadow-none [&>button]:hidden"><DialogHeader><DialogTitle>{text('refundTitle')}</DialogTitle><DialogDescription>{text('refundDescription')}</DialogDescription></DialogHeader>
      <div className="space-y-2"><Label htmlFor="refund-amount">{text('refundAmount')}</Label><Input id="refund-amount" value={amount} disabled className="font-mono" /></div>
      <div className="space-y-2"><Label htmlFor="refund-reference">{text('refundReference')}</Label><Input id="refund-reference" value={reference} onChange={event => setReference(event.target.value)} required maxLength={256} disabled={mutation.isPending} /></div>
      <div className="space-y-2"><Label htmlFor="reason">{text('refundReason')}</Label><Textarea id="reason" value={reason} onChange={event => setReason(event.target.value)} rows={3} disabled={mutation.isPending} /></div>
      <p className="text-xs text-muted-foreground">{text('refundWarning')}</p>{error != null && <p role="alert" className="text-destructive">{resolveApiErrorMessage(error, t)}</p>}
      <DialogFooter className="gap-2"><Button variant="outline" disabled={mutation.isPending} onClick={() => onOpenChange(false)}>{text('dismiss')}</Button><Button variant="destructive" disabled={mutation.isPending || !reference.trim()} onClick={refund}>{text('refundConfirm', { amount })}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
