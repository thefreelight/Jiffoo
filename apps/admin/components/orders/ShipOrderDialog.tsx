'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ScanSearch, Truck } from 'lucide-react'
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
import { shipFormApi } from '@/lib/api'
import { useShipOrder } from '@/lib/hooks/use-api'
import type { ShipFormCarrier, ShipFormOptions } from '@/lib/types'
import { toast } from 'sonner'

interface ShipOrderDialogProps {
    order: any
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess?: () => void
}

interface ResolvedCarrier {
    code: string
    name: string
}

function carrierDisplayName(entry: { name: string; nameZh: string }): string {
    return entry.nameZh && entry.nameZh !== entry.name ? `${entry.name} / ${entry.nameZh}` : entry.name
}

/**
 * Resolve a typed/picked carrier label against the plugin carrier
 * catalog so the ship payload can carry a structured carrierCode.
 */
function resolveCarrierLabel(label: string, carriers: ShipFormCarrier[]): ResolvedCarrier | null {
    const normalized = label.trim().toLowerCase()
    if (!normalized) return null
    const match = carriers.find((entry) => (
        entry.code.toLowerCase() === normalized
        || entry.name.toLowerCase() === normalized
        || entry.nameZh === label.trim()
        || (entry.aliases ?? []).some((alias) => alias.toLowerCase() === normalized)
    ))
    return match ? { code: match.code, name: match.name } : null
}

