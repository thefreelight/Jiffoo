'use client'

import { useState } from 'react'
import { useT } from 'shared/src/i18n/react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useResolvePaymentReview } from '@/lib/hooks/use-api'
import { resolveApiErrorMessage } from '@/lib/error-utils'

export function PaymentReviewDialog({ orderId, paymentId, outcome, onClose }: {
  orderId: string; paymentId: string; outcome: 'PAID' | 'NOT_CHARGED'; onClose: () => void
}) {
  const t = useT()
  const mutation = useResolvePaymentReview()
  const [reference, setReference] = useState('')
  const [error, setError] = useState<unknown>(null)
  const text = (key: string, fallback: string) => { const value = t?.(key); return value && value !== key ? value : fallback }
  const title = outcome === 'PAID'
    ? text('merchant.orders.review.confirmPaid', 'Confirm payment received')
    : text('merchant.orders.review.closeNotCharged', 'Confirm not charged and close')
  const confirm = async () => {
    setError(null)
    try {
      await mutation.mutateAsync({ id: orderId, paymentId, outcome, reference: reference.trim() })
      onClose()
    } catch (failure) { setError(failure) }
  }
  return <Dialog open onOpenChange={open => { if (!open && !mutation.isPending) onClose() }}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{outcome === 'PAID'
          ? text('merchant.orders.review.paidDescription', 'Enter the exact transaction or payment ID from the provider dashboard.')
          : text('merchant.orders.review.notChargedDescription', 'Confirm the provider did not charge this payment and enter the evidence reference.')}</DialogDescription>
      </DialogHeader>
      <Label htmlFor="payment-review-reference">{outcome === 'PAID'
        ? text('merchant.orders.review.providerPaymentId', 'Provider transaction or payment ID')
        : text('merchant.orders.review.evidenceReference', 'Evidence reference')}</Label>
      <Input id="payment-review-reference" value={reference} onChange={event => setReference(event.target.value)} required maxLength={256} disabled={mutation.isPending} />
      {error != null && <p role="alert">{resolveApiErrorMessage(error, t)}</p>}
      <DialogFooter>
        <Button variant="outline" disabled={mutation.isPending} onClick={onClose}>{text('common.actions.cancel', 'Cancel')}</Button>
        <Button disabled={mutation.isPending || !reference.trim()} onClick={confirm}>{title}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
}
