'use client';
import { useState } from 'react';
import { useT } from 'shared/src/i18n/react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { resolveApiErrorMessage } from '@/lib/error-utils';

import { useShipOrder } from '@/lib/hooks/use-api';
interface ShipOrderDialogProps { order: any; open: boolean; onOpenChange: (open: boolean) => void; onSuccess?: () => void }
export function ShipOrderDialog({ order, open, onOpenChange, onSuccess }: ShipOrderDialogProps) {
  const t = useT(), text = (key: string) => t('merchant.orders.detailView.' + key);
  const mutation = useShipOrder();
  const [carrier, setCarrier] = useState(''), [trackingNumber, setTrackingNumber] = useState('');
  const [error, setError] = useState<unknown>(null), [missing, setMissing] = useState(false);
  const ship = async () => {
    setError(null); setMissing(false);
    if (!carrier || !trackingNumber) { setMissing(true); return; }
    try {
      await mutation.mutateAsync({ id: order.id, data: { carrier, trackingNumber, items: order.items?.map((item: any) => ({ orderItemId: item.id, quantity: item.quantity })) } });
      onOpenChange(false); onSuccess?.();
    } catch (failure) { setError(failure); }
  };
  return <Dialog open={open} onOpenChange={value => { if (!mutation.isPending) onOpenChange(value); }}>
    <DialogContent className="w-[calc(100vw-2rem)] max-w-[440px] max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-[10px] border-border bg-background p-5 text-foreground shadow-none [&>button]:hidden"><DialogHeader><DialogTitle>{text('shipOrder')}</DialogTitle><DialogDescription>{text('shipDescription')}</DialogDescription></DialogHeader>
      <div className="space-y-2"><Label htmlFor="carrier">{text('carrier')}</Label><Input id="carrier" value={carrier} onChange={event => setCarrier(event.target.value)} disabled={mutation.isPending} /></div>
      <div className="space-y-2"><Label htmlFor="trackingNumber">{text('trackingNumber')}</Label><Input id="trackingNumber" value={trackingNumber} onChange={event => setTrackingNumber(event.target.value)} disabled={mutation.isPending} /></div>
      {missing && <p role="alert" className="text-destructive">{text('shippingRequired')}</p>}{error != null && <p role="alert" className="text-destructive">{resolveApiErrorMessage(error, t)}</p>}
      <DialogFooter className="gap-2"><Button variant="outline" disabled={mutation.isPending} onClick={() => onOpenChange(false)}>{text('dismiss')}</Button><Button disabled={mutation.isPending} onClick={ship}>{text('shipOrder')}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
