/**
 * Pricing Rule Form Dialog Component
 *
 * Handles create, edit, and delete operations for pricing rules
 * Displays as a dialog with appropriate forms
 */

'use client'

import { useState, useEffect } from 'react'
import { useT } from 'shared/src/i18n/react'
import { useCreatePriceRule, useUpdatePriceRule, useDeletePriceRule, type PriceRule } from '@/lib/hooks/use-api'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Loader2 } from 'lucide-react'

interface PricingRuleFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  priceRule?: PriceRule | null
  mode: 'create' | 'edit' | 'delete'
}

export function PricingRuleForm({ open, onOpenChange, onSuccess, priceRule, mode }: PricingRuleFormProps) {
  const t = useT()

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback
  }

  const createMutation = useCreatePriceRule()
  const updateMutation = useUpdatePriceRule()
  const deleteMutation = useDeletePriceRule()

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    discountType: 'PERCENTAGE' as 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FIXED_PRICE',
    discountValue: 0,
    minQuantity: 1,
    maxQuantity: null as number | null,
    priority: 0,
    isActive: true,
    startDate: '',
    endDate: '',
    customerGroupId: '',
    productId: '',
    variantId: '',
    categoryId: '',
  })

  // Reset form when dialog opens/closes or price rule changes
  useEffect(() => {
    if (open && mode === 'edit' && priceRule) {
      setFormData({
        name: priceRule.name || '',
        description: priceRule.description || '',
        discountType: priceRule.discountType || 'PERCENTAGE',
        discountValue: priceRule.discountValue || 0,
        minQuantity: priceRule.minQuantity || 1,
        maxQuantity: priceRule.maxQuantity || null,
        priority: priceRule.priority || 0,
        isActive: priceRule.isActive ?? true,
        startDate: priceRule.startDate ? priceRule.startDate.split('T')[0] : '',
        endDate: priceRule.endDate ? priceRule.endDate.split('T')[0] : '',
        customerGroupId: priceRule.customerGroupId || '',
        productId: priceRule.productId || '',
        variantId: priceRule.variantId || '',
        categoryId: priceRule.categoryId || '',
      })
    } else if (open && mode === 'create') {
      setFormData({
        name: '',
        description: '',
        discountType: 'PERCENTAGE',
        discountValue: 0,
        minQuantity: 1,
        maxQuantity: null,
        priority: 0,
        isActive: true,
        startDate: '',
        endDate: '',
        customerGroupId: '',
        productId: '',
        variantId: '',
        categoryId: '',
      })
    }
  }, [open, mode, priceRule])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const submitData: any = {
        ...formData,
        customerGroupId: formData.customerGroupId || undefined,
        productId: formData.productId || undefined,
        variantId: formData.variantId || undefined,
        categoryId: formData.categoryId || undefined,
        startDate: formData.startDate || undefined,
        endDate: formData.endDate || undefined,
        maxQuantity: formData.maxQuantity || undefined,
      }

      if (mode === 'create') {
        await createMutation.mutateAsync(submitData)
      } else if (mode === 'edit' && priceRule) {
        await updateMutation.mutateAsync({ id: priceRule.id, data: submitData })
      } else if (mode === 'delete' && priceRule) {
        await deleteMutation.mutateAsync(priceRule.id)
      }

      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      // Error is handled by the mutation hooks with toast
    }
  }

  const isLoading = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending

  // Delete confirmation dialog
  if (mode === 'delete') {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{getText('merchant.b2b.pricing.delete.title', 'Delete Pricing Rule')}</DialogTitle>
            <DialogDescription>
              {getText('merchant.b2b.pricing.delete.description', 'Are you sure you want to delete this pricing rule? This action cannot be undone.')}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-gray-700">
              {getText('merchant.b2b.pricing.delete.ruleName', 'Rule')}: <strong>{priceRule?.name}</strong>
            </p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              {getText('merchant.b2b.pricing.cancel', 'Cancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleSubmit}
              disabled={isLoading}
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {getText('merchant.b2b.pricing.delete.confirm', 'Delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  // Create/Edit form dialog
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create'
              ? getText('merchant.b2b.pricing.create.title', 'Create Pricing Rule')
              : getText('merchant.b2b.pricing.edit.title', 'Edit Pricing Rule')}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? getText('merchant.b2b.pricing.create.description', 'Add a new pricing rule for B2B customers.')
              : getText('merchant.b2b.pricing.edit.description', 'Update pricing rule information.')}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-900">
                {getText('merchant.b2b.pricing.basicInfo', 'Basic Information')}
              </h3>
              <div className="space-y-2">
                <Label htmlFor="name">
                  {getText('merchant.b2b.pricing.form.name', 'Rule Name')} *
                </Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  placeholder={getText('merchant.b2b.pricing.form.namePlaceholder', 'e.g., Wholesale Discount')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">
                  {getText('merchant.b2b.pricing.form.description', 'Description')}
                </Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                  placeholder={getText('merchant.b2b.pricing.form.descriptionPlaceholder', 'Describe this pricing rule...')}
                />
              </div>
            </div>

            {/* Discount Configuration */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-900">
                {getText('merchant.b2b.pricing.discountConfig', 'Discount Configuration')}
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="discountType">
                    {getText('merchant.b2b.pricing.form.discountType', 'Discount Type')} *
                  </Label>
                  <Select
                    value={formData.discountType}
                    onValueChange={(value: any) => setFormData({ ...formData, discountType: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PERCENTAGE">{getText('merchant.b2b.pricing.discountTypePercentage', 'Percentage')}</SelectItem>
                      <SelectItem value="FIXED_AMOUNT">{getText('merchant.b2b.pricing.discountTypeFixedAmount', 'Fixed Amount')}</SelectItem>
                      <SelectItem value="FIXED_PRICE">{getText('merchant.b2b.pricing.discountTypeFixedPrice', 'Fixed Price')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="discountValue">
                    {getText('merchant.b2b.pricing.form.discountValue', 'Discount Value')} *
                  </Label>
                  <Input
                    id="discountValue"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.discountValue}
                    onChange={(e) => setFormData({ ...formData, discountValue: parseFloat(e.target.value) || 0 })}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Quantity Range */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-900">
                {getText('merchant.b2b.pricing.quantityRange', 'Quantity Range')}
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="minQuantity">
                    {getText('merchant.b2b.pricing.form.minQuantity', 'Minimum Quantity')} *
                  </Label>
                  <Input
                    id="minQuantity"
                    type="number"
                    min="1"
                    value={formData.minQuantity}
                    onChange={(e) => setFormData({ ...formData, minQuantity: parseInt(e.target.value) || 1 })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxQuantity">
                    {getText('merchant.b2b.pricing.form.maxQuantity', 'Maximum Quantity')}
                  </Label>
                  <Input
                    id="maxQuantity"
                    type="number"
                    min="1"
                    value={formData.maxQuantity || ''}
                    onChange={(e) => setFormData({ ...formData, maxQuantity: e.target.value ? parseInt(e.target.value) : null })}
                    placeholder={getText('merchant.b2b.pricing.form.maxQuantityPlaceholder', 'Leave empty for unlimited')}
                  />
                </div>
              </div>
            </div>

            {/* Rule Settings */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-900">
                {getText('merchant.b2b.pricing.ruleSettings', 'Rule Settings')}
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="priority">
                    {getText('merchant.b2b.pricing.form.priority', 'Priority')}
                  </Label>
                  <Input
                    id="priority"
                    type="number"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="startDate">
                    {getText('merchant.b2b.pricing.form.startDate', 'Start Date')}
                  </Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">
                    {getText('merchant.b2b.pricing.form.endDate', 'End Date')}
                  </Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="isActive" className="cursor-pointer">
                  {getText('merchant.b2b.pricing.form.isActive', 'Active')}
                </Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              {getText('merchant.b2b.pricing.cancel', 'Cancel')}
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === 'create'
                ? getText('merchant.b2b.pricing.create.submit', 'Create Rule')
                : getText('merchant.b2b.pricing.edit.submit', 'Update Rule')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
