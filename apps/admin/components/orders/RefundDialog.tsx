import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useT } from 'shared/src/i18n/react'
import { useRefundOrder } from '@/lib/hooks/use-api'
import { AdminOrderDetailDTO } from 'shared'
import { AlertTriangle, Info, RotateCcw } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface RefundDialogProps {
  order: AdminOrderDetailDTO
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  payment?: { paymentId: string; amount: number; currency: string }
}

export function RefundDialog({ order, open, onOpenChange, onSuccess, payment }: RefundDialogProps) {
  const t = useT()
  const [reason, setReason] = useState('')
  const [reference, setReference] = useState('')
  const [requestKey] = useState(() => crypto.randomUUID())
  const refundOrderMutation = useRefundOrder()

  const handleRefund = async () => {
    try {
      await refundOrderMutation.mutateAsync({
        id: order.id,
        paymentId: payment?.paymentId,
        data: {
          reason,
          idempotencyKey: requestKey,
          reference: reference.trim(),
        },
      })
      onOpenChange(false)
      setReason('')
      setReference('')
      onSuccess?.()
    } catch (_error) {
      // Error toast is already handled by the mutation hook.
    }
  }

  const getText = (key: string, fallback: string): string => {
    if (!t) return fallback
    const translated = t(key)
    return translated === key ? fallback : translated
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[calc(100dvh-2rem)] overflow-y-auto bg-surface rounded-[2rem] border border-neutral-faint p-0">
        <DialogHeader className="p-8 pb-6 border-b border-neutral-veil">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-danger-veil rounded-2xl flex items-center justify-center">
              <RotateCcw className="w-6 h-6 text-danger-strong" />
            </div>
            <div className="space-y-1">
              <DialogTitle className="text-xl font-black text-neutral-deepest uppercase tracking-tight">
                {getText('merchant.orders.refund.title', 'Record offline full refund')}
              </DialogTitle>
              <DialogDescription className="text-xs font-medium text-neutral-light uppercase tracking-widest">
                {getText('merchant.orders.refund.description', 'Record a full refund already paid outside this system.')}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 p-8">
          <div className="flex items-start gap-3 p-4 bg-action-veil text-action-dark rounded-2xl text-sm border border-action-faint">
            <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <p className="text-xs font-bold uppercase tracking-wide">
              {getText('merchant.orders.refund.alphaNotice', 'Only a full refund can be recorded.')}
            </p>
          </div>

          <div className="space-y-3">
            <Label htmlFor="refund-amount" className="text-[10px] font-black text-neutral-light uppercase tracking-[0.2em]">
              {getText('merchant.orders.refund.amount', 'Refund Amount')}
            </Label>
            <Input
              id="refund-amount"
              value={formatCurrency(payment?.amount ?? order.totalAmount, payment?.currency ?? order.currency)}
              disabled
              className="h-14 bg-neutral-veil border-neutral-faint rounded-xl font-black text-lg text-neutral-deepest px-6"
            />
            <p className="text-[10px] text-neutral-light font-bold uppercase tracking-widest px-1">
              {getText('merchant.orders.refund.fullAmountOnly', 'Enter the reference for the completed offline refund.')}
            </p>
          </div>

          <div className="space-y-3">
            <Label htmlFor="refund-reference">{getText('merchant.orders.refund.reference', 'Refund reference')}</Label>
            <Input id="refund-reference" value={reference} onChange={event => setReference(event.target.value)} required maxLength={256} />
          </div>
          <div className="space-y-3">
            <Label htmlFor="reason" className="text-[10px] font-black text-neutral-light uppercase tracking-[0.2em]">
              {getText('merchant.orders.refund.reason', 'Reason (Optional)')}
            </Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={getText('merchant.orders.refund.reasonPlaceholder', 'Enter refund reason...')}
              rows={4}
              className="border-neutral-faint rounded-xl p-4 leading-relaxed text-sm font-medium text-neutral-deep bg-neutral-veil/50 resize-none focus:border-action-base focus:ring-2 focus:ring-action-base/10 transition-all"
            />
          </div>

          <div className="flex items-start gap-3 p-4 bg-warning-veil text-warning-dark rounded-2xl text-sm border border-warning-faint">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <p className="text-xs font-bold uppercase tracking-wide">
              {getText('merchant.orders.refund.warning', 'This action cannot be undone.')}
            </p>
          </div>
        </div>

        <DialogFooter className="p-8 pt-6 border-t border-neutral-veil flex-row gap-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1 h-12 rounded-xl border-neutral-faint text-neutral-strong hover:bg-neutral-veil font-bold text-sm uppercase tracking-widest transition-all"
          >
            {getText('common.actions.cancel', 'Cancel')}
          </Button>
          <Button
            onClick={handleRefund}
            disabled={refundOrderMutation.isPending || !reference.trim()}
            className="flex-1 h-12 bg-danger-strong hover:bg-danger-deep text-surface rounded-xl font-black text-sm uppercase tracking-widest shadow-lg shadow-danger-base/20 transition-all active:scale-95"
          >
            {refundOrderMutation.isPending
              ? getText('common.actions.processing', 'Processing...')
              : getText('merchant.orders.refund.confirm', 'Record refund {amount}').replace(
                  '{amount}',
                  formatCurrency(payment?.amount ?? order.totalAmount, payment?.currency ?? order.currency)
                )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
