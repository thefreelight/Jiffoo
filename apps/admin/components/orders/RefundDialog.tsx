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
import { useRefundOrder, Order } from '@/lib/hooks/use-api'
import { AlertTriangle, Info } from 'lucide-react'

interface RefundDialogProps {
    order: Order
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function RefundDialog({ order, open, onOpenChange }: RefundDialogProps) {
    const t = useT()
    const [reason, setReason] = useState('')
    const refundOrderMutation = useRefundOrder()

    const handleRefund = async () => {
        try {
            await refundOrderMutation.mutateAsync({
                id: order.id,
                data: {
                    reason,
                    idempotencyKey: `refund-${order.id}-${Date.now()}`
                }
            })
            onOpenChange(false)
            setReason('')
        } catch (error) {
            console.error('Failed to refund order:', error)
        }
    }

    // Helper function for translations with fallback
    const getText = (key: string, fallback: string): string => {
        return t ? t(key) : fallback
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{getText('merchant.orders.refund.title', 'Refund Order')}</DialogTitle>
                    <DialogDescription>
                        {getText('merchant.orders.refund.description', 'This action will refund the full amount to the customer.')}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="flex items-center gap-2 p-3 bg-blue-50 text-blue-800 rounded-md text-sm border border-blue-200">
                        <Info className="w-4 h-4 flex-shrink-0" />
                        <p>
                            {getText('merchant.orders.refund.alphaNotice', 'Alpha version only supports full refund.')}
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label>{getText('merchant.orders.refund.amount', 'Refund Amount')}</Label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">¥</span>
                            <Input
                                value={order.totalAmount.toFixed(2)}
                                disabled
                                className="pl-7 bg-gray-50"
                            />
                        </div>
                        <p className="text-xs text-gray-500">
                            {getText('merchant.orders.refund.fullAmountOnly', 'Automatic full refund of order total.')}
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="reason">{getText('merchant.orders.refund.reason', 'Reason (Optional)')}</Label>
                        <Textarea
                            id="reason"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder={getText('merchant.orders.refund.reasonPlaceholder', 'Enter refund reason...')}
                            rows={3}
                        />
                    </div>

                    <div className="flex items-center gap-2 p-3 bg-yellow-50 text-yellow-800 rounded-md text-sm border border-yellow-200">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                        <p>
                            {getText('merchant.orders.refund.warning', 'This action cannot be undone.')}
                        </p>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        {getText('common.cancel', 'Cancel')}
                    </Button>
                    <Button
                        onClick={handleRefund}
                        disabled={refundOrderMutation.isPending}
                        className="bg-red-600 hover:bg-red-700 text-white"
                    >
                        {refundOrderMutation.isPending
                            ? getText('common.processing', 'Processing...')
                            : getText('merchant.orders.refund.confirm', 'Refund ¥{amount}').replace('{amount}', order.totalAmount.toFixed(2))
                        }
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