export function ShipOrderDialog({ order, open, onOpenChange, onSuccess }: ShipOrderDialogProps) {
    const t = useT()
    const shipOrderMutation = useShipOrder()
    const [carrier, setCarrier] = useState('')
    const [trackingNumber, setTrackingNumber] = useState('')
    const [shipForm, setShipForm] = useState<ShipFormOptions | null>(null)
    const [pickerOpen, setPickerOpen] = useState(false)
    const [selected, setSelected] = useState<ResolvedCarrier | null>(null)
    const [detected, setDetected] = useState<ResolvedCarrier | null>(null)
    const detectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
    // Once the operator types or picks a carrier deliberately, tracking
    // auto-detection no longer overwrites their choice.
    const carrierTouched = useRef(false)

    const getText = (key: string, fallback: string): string => {
        if (!t) return fallback
        const translated = t(key)
        return translated === key ? fallback : translated
    }

    // The carrier picker and auto-detection live in the official shipping
    // plugin; without it the dialog keeps the plain free-text form.
    useEffect(() => {
        if (!open) {
            setShipForm(null)
            setPickerOpen(false)
            setDetected(null)
            setSelected(null)
            carrierTouched.current = false
            return
        }
        let active = true
        shipFormApi.getShipForm()
            .then((response) => {
                const form = (response as any)?.data ?? null
                if (active && form?.available && Array.isArray(form.carriers) && form.carriers.length > 0) {
                    setShipForm(form as ShipFormOptions)
                }
            })
            .catch(() => undefined)
        return () => {
            active = false
        }
    }, [open])

    // Auto-detect the carrier whenever the tracking number stabilizes.
    useEffect(() => {
        if (!shipForm) return
        if (detectTimer.current) clearTimeout(detectTimer.current)
        if (!trackingNumber.trim()) {
            setDetected(null)
            return
        }
        detectTimer.current = setTimeout(() => {
            shipFormApi.detectCarrier(trackingNumber)
                .then((response) => {
                    const top = (response as any)?.data?.candidates?.[0]
                    if (!top?.code) return
                    const next = { code: top.code as string, name: carrierDisplayName(top) }
                    setDetected(next)
                    setSelected(next)
                    if (!carrierTouched.current) setCarrier(next.name)
                })
                .catch(() => undefined)
        }, 400)
        return () => {
            if (detectTimer.current) clearTimeout(detectTimer.current)
        }
    }, [trackingNumber, shipForm])

    const carrierCatalog = useMemo(() => shipForm?.carriers ?? [], [shipForm])
    const filteredCarriers = useMemo(() => {
        const query = carrier.trim().toLowerCase()
        if (!query) return carrierCatalog
        return carrierCatalog.filter((entry) => (
            entry.name.toLowerCase().includes(query)
            || entry.nameZh.includes(carrier.trim())
            || (entry.aliases ?? []).some((alias) => alias.toLowerCase().includes(query))
        ))
    }, [carrierCatalog, carrier])

    // The selected code stays authoritative while the text still shows the
    // picked/detected label; once the operator edits the text it must be
    // re-resolved from what they typed.
    const resolvedCarrier = useMemo(() => {
        if (selected && carrier.trim() === selected.name) return selected
        return resolveCarrierLabel(carrier, carrierCatalog)
    }, [selected, carrier, carrierCatalog])
    const selectedTemplate = carrierCatalog.find((entry) => entry.code === resolvedCarrier?.code)?.trackingUrlTemplate ?? null

    const pickCarrier = (entry: ShipFormCarrier) => {
        const next = { code: entry.code, name: carrierDisplayName(entry) }
        setCarrier(next.name)
        setSelected(next)
        setDetected(null)
        carrierTouched.current = true
        setPickerOpen(false)
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
                    ...(resolvedCarrier?.code ? { carrierCode: resolvedCarrier.code } : {}),
                    trackingNumber,
                    ...(selectedTemplate ? { trackingUrl: selectedTemplate.replace('{trackingNumber}', encodeURIComponent(trackingNumber.trim().toUpperCase())) } : {}),
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
                        <div className="relative">
                            <Input
                                id="carrier"
                                placeholder="e.g. FedEx, UPS, SF Express"
                                value={carrier}
                                onChange={(e) => {
                                    setCarrier(e.target.value)
                                    setSelected(null)
                                    setDetected(null)
                                    carrierTouched.current = Boolean(e.target.value.trim())
                                    setPickerOpen(true)
                                }}
                                autoComplete="off"
                            />
                            {carrierCatalog.length > 0 ? (
                                <button
                                    type="button"
                                    aria-label={getText('merchant.orders.ship.pickCarrier', 'Pick a carrier')}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                                    onClick={() => setPickerOpen((prev) => !prev)}
                                >
                                    <ChevronDown className="h-4 w-4" />
                                </button>
                            ) : null}
                            {pickerOpen && carrierCatalog.length > 0 ? (
                                <div className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg">
                                    {filteredCarriers.length === 0 ? (
                                        <p className="px-3 py-2 text-xs text-gray-400">
                                            {getText('merchant.orders.ship.noCarrierMatch', 'No matching carrier — keep typing or use a custom name')}
                                        </p>
                                    ) : filteredCarriers.map((entry) => (
                                        <button
                                            key={entry.code}
                                            type="button"
                                            className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-blue-50"
                                            onClick={() => pickCarrier(entry)}
                                        >
                                            <span className="font-medium text-gray-900">{carrierDisplayName(entry)}</span>
                                            {entry.code === resolvedCarrier?.code ? (
                                                <span className="text-[10px] font-bold uppercase text-blue-600">
                                                    {getText('merchant.orders.ship.selected', 'Selected')}
                                                </span>
                                            ) : null}
                                        </button>
                                    ))}
                                </div>
                            ) : null}
                        </div>
                        {carrierCatalog.length > 0 ? (
                            <p className="text-xs text-gray-400">
                                {getText('merchant.orders.ship.pickHint', 'Pick a carrier from the dropdown or type a custom name.')}
                            </p>
                        ) : null}
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="trackingNumber">{getText('merchant.orders.ship.trackingNumber', 'Tracking Number')}</Label>
                        <Input
                            id="trackingNumber"
                            placeholder="Enter tracking number"
                            value={trackingNumber}
                            onChange={(e) => setTrackingNumber(e.target.value)}
                            autoComplete="off"
                        />
                        {detected ? (
                            <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                                <ScanSearch className="h-3.5 w-3.5" />
                                {getText('merchant.orders.ship.detected', 'Detected carrier')}: {detected.name}
                            </p>
                        ) : null}
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
