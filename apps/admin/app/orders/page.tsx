'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '../../components/ui/button'
import { useOrders, useUpdateOrderStatus } from '../../lib/hooks/use-api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  EyeIcon,
  PrinterIcon,
  TruckIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline'

export default function OrdersPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('All')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(10)

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

  const handleBulkExport = () => {
    // TODO: Implement bulk export functionality
    console.log('Exporting orders...')
  }

  const handleBulkShip = () => {
    // TODO: Implement bulk shipping functionality
    console.log('Bulk shipping orders...')
  }

  // Filter orders locally for immediate feedback
  const filteredOrders = orders.filter((order: any) => {
    if (!order) return false
    const matchesSearch = searchTerm === '' ||
      order.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer?.email?.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesSearch
  })

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'delivered':
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'shipped':
      case 'shipping':
        return 'bg-blue-100 text-blue-800'
      case 'processing':
        return 'bg-yellow-100 text-yellow-800'
      case 'pending':
        return 'bg-orange-100 text-orange-800'
      case 'cancelled':
      case 'canceled':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'delivered':
      case 'completed':
        return <CheckCircleIcon className="w-4 h-4" />
      case 'shipped':
      case 'shipping':
        return <TruckIcon className="w-4 h-4" />
      case 'processing':
        return <ClockIcon className="w-4 h-4" />
      case 'pending':
        return <ExclamationTriangleIcon className="w-4 h-4" />
      case 'cancelled':
      case 'canceled':
        return <XCircleIcon className="w-4 h-4" />
      default:
        return <ClockIcon className="w-4 h-4" />
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
    pending: orders.filter((order: any) => order.status?.toLowerCase() === 'pending').length,
    processing: orders.filter((order: any) => order.status?.toLowerCase() === 'processing').length,
    delivered: orders.filter((order: any) => order.status?.toLowerCase() === 'delivered').length,
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
              <ExclamationTriangleIcon className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to load orders</h3>
              <p className="text-gray-600 mb-4">There was an error loading the orders data.</p>
              <Button onClick={() => refetch()}>Try Again</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
            <p className="text-gray-600 mt-1">Manage customer orders and fulfillment</p>
          </div>
          <div className="flex space-x-3">
            <Button variant="outline" onClick={handleBulkExport}>
              <PrinterIcon className="w-4 h-4 mr-2" />
              Export
            </Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              onClick={handleBulkShip}
            >
              <TruckIcon className="w-4 h-4 mr-2" />
              Bulk Ship
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">Total Orders</p>
                <p className="text-2xl font-bold text-gray-900">{orderStats.total.toLocaleString()}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <TruckIcon className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">Pending</p>
                <p className="text-2xl font-bold text-orange-600">{orderStats.pending}</p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <ExclamationTriangleIcon className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">Processing</p>
                <p className="text-2xl font-bold text-yellow-600">{orderStats.processing}</p>
              </div>
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <ClockIcon className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">Delivered</p>
                <p className="text-2xl font-bold text-green-600">{orderStats.delivered}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircleIcon className="w-6 h-6 text-green-600" />
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
                <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search orders by ID, customer name, or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="shipped">Shipped</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline">
                <FunnelIcon className="w-4 h-4 mr-2" />
                More Filters
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
                  <th className="text-left py-3 px-6 font-medium text-gray-900">Order ID</th>
                  <th className="text-left py-3 px-6 font-medium text-gray-900">Customer</th>
                  <th className="text-left py-3 px-6 font-medium text-gray-900">Date</th>
                  <th className="text-left py-3 px-6 font-medium text-gray-900">Status</th>
                  <th className="text-left py-3 px-6 font-medium text-gray-900">Payment</th>
                  <th className="text-left py-3 px-6 font-medium text-gray-900">Total</th>
                  <th className="text-left py-3 px-6 font-medium text-gray-900">Items</th>
                  <th className="text-left py-3 px-6 font-medium text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center">
                      <div className="text-gray-500">
                        {searchTerm ? 'No orders found matching your search.' : 'No orders found.'}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order: any) => (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="py-4 px-6">
                        <div className="font-medium text-blue-600">{order.id}</div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center">
                          <div className="w-8 h-8 bg-gray-200 rounded-full mr-3 flex items-center justify-center">
                            <span className="text-sm font-medium text-gray-600">
                              {order.customer?.name?.charAt(0) || 'U'}
                            </span>
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">{order.customer?.name || 'Unknown'}</div>
                            <div className="text-sm text-gray-500">{order.customer?.email || 'No email'}</div>
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
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="processing">Processing</SelectItem>
                              <SelectItem value="shipped">Shipped</SelectItem>
                              <SelectItem value="delivered">Delivered</SelectItem>
                              <SelectItem value="cancelled">Cancelled</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <Badge className={getPaymentColor(order.paymentStatus)}>
                          {order.paymentStatus || 'Unknown'}
                        </Badge>
                      </td>
                      <td className="py-4 px-6 font-medium text-gray-900">
                        ¥{(order.total || 0).toLocaleString()}
                      </td>
                      <td className="py-4 px-6 text-gray-600">
                        {order.items?.length || 0}
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center space-x-2">
                          <Link href={`/orders/${order.id}`}>
                            <Button variant="ghost" size="sm">
                              <EyeIcon className="w-4 h-4" />
                            </Button>
                          </Link>
                          <Button variant="ghost" size="sm">
                            <PrinterIcon className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm">
                            <TruckIcon className="w-4 h-4" />
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
            Showing <span className="font-medium">{((currentPage - 1) * pageSize) + 1}</span> to{' '}
            <span className="font-medium">
              {Math.min(currentPage * pageSize, pagination.total)}
            </span> of{' '}
            <span className="font-medium">{pagination.total}</span> results
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              Previous
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
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
