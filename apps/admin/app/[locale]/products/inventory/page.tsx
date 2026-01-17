/**
 * Inventory Overview Page
 *
 * Displays stock overview and low stock products with management capabilities.
 * Uses useStockOverview() and useLowStockProducts() hooks.
 */

'use client'

import { AlertTriangle, Package, RefreshCw, TrendingDown } from 'lucide-react'
import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PageNav } from '@/components/layout/page-nav'
import { useStockOverview, useLowStockProducts, useAdjustStock } from '@/lib/hooks/use-api'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useT, useLocale } from 'shared/src/i18n/react'

export default function InventoryPage() {
  const t = useT()
  const locale = useLocale()

  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback
  }

  // Page navigation items
  const navItems = [
    { label: getText('merchant.products.allProducts', 'All Products'), href: '/products', exact: true },
    { label: getText('merchant.products.addProduct', 'Add Product'), href: '/products/create' },
    { label: getText('merchant.products.inventory', 'Inventory'), href: '/products/inventory' },
  ]

  const [lowStockThreshold, setLowStockThreshold] = useState(10)
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<any>(null)
  const [adjustQuantity, setAdjustQuantity] = useState('')
  const [adjustOperation, setAdjustOperation] = useState<'increase' | 'decrease'>('increase')
  const [adjustReason, setAdjustReason] = useState('')

  const { data: stockOverview, isLoading: overviewLoading, refetch: refetchOverview } = useStockOverview(lowStockThreshold)
  const { data: lowStockData, isLoading: lowStockLoading, refetch: refetchLowStock } = useLowStockProducts({ threshold: lowStockThreshold, limit: 20 })
  const adjustStockMutation = useAdjustStock()

  const lowStockProducts = Array.isArray(lowStockData?.data) ? lowStockData.data : []
  const stockProducts = stockOverview?.products || []

  // Calculate stats
  const totalProducts = stockProducts.length
  const lowStockCount = stockProducts.filter((p: any) => p.stock <= p.lowStockThreshold).length
  const outOfStockCount = stockProducts.filter((p: any) => p.stock === 0).length

  const handleAdjustStock = (product: any) => {
    setSelectedProduct(product)
    setAdjustQuantity('')
    setAdjustOperation('increase')
    setAdjustReason('')
    setAdjustDialogOpen(true)
  }

  const handleConfirmAdjust = async () => {
    if (!selectedProduct || !adjustQuantity) return

    await adjustStockMutation.mutateAsync({
      id: selectedProduct.id,
      data: {
        operation: adjustOperation,
        quantity: parseInt(adjustQuantity),
        reason: adjustReason || 'Manual adjustment',
      }
    })

    setAdjustDialogOpen(false)
    refetchOverview()
    refetchLowStock()
  }

  const handleRefresh = () => {
    refetchOverview()
    refetchLowStock()
  }

  if (overviewLoading || lowStockLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
            <p className="mt-2 text-gray-600">{getText('merchant.products.inventory.loading', 'Loading inventory...')}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{getText('merchant.products.inventory.title', 'Inventory')}</h1>
            <p className="text-gray-600 mt-1">{getText('merchant.products.inventory.subtitle', 'Monitor stock levels and manage inventory')}</p>
          </div>
          <Button variant="outline" onClick={handleRefresh}>
            <RefreshCw className="w-4 h-4 mr-2" />
            {getText('merchant.products.inventory.refresh', 'Refresh')}
          </Button>
        </div>
        <PageNav items={navItems} />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{getText('merchant.products.inventory.totalProducts', 'Total Products')}</CardTitle>
            <Package className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalProducts}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{getText('merchant.products.inventory.lowStock', 'Low Stock')}</CardTitle>
            <TrendingDown className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{lowStockCount}</div>
            <p className="text-xs text-gray-500">≤ {lowStockThreshold} {getText('merchant.products.inventory.units', 'units')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{getText('merchant.products.inventory.outOfStock', 'Out of Stock')}</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{outOfStockCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Low Stock Products Table */}
      <Card>
        <CardHeader>
          <CardTitle>{getText('merchant.products.inventory.lowStockProducts', 'Low Stock Products')}</CardTitle>
        </CardHeader>
        <CardContent>
          {lowStockProducts.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {getText('merchant.products.inventory.noLowStock', 'No low stock products found')}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">{getText('merchant.products.name', 'Name')}</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">{getText('merchant.products.sku', 'SKU')}</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">{getText('merchant.products.inventory.currentStock', 'Stock')}</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">{getText('merchant.products.inventory.threshold', 'Threshold')}</th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-gray-600">{getText('merchant.products.status', 'Status')}</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">{getText('merchant.products.actions', 'Actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {lowStockProducts.map((product: any) => (
                    <tr key={product.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <Link href={`/${locale}/products/${product.id}`} className="text-gray-900 hover:text-gray-600 font-medium">
                          {product.name}
                        </Link>
                      </td>
                      <td className="py-3 px-4 text-gray-500 text-sm">{product.sku || '-'}</td>
                      <td className="py-3 px-4 text-right font-medium">{product.stock}</td>
                      <td className="py-3 px-4 text-right text-gray-500">{product.lowStockThreshold || lowStockThreshold}</td>
                      <td className="py-3 px-4 text-center">
                        {product.stock === 0 ? (
                          <Badge variant="destructive">{getText('merchant.products.inventory.outOfStock', 'Out of Stock')}</Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">{getText('merchant.products.inventory.lowStock', 'Low Stock')}</Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button size="sm" variant="outline" onClick={() => handleAdjustStock(product)}>
                          {getText('merchant.products.inventory.adjustStock', 'Adjust')}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Adjust Stock Dialog */}
      <Dialog open={adjustDialogOpen} onOpenChange={setAdjustDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{getText('merchant.products.inventory.adjustStockTitle', 'Adjust Stock')}</DialogTitle>
            <DialogDescription>
              {getText('merchant.products.inventory.adjustStockDesc', 'Adjust stock quantity for')} {selectedProduct?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{getText('merchant.products.inventory.operation', 'Operation')}</Label>
                <Select value={adjustOperation} onValueChange={(v: 'increase' | 'decrease') => setAdjustOperation(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="increase">{getText('merchant.products.inventory.increase', 'Increase')}</SelectItem>
                    <SelectItem value="decrease">{getText('merchant.products.inventory.decrease', 'Decrease')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{getText('merchant.products.inventory.quantity', 'Quantity')}</Label>
                <Input type="number" min="1" value={adjustQuantity} onChange={(e) => setAdjustQuantity(e.target.value)} placeholder="0" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{getText('merchant.products.inventory.reason', 'Reason')}</Label>
              <Input value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} placeholder={getText('merchant.products.inventory.reasonPlaceholder', 'e.g., Restock, Damage, Sale')} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustDialogOpen(false)}>{getText('common.cancel', 'Cancel')}</Button>
            <Button onClick={handleConfirmAdjust} disabled={!adjustQuantity || adjustStockMutation.isPending}>
              {adjustStockMutation.isPending ? getText('common.saving', 'Saving...') : getText('common.confirm', 'Confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

