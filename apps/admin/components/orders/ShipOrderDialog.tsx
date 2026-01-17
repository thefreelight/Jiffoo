'use client'

import { useState } from 'react'
import { Truck } from 'lucide-react'
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
import { ordersApi } from '@/lib/api'
import { useT } from 'shared/src/i18n/react'
import { toast } from 'sonner'

interface ShipOrderDialogProps {
    order: any
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess?: () => void
}

export function ShipOrderDialog({ order, open, onOpenChange, onSuccess }: ShipOrderDialogProps) {
    const t = useT()
    const [loading, setLoading] = useState(false)
    const [carrier, setCarrier] = useState('')
    const [trackingNumber, setTrackingNumber] = useState('')

    const getText = (key: string, fallback: string): string => {
        return t ? t(key) : fallback
    }

    const handleShip = async () => {
        if (!carrier || !trackingNumber) {
            toast.error(getText('merchant.orders.ship.errorEmpty', 'Please fill in both carrier and tracking number'))
            return
        }

        setLoading(true)
        try {
            const response = await ordersApi.shipOrder(order.id, {
                carrier,
                trackingNumber,
                items: order.items?.map((item: any) => ({
                    orderItemId: item.id,
                    quantity: item.quantity
                }))
            })

            if (response.success) {
                toast.success(getText('merchant.orders.ship.success', 'Order shipped successfully'))
                onOpenChange(false)
                if (onSuccess) onSuccess()
            } else {
                toast.error(response.error || getText('merchant.orders.ship.failed', 'Failed to ship order'))
            }
        } catch (error: any) {
            console.error('Ship order error:', error)
            toast.error(error.message || getText('merchant.orders.ship.failed', 'Failed to ship order'))
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Truck className="w-5 h-5 text-blue-600" />
                        {getText('merchant.orders.ship.title', 'Ship Order')}
                    </DialogTitle>
                    <DialogDescription>
                        {getText('merchant.orders.ship.description', 'Enter shipping details to mark this order as shipped.')}
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="carrier">{getText('merchant.orders.ship.carrier', 'Shipping Carrier')}</Label>
                        <Input
                            id="carrier"
                            placeholder="e.g. FedEx, UPS, SF Express"
                            value={carrier}
                            onChange={(e) => setCarrier(e.target.value)}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="trackingNumber">{getText('merchant.orders.ship.trackingNumber', 'Tracking Number')}</Label>
                        <Input
                            id="trackingNumber"
                            placeholder="Enter tracking number"
                            value={trackingNumber}
                            onChange={(e) => setTrackingNumber(e.target.value)}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                        {getText('common.actions.cancel', 'Cancel')}
                    </Button>
                    <Button onClick={handleShip} disabled={loading} className="bg-blue-600 hover:bg-blue-700">
                        {loading ? getText('common.actions.processing', 'Processing...') : getText('merchant.orders.ship.confirm', 'Confirm Shipment')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
