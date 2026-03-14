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
import { useT } from 'shared/src/i18n/react'
import { useShipOrder } from '@/lib/hooks/use-api'
import { toast } from 'sonner'

interface ShipOrderDialogProps {
    order: any
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess?: () => void
}

export function ShipOrderDialog({ order, open, onOpenChange, onSuccess }: ShipOrderDialogProps) {
    const t = useT()
    const shipOrderMutation = useShipOrder()
    const [carrier, setCarrier] = useState('')
    const [trackingNumber, setTrackingNumber] = useState('')

    const getText = (key: string, fallback: string): string => {
        if (!t) return fallback
        const translated = t(key)
        return translated === key ? fallback : translated
    }

    const handleShip = async () => {
        if (!carrier || !trackingNumber) {
            toast.error(getText('merchant.orders.ship.errorEmpty', 'Please fill in both carrier and tracking number'))
            return
        }

        try {
            await shipOrderMutation.mutateAsync({
                id: order.id,
                data: {
                    carrier,
                    trackingNumber,
                    items: order.items?.map((item: any) => ({
                        orderItemId: item.id,
                        quantity: item.quantity
                    }))
                }
            })

            onOpenChange(false)
            if (onSuccess) onSuccess()
        } catch (error: any) {
            console.error('Ship order error:', error)
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
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={shipOrderMutation.isPending}>
                        {getText('common.actions.cancel', 'Cancel')}
                    </Button>
                    <Button onClick={handleShip} disabled={shipOrderMutation.isPending} className="bg-blue-600 hover:bg-blue-700">
                        {shipOrderMutation.isPending ? getText('common.actions.processing', 'Processing...') : getText('merchant.orders.ship.confirm', 'Confirm Shipment')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
