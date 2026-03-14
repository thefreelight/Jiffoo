/**
 * Inventory Transfer Form Component
 *
 * Provides UI for creating inventory transfers between warehouses.
 * Displays a dialog with form to select warehouses, product variant, and quantity.
 */

'use client'

import { useState, useEffect } from 'react'
import { AlertTriangle, ArrowRightLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { inventoryTransferApi, inventoryApi } from '@/lib/api/inventory'
import { productsApi, unwrapApiResponse } from '@/lib/api'
import type { Warehouse, CreateInventoryTransferRequest } from 'shared'
import { useT } from 'shared/src/i18n/react'
import { toast } from 'sonner'

interface InventoryTransferFormProps {
  warehouses: Warehouse[]
  onClose: () => void
  onSuccess: () => void
}

interface Product {
  id: string
  name: string
  sku?: string
  stock: number
}

export function InventoryTransferForm({ warehouses, onClose, onSuccess }: InventoryTransferFormProps) {
  const t = useT()

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback
  }

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [availableStock, setAvailableStock] = useState<number | null>(null)

  const [formData, setFormData] = useState<{
    fromWarehouseId: string
    toWarehouseId: string
    variantId: string
    quantity: number
    reason: string
    notes: string
  }>({
    fromWarehouseId: '',
    toWarehouseId: '',
    variantId: '',
    quantity: 1,
    reason: '',
    notes: '',
  })

  useEffect(() => {
    loadProducts()
  }, [])

  useEffect(() => {
    if (formData.variantId && formData.fromWarehouseId) {
      checkAvailableStock()
    } else {
      setAvailableStock(null)
    }
  }, [formData.variantId, formData.fromWarehouseId])

  const loadProducts = async () => {
    try {
      setLoadingProducts(true)
      const response = await productsApi.getAll(1, 100)
      if (response.success && response.data) {
        const productList = Array.isArray(response.data) ? response.data : response.data.items || []
        setProducts(productList as Product[])
      }
    } catch (error) {
      console.error('Failed to load products:', error)
      toast.error(getText('merchant.inventory.transfers.loadProductsFailed', 'Failed to load products'))
    } finally {
      setLoadingProducts(false)
    }
  }

  const checkAvailableStock = async () => {
    try {
      const response = await inventoryApi.getByWarehouse(formData.fromWarehouseId, {
        variantId: formData.variantId,
        limit: 1,
      })

      if (response.success && response.data) {
        const items = response.data.items || []
        if (items.length > 0) {
          setAvailableStock(items[0].available || 0)
        } else {
          setAvailableStock(0)
        }
      }
    } catch (error) {
      console.error('Failed to check available stock:', error)
      setAvailableStock(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validation
    if (!formData.fromWarehouseId || !formData.toWarehouseId || !formData.variantId) {
      toast.error(getText('merchant.inventory.transfers.requiredFields', 'Please fill in all required fields'))
      return
    }

    if (formData.fromWarehouseId === formData.toWarehouseId) {
      toast.error(getText('merchant.inventory.transfers.sameWarehouse', 'Source and destination warehouses must be different'))
      return
    }

    if (formData.quantity <= 0) {
      toast.error(getText('merchant.inventory.transfers.invalidQuantity', 'Quantity must be greater than 0'))
      return
    }

    if (availableStock !== null && formData.quantity > availableStock) {
      toast.error(getText('merchant.inventory.transfers.insufficientStock', 'Insufficient stock available'))
      return
    }

    try {
      setIsSubmitting(true)

      const data: CreateInventoryTransferRequest = {
        fromWarehouseId: formData.fromWarehouseId,
        toWarehouseId: formData.toWarehouseId,
        variantId: formData.variantId,
        quantity: formData.quantity,
        reason: formData.reason || undefined,
        notes: formData.notes || undefined,
      }

      const response = await inventoryTransferApi.create(data)

      if (response.success) {
        onSuccess()
      }
    } catch (error: any) {
      console.error('Failed to create transfer:', error)
      toast.error(error?.message || getText('merchant.inventory.transfers.createFailed', 'Failed to create transfer'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const activeWarehouses = warehouses.filter((w) => w.isActive)

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" />
            {getText('merchant.inventory.transfers.createTitle', 'Create Inventory Transfer')}
          </DialogTitle>
          <DialogDescription>
            {getText('merchant.inventory.transfers.createDescription', 'Transfer inventory from one warehouse to another')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* From Warehouse */}
            <div className="space-y-2">
              <Label htmlFor="fromWarehouse">
                {getText('merchant.inventory.transfers.fromWarehouse', 'From Warehouse')} <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.fromWarehouseId}
                onValueChange={(value) => setFormData({ ...formData, fromWarehouseId: value })}
                required
              >
                <SelectTrigger id="fromWarehouse">
                  <SelectValue placeholder={getText('merchant.inventory.transfers.selectWarehouse', 'Select warehouse')} />
                </SelectTrigger>
                <SelectContent>
                  {activeWarehouses.map((warehouse) => (
                    <SelectItem
                      key={warehouse.id}
                      value={warehouse.id}
                      disabled={warehouse.id === formData.toWarehouseId}
                    >
                      {warehouse.name} ({warehouse.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* To Warehouse */}
            <div className="space-y-2">
              <Label htmlFor="toWarehouse">
                {getText('merchant.inventory.transfers.toWarehouse', 'To Warehouse')} <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.toWarehouseId}
                onValueChange={(value) => setFormData({ ...formData, toWarehouseId: value })}
                required
              >
                <SelectTrigger id="toWarehouse">
                  <SelectValue placeholder={getText('merchant.inventory.transfers.selectWarehouse', 'Select warehouse')} />
                </SelectTrigger>
                <SelectContent>
                  {activeWarehouses.map((warehouse) => (
                    <SelectItem
                      key={warehouse.id}
                      value={warehouse.id}
                      disabled={warehouse.id === formData.fromWarehouseId}
                    >
                      {warehouse.name} ({warehouse.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Product/Variant */}
            <div className="space-y-2">
              <Label htmlFor="variant">
                {getText('merchant.inventory.transfers.product', 'Product')} <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.variantId}
                onValueChange={(value) => setFormData({ ...formData, variantId: value })}
                required
                disabled={loadingProducts}
              >
                <SelectTrigger id="variant">
                  <SelectValue
                    placeholder={
                      loadingProducts
                        ? getText('merchant.inventory.transfers.loading', 'Loading...')
                        : getText('merchant.inventory.transfers.selectProduct', 'Select product')
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name} {product.sku ? `(${product.sku})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Quantity */}
            <div className="space-y-2">
              <Label htmlFor="quantity">
                {getText('merchant.inventory.transfers.quantity', 'Quantity')} <span className="text-red-500">*</span>
              </Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })}
                required
              />
              {availableStock !== null && (
                <p className="text-sm text-gray-600">
                  {getText('merchant.inventory.transfers.available', 'Available')}: {availableStock}
                </p>
              )}
              {availableStock !== null && formData.quantity > availableStock && (
                <div className="flex items-center gap-2 text-sm text-red-600">
                  <AlertTriangle className="h-4 w-4" />
                  <span>{getText('merchant.inventory.transfers.insufficientStock', 'Insufficient stock available')}</span>
                </div>
              )}
            </div>

            {/* Reason */}
            <div className="space-y-2">
              <Label htmlFor="reason">
                {getText('merchant.inventory.transfers.reason', 'Reason')}
              </Label>
              <Input
                id="reason"
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                placeholder={getText('merchant.inventory.transfers.reasonPlaceholder', 'e.g., Stock rebalancing')}
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">
                {getText('merchant.inventory.transfers.notes', 'Notes')}
              </Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder={getText('merchant.inventory.transfers.notesPlaceholder', 'Additional notes...')}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              {getText('merchant.inventory.transfers.cancel', 'Cancel')}
            </Button>
            <Button
              type="submit"
              disabled={
                isSubmitting ||
                loadingProducts ||
                (availableStock !== null && formData.quantity > availableStock)
              }
            >
              {isSubmitting
                ? getText('merchant.inventory.transfers.creating', 'Creating...')
                : getText('merchant.inventory.transfers.create', 'Create Transfer')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
