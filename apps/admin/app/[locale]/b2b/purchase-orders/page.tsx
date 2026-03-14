/**
 * Purchase Orders Page for B2B Admin
 *
 * Displays purchase order list with search, filter, and pagination.
 * Supports i18n through the translation function.
 * Uses in-page navigation (Shopify style).
 */

'use client'

import { AlertTriangle, Package, Search } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { usePurchaseOrders, type PurchaseOrder } from '@/lib/hooks/use-api'
import { Card, CardContent } from '@/components/ui/card'
import { PageNav } from '@/components/layout/page-nav'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useT, useLocale } from 'shared/src/i18n/react'
import { PurchaseOrderList } from '@/components/b2b/PurchaseOrderList'
import { formatCurrency } from '@/lib/utils'

export default function PurchaseOrdersPage() {
  const t = useT()
  const locale = useLocale()

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback
  }

  // Page navigation items for Purchase Orders module
  const navItems = [
    { label: getText('merchant.b2b.purchaseOrders.allPurchaseOrders', 'All Purchase Orders'), href: '/b2b/purchase-orders', exact: true },
  ]
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('All')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(10)

  // API hooks
  const {
    data: purchaseOrdersData,
    isLoading,
    error,
    refetch
  } = usePurchaseOrders({
    page: currentPage,
    limit: pageSize,
    status: selectedStatus !== 'All' ? selectedStatus : undefined
  })

  const purchaseOrders = purchaseOrdersData?.data || []
  const pagination = purchaseOrdersData?.pagination

  // Filter purchase orders locally for immediate feedback
  const filteredPurchaseOrders = purchaseOrders.filter((po: PurchaseOrder) => {
    if (!po) return false
    const matchesSearch = searchTerm === '' ||
      po.poNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      po.company?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      po.user?.email?.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesSearch
  })

  // Calculate stats from purchase orders data
  const poStats = {
    total: pagination?.total || 0,
    pending: purchaseOrders.filter((po: PurchaseOrder) => po.status === 'PENDING_APPROVAL').length,
    approved: purchaseOrders.filter((po: PurchaseOrder) => po.status === 'APPROVED').length,
    totalValue: purchaseOrders.reduce((sum: number, po: PurchaseOrder) => sum + (po.totalAmount || 0), 0),
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">{getText('merchant.b2b.purchaseOrders.loadFailed', 'Failed to load purchase orders')}</h3>
              <p className="text-gray-600 mb-4">{getText('merchant.b2b.purchaseOrders.loadError', 'There was an error loading the purchase orders data.')}</p>
              <Button onClick={() => refetch()}>{getText('merchant.b2b.purchaseOrders.tryAgain', 'Try Again')}</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Page Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{getText('merchant.b2b.purchaseOrders.title', 'Purchase Orders')}</h1>
            <p className="text-gray-600 mt-1">{getText('merchant.b2b.purchaseOrders.subtitle', 'Manage B2B purchase orders and approvals')}</p>
          </div>
        </div>
        {/* In-page Navigation */}
        <PageNav items={navItems} />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">{getText('merchant.b2b.purchaseOrders.totalPurchaseOrders', 'Total POs')}</p>
                <p className="text-2xl font-bold text-gray-900">{poStats.total.toLocaleString()}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Package className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">{getText('merchant.b2b.purchaseOrders.pendingApproval', 'Pending Approval')}</p>
                <p className="text-2xl font-bold text-yellow-600">{poStats.pending}</p>
              </div>
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <Package className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">{getText('merchant.b2b.purchaseOrders.approved', 'Approved')}</p>
                <p className="text-2xl font-bold text-green-600">{poStats.approved}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <Package className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">{getText('merchant.b2b.purchaseOrders.totalValue', 'Total Value')}</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(poStats.totalValue)}</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Package className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder={getText('merchant.b2b.purchaseOrders.searchPlaceholder', 'Search POs by number, company, or customer...')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder={getText('merchant.b2b.purchaseOrders.allStatus', 'All Status')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">{getText('merchant.b2b.purchaseOrders.allStatus', 'All Status')}</SelectItem>
                  <SelectItem value="DRAFT">{getText('merchant.b2b.purchaseOrders.statusDraft', 'Draft')}</SelectItem>
                  <SelectItem value="PENDING_APPROVAL">{getText('merchant.b2b.purchaseOrders.statusPendingApproval', 'Pending Approval')}</SelectItem>
                  <SelectItem value="APPROVED">{getText('merchant.b2b.purchaseOrders.statusApproved', 'Approved')}</SelectItem>
                  <SelectItem value="REJECTED">{getText('merchant.b2b.purchaseOrders.statusRejected', 'Rejected')}</SelectItem>
                  <SelectItem value="ORDERED">{getText('merchant.b2b.purchaseOrders.statusOrdered', 'Ordered')}</SelectItem>
                  <SelectItem value="PARTIALLY_RECEIVED">{getText('merchant.b2b.purchaseOrders.statusPartiallyReceived', 'Partially Received')}</SelectItem>
                  <SelectItem value="RECEIVED">{getText('merchant.b2b.purchaseOrders.statusReceived', 'Received')}</SelectItem>
                  <SelectItem value="CANCELLED">{getText('merchant.b2b.purchaseOrders.statusCancelled', 'Cancelled')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Purchase Orders List */}
      <PurchaseOrderList
        purchaseOrders={filteredPurchaseOrders}
        emptyMessage={searchTerm ? getText('merchant.b2b.purchaseOrders.noPurchaseOrdersMatching', 'No purchase orders found matching your search.') : undefined}
      />

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <div className="text-sm text-gray-700">
            {getText('merchant.b2b.purchaseOrders.showingResults', 'Showing {from} to {to} of {total} results')
              .replace('{from}', String((currentPage - 1) * pageSize + 1))
              .replace('{to}', String(Math.min(currentPage * pageSize, pagination.total)))
              .replace('{total}', String(pagination.total))}
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              {getText('merchant.b2b.purchaseOrders.previous', 'Previous')}
            </Button>
            {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
              const page = i + 1
              return (
                <Button
                  key={page}
                  variant={currentPage === page ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCurrentPage(page)}
                >
                  {page}
                </Button>
              )
            })}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(pagination.totalPages, prev + 1))}
              disabled={currentPage === pagination.totalPages}
            >
              {getText('merchant.b2b.purchaseOrders.next', 'Next')}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
