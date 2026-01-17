/**
 * Orders Page for Tenant Application
 *
 * Displays order list with search, filter, batch operations and pagination.
 * Supports i18n through the translation function.
 * Uses in-page navigation instead of sidebar submenu (Shopify style).
 */

'use client'

import { AlertTriangle, CheckCircle, Clock, Eye, Filter, Search, Truck, XCircle } from 'lucide-react'
import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useOrders, useUpdateOrderStatus, type Order } from '@/lib/hooks/use-api'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { PageNav } from '@/components/layout/page-nav'
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
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { useT, useLocale } from 'shared/src/i18n/react'


export default function OrdersPage() {
  const t = useT()
  const locale = useLocale()

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback
  }

  // Page navigation items for Orders module
  // Status-based navigation moved from sidebar to in-page tabs
  const navItems = [
    { label: getText('merchant.orders.allOrders', 'All Orders'), href: '/orders', exact: true },
  ]
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('All')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  // API hooks
  const {
    data: ordersData,
    isLoading,
    error,
    refetch
  } = useOrders({
    page: currentPage,
    limit: pageSize,
    search: searchTerm,
    status: selectedStatus !== 'All' ? selectedStatus : undefined
  })

  const updateOrderStatusMutation = useUpdateOrderStatus()

  const orders = ordersData?.data || []
  const pagination = ordersData?.pagination

  const handleStatusUpdate = async (orderId: string, newStatus: string) => {
    try {
      await updateOrderStatusMutation.mutateAsync({ id: orderId, status: newStatus })
      refetch()
    } catch (error) {
      console.error('Failed to update order status:', error)
    }
  }



  // Filter orders locally for immediate feedback
  const filteredOrders = orders.filter((order: Order) => {
    if (!order) return false
    const matchesSearch = searchTerm === '' ||
      order.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.user?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.user?.email?.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesSearch
  })

  const getStatusColor = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'DELIVERED':
        return 'bg-green-100 text-green-800'
      case 'SHIPPED':
        return 'bg-blue-100 text-blue-800'
      case 'PAID':
        return 'bg-yellow-100 text-yellow-800'
      case 'PENDING':
        return 'bg-orange-100 text-orange-800'
      case 'CANCELLED':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'DELIVERED':
        return <CheckCircle className="w-4 h-4" />
      case 'SHIPPED':
        return <Truck className="w-4 h-4" />
      case 'PAID':
        return <Clock className="w-4 h-4" />
      case 'PENDING':
        return <AlertTriangle className="w-4 h-4" />
      case 'CANCELLED':
        return <XCircle className="w-4 h-4" />
      default:
        return <Clock className="w-4 h-4" />
    }
  }

  const getPaymentColor = (payment: string) => {
    switch (payment?.toLowerCase()) {
      case 'paid':
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'refunded':
        return 'bg-red-100 text-red-800'
      case 'failed':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  // Calculate stats from orders data
  const orderStats = {
    total: pagination?.total || 0,
    pending: orders.filter((order: Order) => order.status?.toUpperCase() === 'PENDING').length,
    paid: orders.filter((order: Order) => order.status?.toUpperCase() === 'PAID').length,
    delivered: orders.filter((order: Order) => order.status?.toUpperCase() === 'DELIVERED').length,
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
              <h3 className="text-lg font-medium text-gray-900 mb-2">{getText('merchant.orders.loadFailed', 'Failed to load orders')}</h3>
              <p className="text-gray-600 mb-4">{getText('merchant.orders.loadError', 'There was an error loading the orders data.')}</p>
              <Button onClick={() => refetch()}>{getText('merchant.orders.tryAgain', 'Try Again')}</Button>
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
            <h1 className="text-2xl font-bold text-gray-900">{getText('merchant.orders.title', 'Orders')}</h1>
            <p className="text-gray-600 mt-1">{getText('merchant.orders.subtitle', 'Manage customer orders and fulfillment')}</p>
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
                <p className="text-sm font-medium text-gray-600">{getText('merchant.orders.totalOrders', 'Total Orders')}</p>
                <p className="text-2xl font-bold text-gray-900">{orderStats.total.toLocaleString()}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Truck className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">{getText('merchant.orders.pending', 'Pending')}</p>
                <p className="text-2xl font-bold text-orange-600">{orderStats.pending}</p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">{getText('merchant.orders.paid', 'Paid')}</p>
                <p className="text-2xl font-bold text-yellow-600">{orderStats.paid}</p>
              </div>
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">{getText('merchant.orders.delivered', 'Delivered')}</p>
                <p className="text-2xl font-bold text-green-600">{orderStats.delivered}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
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
                  placeholder={getText('merchant.orders.searchPlaceholder', 'Search orders by ID, customer name, or email...')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder={getText('merchant.orders.allStatus', 'All Status')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">{getText('merchant.orders.allStatus', 'All Status')}</SelectItem>
                  <SelectItem value="PENDING">{getText('merchant.orders.pending', 'Pending')}</SelectItem>
                  <SelectItem value="PAID">{getText('merchant.orders.paid', 'Paid')}</SelectItem>
                  <SelectItem value="SHIPPED">{getText('merchant.orders.shipped', 'Shipped')}</SelectItem>
                  <SelectItem value="DELIVERED">{getText('merchant.orders.delivered', 'Delivered')}</SelectItem>
                  <SelectItem value="CANCELLED">{getText('merchant.orders.cancelled', 'Cancelled')}</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline">
                <Filter className="w-4 h-4 mr-2" />
                {getText('merchant.orders.moreFilters', 'More Filters')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>



      {/* Orders Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left py-3 px-6 font-medium text-gray-900">{getText('merchant.orders.orderId', 'Order ID')}</th>
                  <th className="text-left py-3 px-6 font-medium text-gray-900">{getText('merchant.orders.customer', 'Customer')}</th>
                  <th className="text-left py-3 px-6 font-medium text-gray-900">{getText('merchant.orders.date', 'Date')}</th>
                  <th className="text-left py-3 px-6 font-medium text-gray-900">{getText('merchant.orders.status', 'Status')}</th>
                  <th className="text-left py-3 px-6 font-medium text-gray-900">{getText('merchant.orders.payment', 'Payment')}</th>
                  <th className="text-left py-3 px-6 font-medium text-gray-900">{getText('merchant.orders.total', 'Total')}</th>
                  <th className="text-left py-3 px-6 font-medium text-gray-900">{getText('merchant.orders.items', 'Items')}</th>
                  <th className="text-left py-3 px-6 font-medium text-gray-900">{getText('merchant.orders.actions', 'Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center">
                      <div className="text-gray-500">
                        {searchTerm ? getText('merchant.orders.noOrdersMatching', 'No orders found matching your search.') : getText('merchant.orders.noOrdersFound', 'No orders found.')}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order: Order) => (
                    <tr key={order.id} className="hover:bg-gray-50">

                      <td className="py-4 px-6">
                        <div className="font-medium text-blue-600">{order.id}</div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center">
                          <div className="w-8 h-8 bg-gray-200 rounded-full mr-3 flex items-center justify-center">
                            <span className="text-sm font-medium text-gray-600">
                              {order.user?.name?.charAt(0) || 'U'}
                            </span>
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">{order.user?.name || getText('merchant.orders.unknown', 'Unknown')}</div>
                            <div className="text-sm text-gray-500">{order.user?.email || getText('merchant.orders.noEmail', 'No email')}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-gray-600">
                        {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center space-x-2">
                          <Select
                            value={order.status}
                            onValueChange={(newStatus) => handleStatusUpdate(order.id, newStatus)}
                            disabled={updateOrderStatusMutation.isPending}
                          >
                            <SelectTrigger className={`w-32 h-8 ${getStatusColor(order.status)}`}>
                              <div className="flex items-center space-x-1">
                                {getStatusIcon(order.status)}
                                <SelectValue />
                              </div>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="PENDING">{getText('merchant.orders.pending', 'Pending')}</SelectItem>
                              <SelectItem value="PAID">{getText('merchant.orders.paid', 'Paid')}</SelectItem>
                              <SelectItem value="SHIPPED">{getText('merchant.orders.shipped', 'Shipped')}</SelectItem>
                              <SelectItem value="DELIVERED">{getText('merchant.orders.delivered', 'Delivered')}</SelectItem>
                              <SelectItem value="CANCELLED">{getText('merchant.orders.cancelled', 'Cancelled')}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <Badge className={getPaymentColor('paid')}>
                          {getText('merchant.orders.paid', 'Paid')}
                        </Badge>
                      </td>
                      <td className="py-4 px-6 font-medium text-gray-900">
                        ¥{(order.totalAmount || 0).toLocaleString()}
                      </td>
                      <td className="py-4 px-6 text-gray-600">
                        {order.items?.length || 0}
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center space-x-2">
                          <Link href={`/${locale}/orders/${order.id}`}>
                            <Button variant="ghost" size="sm">
                              <Eye className="w-4 h-4" />
                            </Button>
                          </Link>

                          <Button variant="ghost" size="sm">
                            <Truck className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {pagination && (
        <div className="mt-6 flex items-center justify-between">
          <div className="text-sm text-gray-700">
            {getText('merchant.orders.showingResults', 'Showing {from} to {to} of {total} results')
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
              {getText('merchant.orders.previous', 'Previous')}
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
              {getText('merchant.orders.next', 'Next')}
            </Button>
          </div>
        </div>
      )}


    </div>
  )
}
