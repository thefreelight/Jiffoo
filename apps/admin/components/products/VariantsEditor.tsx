'use client'

/**
 * Variants Editor - Industrial Matrix Reborn
 * Aligned with the high-impact product editor design.
 */

import { Plus, Trash2, CheckCircle2, Circle, DollarSign, ChevronDown, ChevronUp } from 'lucide-react'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { generateId } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { apiClient, unwrapApiResponse } from '@/lib/api'
import { toast } from 'sonner'

interface Variant {
    id?: string
    tempId?: string
    name: string
    salePrice: number
    costPrice?: number | null
    baseStock: number
    skuCode?: string
    isActive?: boolean
}

interface CurrencyPrice {
    id: string
    variantId: string
    currency: string
    price: number
    createdAt: string
    updatedAt: string
}

// Currency metadata
const CURRENCY_INFO: Record<string, { name: string; symbol: string }> = {
    USD: { name: 'US Dollar', symbol: '$' },
    EUR: { name: 'Euro', symbol: '€' },
    GBP: { name: 'British Pound', symbol: '£' },
    CAD: { name: 'Canadian Dollar', symbol: 'CA$' },
    AUD: { name: 'Australian Dollar', symbol: 'A$' },
    JPY: { name: 'Japanese Yen', symbol: '¥' },
    CNY: { name: 'Chinese Yuan', symbol: '¥' },
    INR: { name: 'Indian Rupee', symbol: '₹' },
}

interface VariantsEditorProps {
    variants: Variant[]
    onChange: (variants: Variant[]) => void
    productId?: string
}

