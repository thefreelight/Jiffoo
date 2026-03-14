/**
 * Stock Alert Settings Component
 *
 * Provides UI for creating and managing stock alert configurations.
 * Allows setting thresholds for low stock and out of stock alerts.
 */

'use client'

import { useState } from 'react'
import { AlertTriangle, Bell, Plus, Save, Settings, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { stockAlertApi } from '@/lib/api/inventory'
import { unwrapApiResponse } from '@/lib/api'
import type { StockAlertType, CreateStockAlertRequest } from 'shared'
import { useT } from 'shared/src/i18n/react'
import { toast } from 'sonner'

interface StockAlertSettingsProps {
  warehouses: Array<{ id: string; name: string; code: string }>
  variants: Array<{ id: string; name: string; skuCode?: string }>
  onAlertCreated: () => void
}

interface AlertFormData {
  warehouseId: string
  variantId: string
  alertType: StockAlertType
  threshold: number
}

export function StockAlertSettings({ warehouses, variants, onAlertCreated }: StockAlertSettingsProps) {
  const t = useT()

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback
  }

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [formData, setFormData] = useState<AlertFormData>({
    warehouseId: '',
    variantId: '',
    alertType: 'LOW_STOCK',
    threshold: 10,
  })

  const resetForm = () => {
    setFormData({
      warehouseId: '',
      variantId: '',
      alertType: 'LOW_STOCK',
      threshold: 10,
    })
  }

  const handleCreate = () => {
    resetForm()
    setIsCreateOpen(true)
  }

  const handleSubmitCreate = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.warehouseId || !formData.variantId) {
      toast.error(getText('merchant.stockAlerts.requiredFields', 'Please select a warehouse and variant'))
      return
    }

    if (formData.threshold < 0) {
      toast.error(getText('merchant.stockAlerts.invalidThreshold', 'Threshold must be a positive number'))
      return
    }

    try {
      setIsSubmitting(true)
      const requestData: CreateStockAlertRequest = {
        warehouseId: formData.warehouseId,
        variantId: formData.variantId,
        alertType: formData.alertType,
        threshold: formData.threshold,
      }
      const response = await stockAlertApi.create(requestData)
      if (response.success) {
        toast.success(getText('merchant.stockAlerts.createSuccess', 'Stock alert created successfully'))
        setIsCreateOpen(false)
        resetForm()
        onAlertCreated()
      }
    } catch (error: any) {
      console.error('Failed to create stock alert:', error)
      toast.error(error?.message || getText('merchant.stockAlerts.createFailed', 'Failed to create stock alert'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const alertTypeOptions = [
    { value: 'LOW_STOCK', label: getText('merchant.stockAlerts.types.lowStock', 'Low Stock'), icon: AlertTriangle },
    { value: 'OUT_OF_STOCK', label: getText('merchant.stockAlerts.types.outOfStock', 'Out of Stock'), icon: AlertTriangle },
    { value: 'RESTOCK_NEEDED', label: getText('merchant.stockAlerts.types.restockNeeded', 'Restock Needed'), icon: Bell },
  ]

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            {getText('merchant.stockAlerts.settings', 'Alert Settings')}
          </h2>
          <p className="text-sm text-gray-600">
            {getText('merchant.stockAlerts.settingsSubtitle', 'Configure stock alert thresholds and notifications')}
          </p>
        </div>
        <Button onClick={handleCreate} disabled={isSubmitting}>
          <Plus className="h-4 w-4 mr-2" />
          {getText('merchant.stockAlerts.createAlert', 'Create Alert')}
        </Button>
      </div>

      {/* Info Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Settings className="h-5 w-5 text-blue-600" />
            {getText('merchant.stockAlerts.howItWorks', 'How Stock Alerts Work')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm text-gray-600">
            <p>
              {getText('merchant.stockAlerts.description1', 'Stock alerts help you stay on top of inventory levels by notifying you when products reach critical thresholds.')}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <span className="font-medium text-amber-900">
                    {getText('merchant.stockAlerts.types.lowStock', 'Low Stock')}
                  </span>
                </div>
                <p className="text-xs text-amber-700">
                  {getText('merchant.stockAlerts.lowStockDesc', 'Triggered when stock falls below threshold')}
                </p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <span className="font-medium text-red-900">
                    {getText('merchant.stockAlerts.types.outOfStock', 'Out of Stock')}
                  </span>
                </div>
                <p className="text-xs text-red-700">
                  {getText('merchant.stockAlerts.outOfStockDesc', 'Triggered when stock reaches zero')}
                </p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Bell className="h-4 w-4 text-blue-600" />
                  <span className="font-medium text-blue-900">
                    {getText('merchant.stockAlerts.types.restockNeeded', 'Restock Needed')}
                  </span>
                </div>
                <p className="text-xs text-blue-700">
                  {getText('merchant.stockAlerts.restockNeededDesc', 'Triggered when restocking is recommended')}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Create Alert Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {getText('merchant.stockAlerts.createTitle', 'Create Stock Alert')}
            </DialogTitle>
            <DialogDescription>
              {getText('merchant.stockAlerts.createDescription', 'Set up a new stock alert for a product variant')}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitCreate}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="create-warehouse">
                  {getText('merchant.stockAlerts.warehouse', 'Warehouse')} <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.warehouseId}
                  onValueChange={(value) => setFormData({ ...formData, warehouseId: value })}
                  required
                >
                  <SelectTrigger id="create-warehouse">
                    <SelectValue placeholder={getText('merchant.stockAlerts.selectWarehouse', 'Select warehouse')} />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouses.map((warehouse) => (
                      <SelectItem key={warehouse.id} value={warehouse.id}>
                        {warehouse.name} ({warehouse.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="create-variant">
                  {getText('merchant.stockAlerts.variant', 'Product Variant')} <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.variantId}
                  onValueChange={(value) => setFormData({ ...formData, variantId: value })}
                  required
                >
                  <SelectTrigger id="create-variant">
                    <SelectValue placeholder={getText('merchant.stockAlerts.selectVariant', 'Select variant')} />
                  </SelectTrigger>
                  <SelectContent>
                    {variants.map((variant) => (
                      <SelectItem key={variant.id} value={variant.id}>
                        {variant.name} {variant.skuCode && `(${variant.skuCode})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="create-alert-type">
                  {getText('merchant.stockAlerts.alertType', 'Alert Type')} <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.alertType}
                  onValueChange={(value: StockAlertType) => setFormData({ ...formData, alertType: value })}
                  required
                >
                  <SelectTrigger id="create-alert-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {alertTypeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="create-threshold">
                  {getText('merchant.stockAlerts.threshold', 'Threshold')} <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="create-threshold"
                  type="number"
                  min="0"
                  value={formData.threshold}
                  onChange={(e) => setFormData({ ...formData, threshold: parseInt(e.target.value) || 0 })}
                  placeholder={getText('merchant.stockAlerts.thresholdPlaceholder', '10')}
                  required
                />
                <p className="text-xs text-gray-500">
                  {getText('merchant.stockAlerts.thresholdHelp', 'Alert will trigger when stock falls below this number')}
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
                disabled={isSubmitting}
              >
                {getText('merchant.stockAlerts.cancel', 'Cancel')}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? getText('merchant.stockAlerts.creating', 'Creating...') : getText('merchant.stockAlerts.create', 'Create Alert')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
