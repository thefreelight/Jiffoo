'use client';
import { useState } from 'react';
import { useT } from 'shared/src/i18n/react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { resolveApiErrorMessage } from '@/lib/error-utils';
import { Textarea } from '@/components/ui/textarea';
import { useCancelOrder } from '@/lib/hooks/use-api';
export function CancelOrderDialog({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const t = useT(), text = (key: string) => t('merchant.orders.detailView.' + key);
  const mutation = useCancelOrder();
  const [value, setValue] = useState(''), [error, setError] = useState<unknown>(null);
  const confirm = async () => {
    setError(null);
    try { await mutation.mutateAsync({ id: orderId, cancelReason: value.trim() }); onClose(); }
    catch (failure) { setError(failure); }
  };
  return <Dialog open onOpenChange={open => { if (!open && !mutation.isPending) onClose(); }}>
    <DialogContent className="w-[calc(100vw-2rem)] max-w-[440px] max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-[10px] border-border bg-background p-5 text-foreground shadow-none [&>button]:hidden"><DialogHeader><DialogTitle>{text('cancelOrder')}</DialogTitle><DialogDescription>{text('cancelDescription')}</DialogDescription></DialogHeader>
      <Label htmlFor="cancelReason">{text('cancellationReason')}</Label><Textarea id="cancelReason" value={value} onChange={event => setValue(event.target.value)} required rows={3} disabled={mutation.isPending} />
      {error != null && <p role="alert" className="text-destructive">{resolveApiErrorMessage(error, t)}</p>}
      <DialogFooter className="gap-2"><Button variant="outline" disabled={mutation.isPending} onClick={onClose}>{text('keepOrder')}</Button><Button variant="destructive" disabled={mutation.isPending || !value.trim()} onClick={confirm}>{text('cancelOrder')}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
