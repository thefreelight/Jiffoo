/**
 * Stock Alerts Page for Admin Application
 *
 * Displays stock alerts list with filtering, status management, and settings.
 * Supports i18n through the translation function.
 * Uses in-page navigation (Shopify style).
 */

'use client'

import { useState, useEffect } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  Bell,
  CheckCircle,
  Eye,
  Filter,
  Package,
  RefreshCw,
  Search,
  X,
  XCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { PageNav } from '@/components/layout/page-nav'
import { StockAlertSettings } from '@/components/inventory/StockAlertSettings'
import { useT, useLocale } from 'shared/src/i18n/react'
import { stockAlertApi, warehouseApi, inventoryApi } from '@/lib/api/inventory'
import { productsApi, unwrapApiResponse } from '@/lib/api'
import type { StockAlertDetail, StockAlertStats, StockAlertStatus, StockAlertType, Warehouse } from 'shared'
import { toast } from 'sonner'

interface AlertFilter {
  status: StockAlertStatus | 'ALL'
  alertType: StockAlertType | 'ALL'
  warehouseId: string
}

export default function StockAlertsPage() {
  const t = useT()
  const locale = useLocale()

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback
  }

  // Page navigation items for Inventory module
  const navItems = [
    { label: getText('merchant.inventory.overview', 'Overview'), href: '/inventory', exact: true },
    { label: getText('merchant.inventory.warehouses', 'Warehouses'), href: '/inventory/warehouses', exact: true },
    { label: getText('merchant.inventory.transfers', 'Transfers'), href: '/inventory/transfers', exact: true },
    { label: getText('merchant.inventory.alerts', 'Alerts'), href: '/inventory/alerts', exact: true },
  ]

  const [alerts, setAlerts] = useState<StockAlertDetail[]>([])
  const [stats, setStats] = useState<StockAlertStats | null>(null)
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [variants, setVariants] = useState<Array<{ id: string; name: string; skuCode?: string }>>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedAlert, setSelectedAlert] = useState<StockAlertDetail | null>(null)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const [filter, setFilter] = useState<AlertFilter>({
    status: 'ACTIVE',
    alertType: 'ALL',
    warehouseId: 'all',
  })

  useEffect(() => {
    loadData()
  }, [currentPage, filter])

  const loadData = async () => {
    try {
      setLoading(true)
      await Promise.all([
        loadAlerts(),
        loadStats(),
        loadWarehouses(),
        loadVariants(),
      ])
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadAlerts = async () => {
    try {
      const params: any = {
        page: currentPage,
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      }

      if (filter.status !== 'ALL') {
        params.status = filter.status
      }

      if (filter.alertType !== 'ALL') {
        params.alertType = filter.alertType
      }

      if (filter.warehouseId && filter.warehouseId !== 'all') {
        params.warehouseId = filter.warehouseId
      }

      const response = await stockAlertApi.getAll(params)
      if (response.success && response.data) {
        const alertList = response.data.items || []
        setAlerts(alertList)
        setTotalPages(response.data.totalPages || 1)
      }
    } catch (error) {
      console.error('Failed to load alerts:', error)
      toast.error(getText('merchant.stockAlerts.loadFailed', 'Failed to load stock alerts'))
    }
  }

  const loadStats = async () => {
    try {
      const response = await stockAlertApi.getStats()
      if (response.success && response.data) {
        setStats(response.data)
      }
    } catch (error) {
      console.error('Failed to load stats:', error)
    }
  }

  const loadWarehouses = async () => {
    try {
      const response = await warehouseApi.getAll({ limit: 100 })
      if (response.success && response.data) {
        const warehouseList = response.data.items || []
        setWarehouses(warehouseList)
      }
    } catch (error) {
      console.error('Failed to load warehouses:', error)
    }
  }

  const loadVariants = async () => {
    try {
      // Load product list to get variants
      const response = await productsApi.getAll(1, 100)
      if (response.success && response.data) {
        const productList = Array.isArray(response.data) ? response.data : response.data.items || []
        // For simplicity, we'll use products as variants (in a real app, you'd fetch actual variants)
        const variantList = productList.map((product: any) => ({
          id: product.id,
          name: product.name,
          skuCode: product.sku,
        }))
        setVariants(variantList)
      }
    } catch (error) {
      console.error('Failed to load variants:', error)
    }
  }

  const handleResolveAlert = async (alertId: string, status: 'RESOLVED' | 'DISMISSED') => {
    try {
      const response = await stockAlertApi.resolve(alertId, { alertId, status })
      if (response.success) {
        toast.success(getText('merchant.stockAlerts.resolveSuccess', 'Alert updated successfully'))
        loadData()
        setIsDetailsOpen(false)
      }
    } catch (error: any) {
      console.error('Failed to resolve alert:', error)
      toast.error(error?.message || getText('merchant.stockAlerts.resolveFailed', 'Failed to update alert'))
    }
  }

  const handleViewDetails = (alert: StockAlertDetail) => {
    setSelectedAlert(alert)
    setIsDetailsOpen(true)
  }

  const getAlertTypeIcon = (type: StockAlertType) => {
    switch (type) {
      case 'LOW_STOCK':
        return <AlertTriangle className="h-4 w-4" />
      case 'OUT_OF_STOCK':
        return <AlertCircle className="h-4 w-4" />
      case 'RESTOCK_NEEDED':
        return <Bell className="h-4 w-4" />
      default:
        return <AlertTriangle className="h-4 w-4" />
    }
  }

  const getAlertTypeBadge = (type: StockAlertType) => {
    switch (type) {
      case 'LOW_STOCK':
        return (
          <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
            {getAlertTypeIcon(type)}
            <span className="ml-1">{getText('merchant.stockAlerts.types.lowStock', 'Low Stock')}</span>
          </Badge>
        )
      case 'OUT_OF_STOCK':
        return (
          <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
            {getAlertTypeIcon(type)}
            <span className="ml-1">{getText('merchant.stockAlerts.types.outOfStock', 'Out of Stock')}</span>
          </Badge>
        )
      case 'RESTOCK_NEEDED':
        return (
          <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
            {getAlertTypeIcon(type)}
            <span className="ml-1">{getText('merchant.stockAlerts.types.restockNeeded', 'Restock Needed')}</span>
          </Badge>
        )
      default:
        return null
    }
  }

  const getStatusBadge = (status: StockAlertStatus) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
            <AlertCircle className="h-3 w-3 mr-1" />
            {getText('merchant.stockAlerts.status.active', 'Active')}
          </Badge>
        )
      case 'RESOLVED':
        return (
          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
            <CheckCircle className="h-3 w-3 mr-1" />
            {getText('merchant.stockAlerts.status.resolved', 'Resolved')}
          </Badge>
        )
      case 'DISMISSED':
        return (
          <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100">
            <XCircle className="h-3 w-3 mr-1" />
            {getText('merchant.stockAlerts.status.dismissed', 'Dismissed')}
          </Badge>
        )
      default:
        return null
    }
  }

  const filteredAlerts = alerts.filter((alert) => {
    if (!searchTerm) return true
    const search = searchTerm.toLowerCase()
    return (
      alert.variant?.name.toLowerCase().includes(search) ||
      alert.product?.name.toLowerCase().includes(search) ||
      alert.warehouse?.name.toLowerCase().includes(search) ||
      alert.variant?.skuCode?.toLowerCase().includes(search)
    )
  })

  if (loading && alerts.length === 0) {
    return (
      <div className="p-6">
        <PageNav items={navItems} />
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">
              {getText('merchant.stockAlerts.loading', 'Loading stock alerts...')}
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <PageNav items={navItems} />

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          {getText('merchant.stockAlerts.title', 'Stock Alerts')}
        </h1>
        <p className="text-gray-600">
          {getText('merchant.stockAlerts.subtitle', 'Monitor and manage inventory alerts')}
        </p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    {getText('merchant.stockAlerts.stats.total', 'Total Alerts')}
                  </p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalAlerts}</p>
                </div>
                <Bell className="h-8 w-8 text-gray-400" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    {getText('merchant.stockAlerts.stats.active', 'Active')}
                  </p>
                  <p className="text-2xl font-bold text-red-600">{stats.activeAlerts}</p>
                </div>
                <AlertCircle className="h-8 w-8 text-red-400" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    {getText('merchant.stockAlerts.stats.resolved', 'Resolved')}
                  </p>
                  <p className="text-2xl font-bold text-green-600">{stats.resolvedAlerts}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-400" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    {getText('merchant.stockAlerts.stats.dismissed', 'Dismissed')}
                  </p>
                  <p className="text-2xl font-bold text-gray-600">{stats.dismissedAlerts}</p>
                </div>
                <XCircle className="h-8 w-8 text-gray-400" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Alert Settings */}
      <div className="mb-6">
        <StockAlertSettings
          warehouses={warehouses}
          variants={variants}
          onAlertCreated={loadData}
        />
      </div>

      {/* Filters and Search */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder={getText('merchant.stockAlerts.search', 'Search alerts...')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select
              value={filter.status}
              onValueChange={(value: StockAlertStatus | 'ALL') => setFilter({ ...filter, status: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{getText('merchant.stockAlerts.allStatuses', 'All Statuses')}</SelectItem>
                <SelectItem value="ACTIVE">{getText('merchant.stockAlerts.status.active', 'Active')}</SelectItem>
                <SelectItem value="RESOLVED">{getText('merchant.stockAlerts.status.resolved', 'Resolved')}</SelectItem>
                <SelectItem value="DISMISSED">{getText('merchant.stockAlerts.status.dismissed', 'Dismissed')}</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filter.alertType}
              onValueChange={(value: StockAlertType | 'ALL') => setFilter({ ...filter, alertType: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{getText('merchant.stockAlerts.allTypes', 'All Types')}</SelectItem>
                <SelectItem value="LOW_STOCK">{getText('merchant.stockAlerts.types.lowStock', 'Low Stock')}</SelectItem>
                <SelectItem value="OUT_OF_STOCK">{getText('merchant.stockAlerts.types.outOfStock', 'Out of Stock')}</SelectItem>
                <SelectItem value="RESTOCK_NEEDED">{getText('merchant.stockAlerts.types.restockNeeded', 'Restock Needed')}</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filter.warehouseId}
              onValueChange={(value) => setFilter({ ...filter, warehouseId: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{getText('merchant.stockAlerts.allWarehouses', 'All Warehouses')}</SelectItem>
                {warehouses.map((warehouse) => (
                  <SelectItem key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Alerts List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              {getText('merchant.stockAlerts.alertsList', 'Alerts List')}
            </CardTitle>
            <Button variant="outline" size="sm" onClick={loadData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              {getText('merchant.stockAlerts.refresh', 'Refresh')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {filteredAlerts.length === 0 ? (
            <div className="text-center py-12">
              <Bell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">
                {getText('merchant.stockAlerts.noAlerts', 'No stock alerts found')}
              </p>
              <p className="text-sm text-gray-500">
                {getText('merchant.stockAlerts.noAlertsDesc', 'Create a new alert to get started')}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        {getAlertTypeBadge(alert.alertType)}
                        {getStatusBadge(alert.status)}
                      </div>
                      <h3 className="font-semibold text-gray-900 mb-1">
                        {alert.product?.name || alert.variant?.name}
                      </h3>
                      <div className="text-sm text-gray-600 space-y-1">
                        {alert.variant?.skuCode && (
                          <p>
                            <span className="font-medium">{getText('merchant.stockAlerts.sku', 'SKU')}:</span> {alert.variant.skuCode}
                          </p>
                        )}
                        <p>
                          <span className="font-medium">{getText('merchant.stockAlerts.warehouse', 'Warehouse')}:</span> {alert.warehouse?.name}
                        </p>
                        <p>
                          <span className="font-medium">{getText('merchant.stockAlerts.currentStock', 'Current Stock')}:</span> {alert.quantity}
                        </p>
                        <p>
                          <span className="font-medium">{getText('merchant.stockAlerts.threshold', 'Threshold')}:</span> {alert.threshold}
                        </p>
                        <p className="text-xs text-gray-500">
                          {getText('merchant.stockAlerts.created', 'Created')}: {new Date(alert.createdAt).toLocaleString(locale)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewDetails(alert)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        {getText('merchant.stockAlerts.view', 'View')}
                      </Button>
                      {alert.status === 'ACTIVE' && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleResolveAlert(alert.id, 'RESOLVED')}
                            className="text-green-600 hover:text-green-700"
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            {getText('merchant.stockAlerts.resolve', 'Resolve')}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleResolveAlert(alert.id, 'DISMISSED')}
                            className="text-gray-600 hover:text-gray-700"
                          >
                            <X className="h-4 w-4 mr-1" />
                            {getText('merchant.stockAlerts.dismiss', 'Dismiss')}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-6 border-t">
              <p className="text-sm text-gray-600">
                {getText('merchant.stockAlerts.page', 'Page')} {currentPage} {getText('merchant.stockAlerts.of', 'of')} {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                >
                  {getText('merchant.stockAlerts.previous', 'Previous')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                >
                  {getText('merchant.stockAlerts.next', 'Next')}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Alert Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {getText('merchant.stockAlerts.alertDetails', 'Alert Details')}
            </DialogTitle>
            <DialogDescription>
              {selectedAlert?.product?.name || selectedAlert?.variant?.name}
            </DialogDescription>
          </DialogHeader>
          {selectedAlert && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-600">
                    {getText('merchant.stockAlerts.alertType', 'Alert Type')}
                  </Label>
                  <div className="mt-1">{getAlertTypeBadge(selectedAlert.alertType)}</div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-600">
                    {getText('merchant.stockAlerts.status', 'Status')}
                  </Label>
                  <div className="mt-1">{getStatusBadge(selectedAlert.status)}</div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-600">
                    {getText('merchant.stockAlerts.warehouse', 'Warehouse')}
                  </Label>
                  <p className="mt-1 text-sm">{selectedAlert.warehouse?.name}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-600">
                    {getText('merchant.stockAlerts.sku', 'SKU')}
                  </Label>
                  <p className="mt-1 text-sm">{selectedAlert.variant?.skuCode || '-'}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-600">
                    {getText('merchant.stockAlerts.currentStock', 'Current Stock')}
                  </Label>
                  <p className="mt-1 text-sm font-semibold">{selectedAlert.quantity}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-600">
                    {getText('merchant.stockAlerts.threshold', 'Threshold')}
                  </Label>
                  <p className="mt-1 text-sm font-semibold">{selectedAlert.threshold}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-600">
                    {getText('merchant.stockAlerts.created', 'Created')}
                  </Label>
                  <p className="mt-1 text-sm">{new Date(selectedAlert.createdAt).toLocaleString(locale)}</p>
                </div>
                {selectedAlert.resolvedAt && (
                  <div>
                    <Label className="text-sm font-medium text-gray-600">
                      {getText('merchant.stockAlerts.resolved', 'Resolved')}
                    </Label>
                    <p className="mt-1 text-sm">{new Date(selectedAlert.resolvedAt).toLocaleString(locale)}</p>
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDetailsOpen(false)}>
              {getText('merchant.stockAlerts.close', 'Close')}
            </Button>
            {selectedAlert?.status === 'ACTIVE' && (
              <>
                <Button
                  onClick={() => handleResolveAlert(selectedAlert.id, 'RESOLVED')}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  {getText('merchant.stockAlerts.markResolved', 'Mark Resolved')}
                </Button>
                <Button
                  onClick={() => handleResolveAlert(selectedAlert.id, 'DISMISSED')}
                  variant="outline"
                >
                  <X className="h-4 w-4 mr-2" />
                  {getText('merchant.stockAlerts.dismiss', 'Dismiss')}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
