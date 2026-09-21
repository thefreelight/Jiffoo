'use client'

/**
 * Variants Editor - Industrial Matrix Reborn
 * Aligned with the high-impact product editor design.
 */

import { Plus, Trash2, CheckCircle2, Circle } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { generateId } from '@/lib/utils'

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

interface VariantsEditorProps {
    variants: Variant[]
    onChange: (variants: Variant[]) => void
    productId?: string
}

export function VariantsEditor({ variants, onChange }: VariantsEditorProps) {
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
