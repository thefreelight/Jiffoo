/**
 * Orders Management Page - Super Admin
 * Provides order listing, filtering, single and batch status updates
 */
'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  ShoppingCartIcon,
  CreditCardIcon,
  TruckIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  RefreshCwIcon,
  SearchIcon,
  EyeIcon,
  EditIcon,
  ChevronLeftIcon,
  ChevronRightIcon
} from 'lucide-react'
import { orderManagementApi } from '@/lib/api'

interface Order {
  id: string
  userId: string
  status: 'PENDING' | 'PAID' | 'CANCELLED' | 'SHIPPED' | 'DELIVERED'
  totalAmount: number
  createdAt: string
  updatedAt: string
  items: Array<{
    id: string
    productId: string
    quantity: number
    unitPrice: number
    product: {
      id: string
      name: string
      images: string
    }
  }>
  user?: {
    id: string
    username: string
    email: string
  }
}

interface OrderStats {
  totalOrders: number
  pendingOrders: number
  completedOrders: number
  cancelledOrders: number
  totalRevenue: number
  averageOrderValue: number
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [stats, setStats] = useState<OrderStats>({
    totalOrders: 0,
    pendingOrders: 0,
    completedOrders: 0,
    cancelledOrders: 0,
    totalRevenue: 0,
    averageOrderValue: 0
  })
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false)
  const [updateData, setUpdateData] = useState({
    status: '',
    trackingNumber: '',
    notes: ''
  })
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  })

  // Batch operation states
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([])
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false)
  const [batchStatus, setBatchStatus] = useState('')
  const [batchProcessing, setBatchProcessing] = useState(false)

  useEffect(() => {
    loadOrders()
    loadStats()
  }, [])

  // 当搜索或过滤条件改变时，重新加载订单
  useEffect(() => {
    setPagination(prev => ({ ...prev, page: 1 }))
    loadOrders()
  }, [searchTerm, statusFilter])

  const loadOrders = async (page: number = 1) => {
    try {
      setLoading(true)
      // 构建查询参数
      const params: any = {
        page,
        limit: pagination.limit,
        search: searchTerm || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined
      }

      const response = await orderManagementApi.getAllOrders(params)
      // 处理 API 响应数据结构
      const ordersData = Array.isArray(response.data) ? response.data : (response.data?.data || response.data?.orders || [])
      setOrders(ordersData)

      // 更新分页信息
      if (response.data?.pagination) {
        setPagination({
          page: response.data.pagination.page || page,
          limit: response.data.pagination.limit || pagination.limit,
          total: response.data.pagination.total || ordersData.length,
          totalPages: response.data.pagination.totalPages || Math.ceil((response.data.pagination.total || ordersData.length) / pagination.limit)
        })
      }
    } catch (error) {
      console.error('Failed to load orders:', error)
      // 如果 API 调用失败，显示空列表
      setOrders([])
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      // 使用真实的订单统计 API
      const response = await orderManagementApi.getOrderStats()
      if (response.success && response.data) {
        // Map API response to frontend OrderStats interface
        const apiData = response.data
        const ordersByStatus = apiData.ordersByStatus || {}
        const totalOrders = apiData.totalOrders || 0
        const totalRevenue = apiData.totalRevenue || 0

        setStats({
          totalOrders,
          pendingOrders: ordersByStatus.PENDING || 0,
          completedOrders: ordersByStatus.DELIVERED || 0,
          cancelledOrders: ordersByStatus.CANCELLED || 0,
          totalRevenue,
          averageOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0
        })
      } else {
        // 如果 API 调用失败，显示空状态
        setStats({
          totalOrders: 0,
          pendingOrders: 0,
          completedOrders: 0,
          cancelledOrders: 0,
          totalRevenue: 0,
          averageOrderValue: 0
        })
      }
    } catch (error) {
      console.error('Failed to load order stats:', error)
      // 如果 API 调用失败，显示空状态
      setStats({
        totalOrders: 0,
        pendingOrders: 0,
        completedOrders: 0,
        cancelledOrders: 0,
        totalRevenue: 0,
        averageOrderValue: 0
      })
    }
  }

  const handleUpdateOrder = async () => {
    if (!selectedOrder) return

    try {
      await orderManagementApi.updateOrderStatus(
        selectedOrder.id,
        updateData.status
      )

      // Refresh orders
      await loadOrders()
      setIsUpdateModalOpen(false)
      setSelectedOrder(null)
      alert('Order updated successfully!')
    } catch (error) {
      console.error('Failed to update order:', error)
      alert('Failed to update order. Please try again.')
    }
  }

  // Batch operations
  const toggleOrderSelection = (orderId: string) => {
    setSelectedOrderIds(prev =>
      prev.includes(orderId)
        ? prev.filter(id => id !== orderId)
        : [...prev, orderId]
    )
  }

  const selectAllOrders = () => {
    if (selectedOrderIds.length === filteredOrders.length) {
      setSelectedOrderIds([])
    } else {
      setSelectedOrderIds(filteredOrders.map(o => o.id))
    }
  }

  const clearSelection = () => {
    setSelectedOrderIds([])
  }

  const handleBatchStatusUpdate = async () => {
    if (selectedOrderIds.length === 0 || !batchStatus) return

    setBatchProcessing(true)
    try {
      await orderManagementApi.batchUpdateOrderStatus(selectedOrderIds, batchStatus)

      // Refresh orders
      await loadOrders()
      await loadStats()
      setIsBatchModalOpen(false)
      setBatchStatus('')
      setSelectedOrderIds([])
      alert(`Successfully updated ${selectedOrderIds.length} orders!`)
    } catch (error) {
      console.error('Failed to batch update orders:', error)
      alert('Failed to update orders. Please try again.')
    } finally {
      setBatchProcessing(false)
    }
  }

  const handleBatchCancel = async () => {
    if (selectedOrderIds.length === 0) return
    if (!confirm(`Are you sure you want to cancel ${selectedOrderIds.length} orders?`)) return

    setBatchProcessing(true)
    try {
      await orderManagementApi.batchOperations({
        action: 'cancel',
        orderIds: selectedOrderIds
      })

      await loadOrders()
      await loadStats()
      setSelectedOrderIds([])
      alert(`Successfully cancelled ${selectedOrderIds.length} orders!`)
    } catch (error) {
      console.error('Failed to batch cancel orders:', error)
      alert('Failed to cancel orders. Please try again.')
    } finally {
      setBatchProcessing(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PENDING': return <ClockIcon className="h-4 w-4" />
      case 'PAID': return <CreditCardIcon className="h-4 w-4" />
      case 'SHIPPED': return <TruckIcon className="h-4 w-4" />
      case 'DELIVERED': return <CheckCircleIcon className="h-4 w-4" />
      case 'CANCELLED': return <XCircleIcon className="h-4 w-4" />
      default: return <ClockIcon className="h-4 w-4" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'bg-yellow-100 text-yellow-800'
      case 'PAID': return 'bg-blue-100 text-blue-800'
      case 'SHIPPED': return 'bg-purple-100 text-purple-800'
      case 'DELIVERED': return 'bg-green-100 text-green-800'
      case 'CANCELLED': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         order.user?.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         order.user?.username.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter
    
    return matchesSearch && matchesStatus
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Order Management</h1>
          <p className="text-muted-foreground">Monitor and manage all platform orders</p>
        </div>
        <Button onClick={() => loadOrders()} disabled={loading}>
          <RefreshCwIcon className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <ShoppingCartIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalOrders.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <ClockIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingOrders}</div>
            <p className="text-xs text-muted-foreground">Awaiting processing</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircleIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completedOrders.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Successfully delivered</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cancelled</CardTitle>
            <XCircleIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.cancelledOrders}</div>
            <p className="text-xs text-muted-foreground">Order cancellations</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <CreditCardIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.totalRevenue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">All time revenue</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Order Value</CardTitle>
            <TruckIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.averageOrderValue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Per order</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search orders by ID, customer email, or username..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="PAID">Paid</SelectItem>
            <SelectItem value="SHIPPED">Shipped</SelectItem>
            <SelectItem value="DELIVERED">Delivered</SelectItem>
            <SelectItem value="CANCELLED">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Batch Operations Toolbar */}
      {selectedOrderIds.length > 0 && (
        <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <span className="text-sm font-medium text-blue-700">
            {selectedOrderIds.length} order(s) selected
          </span>
          <div className="flex-1" />
          <Button size="sm" variant="outline" onClick={() => setIsBatchModalOpen(true)}>
            <EditIcon className="h-4 w-4 mr-1" />
            Change Status
          </Button>
          <Button size="sm" variant="destructive" onClick={handleBatchCancel} disabled={batchProcessing}>
            <XCircleIcon className="h-4 w-4 mr-1" />
            Cancel Orders
          </Button>
          <Button size="sm" variant="ghost" onClick={clearSelection}>
            Clear Selection
          </Button>
        </div>
      )}

      {/* Orders List */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Orders</CardTitle>
          <CardDescription>
            {filteredOrders.length} orders found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCwIcon className="h-6 w-6 animate-spin" />
              <span className="ml-2">Loading orders...</span>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-8">
              <ShoppingCartIcon className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-2 text-gray-500">No orders found</p>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Select All Header */}
              <div className="flex items-center gap-4 p-2 bg-gray-50 rounded-lg">
                <Checkbox
                  checked={selectedOrderIds.length === filteredOrders.length && filteredOrders.length > 0}
                  onCheckedChange={selectAllOrders}
                />
                <span className="text-sm font-medium text-gray-600">Select All</span>
              </div>

              {filteredOrders.map((order) => (
                <div key={order.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <Checkbox
                      checked={selectedOrderIds.includes(order.id)}
                      onCheckedChange={() => toggleOrderSelection(order.id)}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">Order #{order.id.slice(0, 8)}...</p>
                        <Badge className={getStatusColor(order.status)}>
                          {getStatusIcon(order.status)}
                          <span className="ml-1">{order.status}</span>
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-500">
                        {order.user?.username || 'Unknown'} ({order.user?.email || 'N/A'})
                      </p>
                      <p className="text-sm text-gray-500">
                        {new Date(order.createdAt).toLocaleDateString()} • {order.items?.length || 0} item(s) • ${order.totalAmount?.toFixed(2) || '0.00'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedOrder(order)}
                        title="View Details"
                      >
                        <EyeIcon className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedOrder(order)
                          setUpdateData({
                            status: order.status,
                            trackingNumber: '',
                            notes: ''
                          })
                          setIsUpdateModalOpen(true)
                        }}
                        title="Edit Status"
                      >
                        <EditIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-muted-foreground">Per page:</span>
                    <select
                      value={pagination.limit}
                      onChange={(e) => setPagination(prev => ({ ...prev, limit: parseInt(e.target.value), page: 1 }))}
                      className="px-2 py-1 border border-gray-300 rounded text-sm"
                    >
                      <option value="10">10</option>
                      <option value="20">20</option>
                      <option value="50">50</option>
                      <option value="100">100</option>
                    </select>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const newPage = pagination.page - 1
                        setPagination(prev => ({ ...prev, page: newPage }))
                        loadOrders(newPage)
                      }}
                      disabled={pagination.page === 1}
                    >
                      <ChevronLeftIcon className="h-4 w-4" />
                    </Button>

                    <span className="text-sm text-muted-foreground">
                      Page {pagination.page} of {pagination.totalPages}
                    </span>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const newPage = pagination.page + 1
                        setPagination(prev => ({ ...prev, page: newPage }))
                        loadOrders(newPage)
                      }}
                      disabled={pagination.page >= pagination.totalPages}
                    >
                      <ChevronRightIcon className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Update Order Modal */}
      <Dialog open={isUpdateModalOpen} onOpenChange={setIsUpdateModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Order Status</DialogTitle>
            <DialogDescription>
              Update the status and details for order #{selectedOrder?.id?.slice(0, 8)}...
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="status">Status</Label>
              <Select value={updateData.status} onValueChange={(value) =>
                setUpdateData(prev => ({ ...prev, status: value }))
              }>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="PAID">Paid</SelectItem>
                  <SelectItem value="SHIPPED">Shipped</SelectItem>
                  <SelectItem value="DELIVERED">Delivered</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="trackingNumber">Tracking Number (Optional)</Label>
              <Input
                id="trackingNumber"
                value={updateData.trackingNumber}
                onChange={(e) => setUpdateData(prev => ({ ...prev, trackingNumber: e.target.value }))}
                placeholder="Enter tracking number"
              />
            </div>
            <div>
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={updateData.notes}
                onChange={(e) => setUpdateData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Add any notes about this update"
                rows={3}
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setIsUpdateModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpdateOrder}>
                Update Order
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Batch Status Update Modal */}
      <Dialog open={isBatchModalOpen} onOpenChange={setIsBatchModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Batch Update Order Status</DialogTitle>
            <DialogDescription>
              Update the status for {selectedOrderIds.length} selected order(s).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="batchStatus">New Status</Label>
              <Select value={batchStatus} onValueChange={setBatchStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Select new status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="PAID">Paid</SelectItem>
                  <SelectItem value="SHIPPED">Shipped</SelectItem>
                  <SelectItem value="DELIVERED">Delivered</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBatchModalOpen(false)} disabled={batchProcessing}>
              Cancel
            </Button>
            <Button onClick={handleBatchStatusUpdate} disabled={batchProcessing || !batchStatus}>
              {batchProcessing ? 'Processing...' : 'Update Orders'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
