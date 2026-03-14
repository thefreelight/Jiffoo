/**
 * Inventory Transfers Page for Admin Application
 *
 * Displays inventory transfer list with search, filter, and create form.
 * Supports i18n through the translation function.
 * Uses in-page navigation instead of sidebar submenu (Shopify style).
 */

'use client'

import { useState, useEffect } from 'react'
import { AlertTriangle, ArrowRightLeft, CheckCircle, Clock, Package, Plus, RefreshCw, Search, Truck, XCircle } from 'lucide-react'
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
import { PageNav } from '@/components/layout/page-nav'
import { useT, useLocale } from 'shared/src/i18n/react'
import { warehouseApi, inventoryTransferApi } from '@/lib/api/inventory'
import { unwrapApiResponse } from '@/lib/api'
import type { Warehouse, InventoryTransferDetail } from 'shared'
import { InventoryTransferForm } from '@/components/inventory/InventoryTransferForm'
import { toast } from 'sonner'

interface TransferStats {
  total: number
  pending: number
  inTransit: number
  completed: number
  cancelled: number
}

export default function InventoryTransfersPage() {
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

  const [transfers, setTransfers] = useState<InventoryTransferDetail[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [stats, setStats] = useState<TransferStats>({
    total: 0,
    pending: 0,
    inTransit: 0,
    completed: 0,
    cancelled: 0
  })
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('all')
  const [isCreateFormOpen, setIsCreateFormOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(20)

  useEffect(() => {
    loadData()
  }, [currentPage, statusFilter, selectedWarehouse])

  const loadData = async () => {
    try {
      setLoading(true)
      await Promise.all([loadWarehouses(), loadTransfers()])
    } catch (error) {
      console.error('Failed to load data:', error)
      toast.error(getText('merchant.inventory.transfers.loadFailed', 'Failed to load transfers'))
    } finally {
      setLoading(false)
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

  const loadTransfers = async () => {
    try {
      const params: any = {
        page: currentPage,
        limit: pageSize,
        sortBy: 'createdAt',
        sortOrder: 'desc' as const,
      }

      if (statusFilter !== 'all') {
        params.status = statusFilter
      }

      if (selectedWarehouse !== 'all') {
        params.fromWarehouseId = selectedWarehouse
      }

      const response = await inventoryTransferApi.getAll(params)
      if (response.success && response.data) {
        const transferList = response.data.items || []
        setTransfers(transferList)

        // Calculate stats
        const total = response.data.total || 0
        const pending = transferList.filter((t: InventoryTransferDetail) => t.status === 'PENDING').length
        const inTransit = transferList.filter((t: InventoryTransferDetail) => t.status === 'IN_TRANSIT').length
        const completed = transferList.filter((t: InventoryTransferDetail) => t.status === 'COMPLETED').length
        const cancelled = transferList.filter((t: InventoryTransferDetail) => t.status === 'CANCELLED').length

        setStats({
          total,
          pending,
          inTransit,
          completed,
          cancelled
        })
      }
    } catch (error) {
      console.error('Failed to load transfers:', error)
    }
  }

  const handleCreateTransfer = () => {
    setIsCreateFormOpen(true)
  }

  const handleTransferCreated = () => {
    setIsCreateFormOpen(false)
    loadTransfers()
    toast.success(getText('merchant.inventory.transfers.createSuccess', 'Transfer created successfully'))
  }

  const handleCompleteTransfer = async (transfer: InventoryTransferDetail) => {
    if (!window.confirm(getText('merchant.inventory.transfers.completeConfirm', 'Are you sure you want to complete this transfer? This action will move the inventory.'))) {
      return
    }

    try {
      await inventoryTransferApi.complete(transfer.id)
      toast.success(getText('merchant.inventory.transfers.completedSuccess', 'Transfer completed successfully'))
      loadTransfers()
    } catch (error) {
      console.error('Failed to complete transfer:', error)
      toast.error(getText('merchant.inventory.transfers.completeFailed', 'Failed to complete transfer'))
    }
  }

  const handleCancelTransfer = async (transfer: InventoryTransferDetail) => {
    const reason = window.prompt(getText('merchant.inventory.transfers.cancelReason', 'Please provide a reason for cancellation:'))
    if (!reason) return

    try {
      await inventoryTransferApi.cancel(transfer.id, { reason })
      toast.success(getText('merchant.inventory.transfers.cancelSuccess', 'Transfer cancelled successfully'))
      loadTransfers()
    } catch (error) {
      console.error('Failed to cancel transfer:', error)
      toast.error(getText('merchant.inventory.transfers.cancelFailed', 'Failed to cancel transfer'))
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-100 text-green-800'
      case 'IN_TRANSIT':
        return 'bg-blue-100 text-blue-800'
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800'
      case 'CANCELLED':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle className="w-4 h-4" />
      case 'IN_TRANSIT':
        return <Truck className="w-4 h-4" />
      case 'PENDING':
        return <Clock className="w-4 h-4" />
      case 'CANCELLED':
        return <XCircle className="w-4 h-4" />
      default:
        return <Clock className="w-4 h-4" />
    }
  }

  const filteredTransfers = transfers.filter(transfer => {
    const matchesSearch = searchTerm === '' ||
      transfer.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transfer.fromWarehouse?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transfer.toWarehouse?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transfer.variant?.name?.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesSearch
  })

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Page Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {getText('merchant.inventory.transfers.title', 'Inventory Transfers')}
            </h1>
            <p className="text-gray-600 mt-1">
              {getText('merchant.inventory.transfers.subtitle', 'Transfer inventory between warehouses')}
            </p>
          </div>
          <div className="flex gap-3">
            <Button onClick={loadData} variant="outline" disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              {getText('merchant.inventory.refresh', 'Refresh')}
            </Button>
            <Button onClick={handleCreateTransfer}>
              <Plus className="h-4 w-4 mr-2" />
              {getText('merchant.inventory.transfers.createTransfer', 'Create Transfer')}
            </Button>
          </div>
        </div>
        {/* In-page Navigation */}
        <PageNav items={navItems} />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-6">
        <Card className="cursor-pointer hover:shadow-md" onClick={() => setStatusFilter('all')}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  {getText('merchant.inventory.transfers.totalTransfers', 'Total Transfers')}
                </p>
                <p className="text-2xl font-bold text-gray-900 mt-2">{stats.total}</p>
              </div>
              <ArrowRightLeft className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md" onClick={() => setStatusFilter('PENDING')}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  {getText('merchant.inventory.transfers.pending', 'Pending')}
                </p>
                <p className="text-2xl font-bold text-yellow-600 mt-2">{stats.pending}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md" onClick={() => setStatusFilter('IN_TRANSIT')}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  {getText('merchant.inventory.transfers.inTransit', 'In Transit')}
                </p>
                <p className="text-2xl font-bold text-blue-600 mt-2">{stats.inTransit}</p>
              </div>
              <Truck className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md" onClick={() => setStatusFilter('COMPLETED')}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  {getText('merchant.inventory.transfers.completed', 'Completed')}
                </p>
                <p className="text-2xl font-bold text-green-600 mt-2">{stats.completed}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md" onClick={() => setStatusFilter('CANCELLED')}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  {getText('merchant.inventory.transfers.cancelled', 'Cancelled')}
                </p>
                <p className="text-2xl font-bold text-red-600 mt-2">{stats.cancelled}</p>
              </div>
              <XCircle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <Input
                placeholder={getText('merchant.inventory.transfers.searchPlaceholder', 'Search transfers...')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <Select value={selectedWarehouse} onValueChange={setSelectedWarehouse}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder={getText('merchant.inventory.allWarehouses', 'All Warehouses')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {getText('merchant.inventory.allWarehouses', 'All Warehouses')}
                </SelectItem>
                {warehouses.map((warehouse) => (
                  <SelectItem key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {statusFilter !== 'all' && (
              <Button variant="outline" onClick={() => setStatusFilter('all')}>
                {getText('merchant.inventory.clearFilter', 'Clear Filter')}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Transfers List */}
      <Card>
        <CardHeader>
          <CardTitle>
            {getText('merchant.inventory.transfers.list', 'Transfer History')}
            {statusFilter !== 'all' && (
              <Badge variant="secondary" className="ml-2">
                {getText(`merchant.inventory.transfers.${statusFilter.toLowerCase()}`, statusFilter)}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredTransfers.length === 0 ? (
            <div className="text-center py-12">
              <ArrowRightLeft className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">
                {getText('merchant.inventory.transfers.noTransfers', 'No transfers found')}
              </p>
              <Button onClick={handleCreateTransfer}>
                <Plus className="h-4 w-4 mr-2" />
                {getText('merchant.inventory.transfers.createFirst', 'Create your first transfer')}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTransfers.map((transfer) => {
                const StatusIcon = getStatusIcon(transfer.status)

                return (
                  <div
                    key={transfer.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                        <ArrowRightLeft className="h-6 w-6 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900">
                          {transfer.variant?.name || getText('merchant.inventory.transfers.unknownProduct', 'Unknown Product')}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {getText('merchant.inventory.transfers.from', 'From')}: {transfer.fromWarehouse?.name} →{' '}
                          {getText('merchant.inventory.transfers.to', 'To')}: {transfer.toWarehouse?.name}
                        </p>
                        <p className="text-sm text-gray-500">
                          {getText('merchant.inventory.transfers.quantity', 'Quantity')}: {transfer.quantity} |{' '}
                          {new Date(transfer.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge className={getStatusColor(transfer.status)}>
                        {StatusIcon}
                        <span className="ml-1">{transfer.status}</span>
                      </Badge>
                      {transfer.status === 'PENDING' && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleCompleteTransfer(transfer)}
                          >
                            {getText('merchant.inventory.transfers.complete', 'Complete')}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCancelTransfer(transfer)}
                          >
                            {getText('merchant.inventory.transfers.cancel', 'Cancel')}
                          </Button>
                        </div>
                      )}
                      {transfer.status === 'IN_TRANSIT' && (
                        <Button
                          size="sm"
                          onClick={() => handleCompleteTransfer(transfer)}
                        >
                          {getText('merchant.inventory.transfers.complete', 'Complete')}
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Transfer Form Dialog */}
      {isCreateFormOpen && (
        <InventoryTransferForm
          warehouses={warehouses}
          onClose={() => setIsCreateFormOpen(false)}
          onSuccess={handleTransferCreated}
        />
      )}
    </div>
  )
}