export function VariantsEditor({ variants, onChange, productId }: VariantsEditorProps) {
    const [enabledCurrencies, setEnabledCurrencies] = useState<string[]>(['USD'])
    const [baseCurrency, setBaseCurrency] = useState<string>('USD')
    const [currencyPrices, setCurrencyPrices] = useState<Record<string, CurrencyPrice[]>>({})
    const [expandedVariants, setExpandedVariants] = useState<Record<string, boolean>>({})
    const [loadingPrices, setLoadingPrices] = useState<Record<string, boolean>>({})
    const [localPrices, setLocalPrices] = useState<Record<string, string>>({})

    // Load enabled currencies and base currency
    useEffect(() => {
        loadCurrencySettings()
    }, [])

    // Load currency prices for existing variants
    useEffect(() => {
        if (productId) {
            variants.forEach((variant) => {
                if (variant.id) {
                    loadCurrencyPrices(variant.id)
                }
            })
        }
    }, [productId, variants.map(v => v.id).join(',')])

    const loadCurrencySettings = async () => {
        try {
            const response = await apiClient.get('/admin/settings')
            const data = unwrapApiResponse(response)

            if (data.baseCurrency) {
                setBaseCurrency(data.baseCurrency)
            }
            if (data.enabledCurrencies && Array.isArray(data.enabledCurrencies)) {
                setEnabledCurrencies(data.enabledCurrencies)
            }
        } catch (err: any) {
            console.warn('Failed to load currency settings:', err)
        }
    }

    const loadCurrencyPrices = async (variantId: string) => {
        if (!productId || !variantId) return

        try {
            setLoadingPrices(prev => ({ ...prev, [variantId]: true }))
            const response = await apiClient.get(`/admin/products/${productId}/variants/${variantId}/prices`)
            const data = unwrapApiResponse(response)

            if (data.items && Array.isArray(data.items)) {
                setCurrencyPrices(prev => ({ ...prev, [variantId]: data.items }))
            }
        } catch (err: any) {
            console.warn('Failed to load currency prices:', err)
        } finally {
            setLoadingPrices(prev => ({ ...prev, [variantId]: false }))
        }
    }

    const saveCurrencyPrice = async (variantId: string, currency: string, price: number) => {
        if (!productId || !variantId) {
            toast.error('Save the product first before setting currency prices')
            return
        }

        try {
            const response = await apiClient.post(`/admin/products/${productId}/variants/${variantId}/prices`, {
                currency,
                price
            })
            unwrapApiResponse(response)

            toast.success(`${currency} price updated successfully`)

            // Reload currency prices
            await loadCurrencyPrices(variantId)
        } catch (err: any) {
            const errorMsg = err instanceof Error ? err.message : 'Unknown error'
            toast.error('Failed to save currency price: ' + errorMsg)
        }
    }

    const toggleVariantExpanded = (variantKey: string) => {
        setExpandedVariants(prev => ({ ...prev, [variantKey]: !prev[variantKey] }))
    }

    const getCurrencyPrice = (variantId: string, currency: string): CurrencyPrice | undefined => {
        const prices = currencyPrices[variantId] || []
        return prices.find(p => p.currency === currency)
    }
    const handleAddVariant = () => {
        const newVariant: Variant = {
            tempId: generateId(),
            name: '',
            salePrice: 0,
            baseStock: 0,
            skuCode: '',
            isActive: true,
        }
        onChange([...variants, newVariant])
    }

    const handleRemoveVariant = (index: number) => {
        if (variants.length <= 1) return
        onChange(variants.filter((_, i) => i !== index))
    }

    const handleUpdateVariant = (index: number, updates: Partial<Variant>) => {
        const newVariants = [...variants]
        newVariants[index] = { ...newVariants[index], ...updates }
        onChange(newVariants)
    }

    return (
        <div className="space-y-4 w-full">
            <div className="flex flex-col space-y-3">
                {variants.map((variant, index) => (
                    <div
                        key={variant.id || variant.tempId || index}
                        className="group relative bg-gray-50/50 border border-gray-100 rounded-xl p-4 transition-all hover:shadow-lg hover:shadow-blue-500/5 hover:border-blue-100 hover:bg-white"
                    >
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
                            {/* Identity */}
                            <div className="col-span-1 md:col-span-2 lg:col-span-3 space-y-2">
                                <Label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest pl-1">Variant Name</Label>
                                <Input
                                    value={variant.name}
                                    onChange={(e) => handleUpdateVariant(index, { name: e.target.value })}
                                    placeholder="e.g. Red / XL"
                                    className="h-10 text-sm font-bold border-gray-100 bg-white rounded-lg focus:ring-2 focus:ring-blue-500/10 focus:bg-white px-4 transition-all"
                                />
                            </div>

                            {/* SKU */}
                            <div className="col-span-1 md:col-span-1 lg:col-span-3 space-y-2">
                                <Label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest pl-1">SKU Reference</Label>
                                <Input
                                    value={variant.skuCode || ''}
                                    onChange={(e) => handleUpdateVariant(index, { skuCode: e.target.value })}
                                    className="h-10 font-mono text-xs font-bold border-gray-100 bg-white rounded-lg px-4 uppercase tracking-wider text-gray-500 focus:ring-2 focus:ring-blue-500/10 focus:bg-white transition-all"
                                    placeholder="SKU-REF"
                                />
                            </div>

                            {/* Price */}
                            <div className="col-span-1 md:col-span-1 lg:col-span-2 space-y-2">
                                <Label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest pl-1">Sale Price</Label>
                                <div className="relative group">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-gray-300 text-xs transition-colors group-focus-within:text-blue-500">$</span>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        value={variant.salePrice === 0 ? '' : variant.salePrice}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            handleUpdateVariant(index, { salePrice: val === '' ? 0 : parseFloat(val) || 0 })
                                        }}
                                        className="h-10 pl-9 pr-4 text-sm font-black border-gray-100 bg-white rounded-lg focus:ring-2 focus:ring-blue-500/10 focus:bg-white transition-all text-left"
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>

                            {/* Stock */}
                            <div className="col-span-1 md:col-span-1 lg:col-span-2 space-y-2">
                                <Label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest pl-1 block">Stock</Label>
                                <Input
                                    type="number"
                                    value={variant.baseStock === 0 ? '' : variant.baseStock}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        handleUpdateVariant(index, { baseStock: val === '' ? 0 : parseInt(val) || 0 })
                                    }}
                                    className="h-10 text-sm font-black border-gray-100 bg-white rounded-lg px-4 text-left focus:ring-2 focus:ring-blue-500/10 focus:bg-white transition-all"
                                    placeholder="0"
                                />
                            </div>

                            {/* Controls */}
                            <div className="col-span-1 md:col-span-1 lg:col-span-2 flex items-center justify-end space-x-2">
                                <button
                                    type="button"
                                    onClick={() => handleRemoveVariant(index)}
                                    disabled={variants.length <= 1}
                                    className="w-9 h-9 rounded-lg text-gray-300 border border-gray-100 bg-white hover:bg-red-50 hover:text-red-500 hover:border-red-100 transition-all disabled:opacity-0 flex items-center justify-center shrink-0"
                                    title="Remove Variant"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Currency-Specific Pricing Section */}
                        {variant.id && enabledCurrencies.length > 1 && (
                            <div className="mt-8 pt-8 border-t-2 border-gray-100">
                                <button
                                    type="button"
                                    onClick={() => toggleVariantExpanded(variant.id || variant.tempId || String(index))}
                                    className="flex items-center justify-between w-full mb-4 group"
                                >
                                    <div className="flex items-center gap-3">
                                        <DollarSign className="w-6 h-6 text-blue-500" />
                                        <h4 className="text-lg font-black text-gray-900 uppercase tracking-wide">
                                            Multi-Currency Pricing
                                        </h4>
                                        <Badge variant="outline" className="text-xs">
                                            {(currencyPrices[variant.id] || []).length} of {enabledCurrencies.length - 1} custom
                                        </Badge>
                                    </div>
                                    {expandedVariants[variant.id || variant.tempId || String(index)] ? (
                                        <ChevronUp className="w-6 h-6 text-gray-400 group-hover:text-gray-600" />
                                    ) : (
                                        <ChevronDown className="w-6 h-6 text-gray-400 group-hover:text-gray-600" />
                                    )}
                                </button>

                                {expandedVariants[variant.id || variant.tempId || String(index)] && (
                                    <div className="space-y-4 pl-9">
                                        <p className="text-sm text-gray-500 mb-6">
                                            Set custom prices for different currencies. Currencies without custom prices will use auto-converted rates.
                                        </p>
                                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                            {enabledCurrencies
                                                .filter(currency => currency !== baseCurrency)
                                                .map((currency) => {
                                                    const customPrice = getCurrencyPrice(variant.id!, currency)
                                                    const hasCustomPrice = !!customPrice
                                                    const priceKey = `${variant.id}-${currency}`
                                                    const localPrice = localPrices[priceKey] || customPrice?.price?.toString() || ''

                                                    return (
                                                        <div
                                                            key={currency}
                                                            className={cn(
                                                                "p-6 border-2 rounded-2xl transition-all",
                                                                hasCustomPrice
                                                                    ? "border-blue-300 bg-blue-50/50"
                                                                    : "border-gray-200 bg-white"
                                                            )}
                                                        >
                                                            <div className="flex items-center justify-between mb-4">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-lg font-bold">
                                                                        {CURRENCY_INFO[currency]?.symbol || currency}
                                                                    </div>
                                                                    <div>
                                                                        <div className="font-black text-gray-900">{currency}</div>
                                                                        <div className="text-xs text-gray-500">{CURRENCY_INFO[currency]?.name}</div>
                                                                    </div>
                                                                </div>
                                                                {hasCustomPrice && (
                                                                    <Badge className="bg-blue-600 text-white text-xs">Custom</Badge>
                                                                )}
                                                            </div>

                                                            <div className="space-y-3">
                                                                <div className="relative">
                                                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-gray-400">
                                                                        {CURRENCY_INFO[currency]?.symbol || currency}
                                                                    </span>
                                                                    <Input
                                                                        type="text"
                                                                        value={localPrice}
                                                                        onChange={(e) => setLocalPrices(prev => ({ ...prev, [priceKey]: e.target.value }))}
                                                                        placeholder="Auto-converted"
                                                                        className="h-12 pl-10 pr-4 font-bold text-lg border-gray-200"
                                                                    />
                                                                </div>
                                                                <Button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        const price = parseFloat(localPrice)
                                                                        if (!isNaN(price) && price > 0) {
                                                                            saveCurrencyPrice(variant.id!, currency, price)
                                                                        } else {
                                                                            toast.error('Please enter a valid price')
                                                                        }
                                                                    }}
                                                                    disabled={!localPrice || loadingPrices[variant.id!]}
                                                                    className="w-full h-10 text-xs font-black uppercase"
                                                                    size="sm"
                                                                >
                                                                    {loadingPrices[variant.id!] ? 'Saving...' : hasCustomPrice ? 'Update' : 'Set Custom Price'}
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <Button
                type="button"
                onClick={handleAddVariant}
                className="h-10 w-full rounded-xl border-2 border-dashed border-gray-100 bg-white text-gray-400 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 transition-all flex items-center justify-center space-x-2 group"
            >
                <Plus className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-widest">Add New Variant</span>
            </Button>
        </div>
    )
}
