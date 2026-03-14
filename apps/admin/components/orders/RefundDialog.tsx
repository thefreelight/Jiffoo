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
}

export function RefundDialog({ order, open, onOpenChange, onSuccess }: RefundDialogProps) {
  const t = useT()
  const [reason, setReason] = useState('')
  const refundOrderMutation = useRefundOrder()

  const handleRefund = async () => {
    try {
      await refundOrderMutation.mutateAsync({
        id: order.id,
        data: {
          reason,
          idempotencyKey: `refund-${order.id}-${Date.now()}`,
        },
      })
      onOpenChange(false)
      setReason('')
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
      <DialogContent className="sm:max-w-[500px] bg-white rounded-[2rem] border border-gray-100 p-0 overflow-hidden">
        <DialogHeader className="p-8 pb-6 border-b border-gray-50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center">
              <RotateCcw className="w-6 h-6 text-red-600" />
            </div>
            <div className="space-y-1">
              <DialogTitle className="text-xl font-black text-gray-900 uppercase tracking-tight">
                {getText('merchant.orders.refund.title', 'Refund Order')}
              </DialogTitle>
              <DialogDescription className="text-xs font-medium text-gray-400 uppercase tracking-widest">
                {getText('merchant.orders.refund.description', 'This action will refund the full amount to the customer.')}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 p-8">
          <div className="flex items-start gap-3 p-4 bg-blue-50 text-blue-800 rounded-2xl text-sm border border-blue-100">
            <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <p className="text-xs font-bold uppercase tracking-wide">
              {getText('merchant.orders.refund.alphaNotice', 'Alpha version only supports full refund.')}
            </p>
          </div>

          <div className="space-y-3">
            <Label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
              {getText('merchant.orders.refund.amount', 'Refund Amount')}
            </Label>
            <Input
              value={formatCurrency(order.totalAmount, order.currency)}
              disabled
              className="h-14 bg-gray-50 border-gray-100 rounded-xl font-black text-lg text-gray-900 px-6"
            />
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest px-1">
              {getText('merchant.orders.refund.fullAmountOnly', 'Automatic full refund of order total.')}
            </p>
          </div>

          <div className="space-y-3">
            <Label htmlFor="reason" className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
              {getText('merchant.orders.refund.reason', 'Reason (Optional)')}
            </Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={getText('merchant.orders.refund.reasonPlaceholder', 'Enter refund reason...')}
              rows={4}
              className="border-gray-100 rounded-xl p-4 leading-relaxed text-sm font-medium text-gray-700 bg-gray-50/50 resize-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all"
            />
          </div>

          <div className="flex items-start gap-3 p-4 bg-yellow-50 text-yellow-800 rounded-2xl text-sm border border-yellow-100">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <p className="text-xs font-bold uppercase tracking-wide">
              {getText('merchant.orders.refund.warning', 'This action cannot be undone.')}
            </p>
          </div>
        </div>

        <DialogFooter className="p-8 pt-6 border-t border-gray-50 flex-row gap-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1 h-12 rounded-xl border-gray-100 text-gray-600 hover:bg-gray-50 font-bold text-sm uppercase tracking-widest transition-all"
          >
            {getText('common.actions.cancel', 'Cancel')}
          </Button>
          <Button
            onClick={handleRefund}
            disabled={refundOrderMutation.isPending}
            className="flex-1 h-12 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black text-sm uppercase tracking-widest shadow-lg shadow-red-500/20 transition-all active:scale-95"
          >
            {refundOrderMutation.isPending
              ? getText('common.actions.processing', 'Processing...')
              : getText('merchant.orders.refund.confirm', 'Refund {amount}').replace(
                  '{amount}',
                  formatCurrency(order.totalAmount, order.currency)
                )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
