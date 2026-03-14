/**
 * Orders Page for Tenant Application
 *
 * Displays order list with search, filter, batch operations and pagination.
 * Supports i18n through the translation function.
 * Uses in-page navigation instead of sidebar submenu (Shopify style).
 */

'use client'

import { AlertTriangle, CheckCircle, Clock, Search, Truck, XCircle, TrendingUp, Box } from 'lucide-react'
import { formatCurrency, cn } from '@/lib/utils'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useOrders, useOrderStats, useUpdateOrderStatus, useCancelOrder, type Order } from '@/lib/hooks/use-api'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { PageNav } from '@/components/layout/page-nav'
import { StatsCard } from '@/components/dashboard/stats-card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useT, useLocale } from 'shared/src/i18n/react'

export default function OrdersPage() {
  const t = useT()
  const locale = useLocale()
  const router = useRouter()

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    if (!t) return fallback
    const translated = t(key)
    return translated === key ? fallback : translated
  }

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
  const cancelOrderMutation = useCancelOrder()
  const { data: orderStatsData } = useOrderStats()

  const orders = ordersData?.data || []
  const pagination = ordersData?.pagination

  const handleStatusUpdate = async (orderId: string, newStatus: string) => {
    try {
      await updateOrderStatusMutation.mutateAsync({ id: orderId, status: newStatus })
      refetch()
      toast.success(getText('merchant.orders.statusUpdated', 'Status updated'))
    } catch (_error) {
      // Error toast is already handled by the mutation hook.
    }
  }

  const handleCancelOrder = async (orderId: string) => {
    const cancelReason = window.prompt(getText('merchant.orders.cancelReasonPrompt', 'Enter cancellation reason'), '') || ''
    if (!cancelReason.trim()) return

    try {
      await cancelOrderMutation.mutateAsync({ id: orderId, cancelReason: cancelReason.trim() })
      refetch()
      toast.success(getText('merchant.orders.cancelled', 'Order cancelled'))
    } catch (_error) {
      // Error toast is already handled by the mutation hook.
    }
  }

  const getStatusColor = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'DELIVERED':
        return 'border-green-100 text-green-600 bg-green-50/50'
      case 'SHIPPED':
        return 'border-blue-100 text-blue-600 bg-blue-50/50'
      case 'PROCESSING':
        return 'border-purple-100 text-purple-600 bg-purple-50/50'
      case 'PAID':
        return 'border-yellow-100 text-yellow-600 bg-yellow-50/50'
      case 'PENDING':
        return 'border-orange-100 text-orange-600 bg-orange-50/50'
      case 'CANCELLED':
        return 'border-red-100 text-red-600 bg-red-50/50'
      case 'REFUNDED':
        return 'border-gray-100 text-gray-600 bg-gray-50/50'
      default:
        return 'border-gray-100 text-gray-600 bg-gray-50/50'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'DELIVERED':
        return <CheckCircle className="w-3.5 h-3.5" />
      case 'SHIPPED':
        return <Truck className="w-3.5 h-3.5" />
      case 'PROCESSING':
        return <Clock className="w-3.5 h-3.5" />
      case 'PAID':
        return <CheckCircle className="w-3.5 h-3.5" />
      case 'PENDING':
        return <AlertTriangle className="w-3.5 h-3.5" />
      case 'CANCELLED':
        return <XCircle className="w-3.5 h-3.5" />
      case 'REFUNDED':
        return <XCircle className="w-3.5 h-3.5" />
      default:
        return <Clock className="w-3.5 h-3.5" />
    }
  }

  const toTrendDisplay = (value: number | undefined) => {
    const trendValue = value ?? 0
    return {
      change: `${Math.abs(trendValue).toFixed(2)}%`,
      changeType: trendValue >= 0 ? 'increase' as const : 'decrease' as const,
    }
  }

  // Global stats from dedicated stats endpoint
  const orderStats = {
    total: orderStatsData?.metrics.totalOrders || 0,
    paid: orderStatsData?.metrics.paidOrders || 0,
    shipped: orderStatsData?.metrics.shippedOrders || 0,
    refunded: orderStatsData?.metrics.refundedOrders || 0,
    totalRevenue: orderStatsData?.metrics.totalRevenue || 0,
    currency: orderStatsData?.metrics.currency || 'USD',
    totalTrend: orderStatsData?.metrics.totalOrdersTrend,
    paidTrend: orderStatsData?.metrics.paidOrdersTrend,
    shippedTrend: orderStatsData?.metrics.shippedOrdersTrend,
    refundedTrend: orderStatsData?.metrics.refundedOrdersTrend,
    revenueTrend: orderStatsData?.metrics.totalRevenueTrend,
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-400 font-bold text-[10px] uppercase tracking-widest">{getText('merchant.orders.loading', 'Loading Transaction Data...')}</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <p className="text-gray-900 font-bold">{getText('merchant.orders.loadFailed', 'Signal Interference Detected')}</p>
          <Button
            variant="outline"
            className="rounded-xl border-gray-200"
            onClick={() => refetch()}
          >
            {getText('merchant.orders.retry', 'Reconnect Signal')}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full bg-[#fcfdfe] min-h-screen">
      {/* Header Bar */}
      <div className="border-b border-gray-100 pl-20 pr-8 lg:px-8 py-4 sticky top-0 bg-white/80 backdrop-blur-md z-50 flex items-center justify-between">
        <div className="flex flex-col">
          <h1 className="text-xl font-bold text-gray-900 tracking-tight leading-none">
            {getText('merchant.orders.title', 'Orders')}
          </h1>
          <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mt-1">
            Transaction Ledger Node
          </span>
        </div>
      </div>

      <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-6">
        {/* Welcome Section */}
        <div className="space-y-1">
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">{getText('merchant.orders.overview', 'Transaction Matrix')}</h2>
          <p className="text-gray-400 text-sm font-medium">{getText('merchant.orders.subtitle', 'Manage customer orders and fulfillment')}</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatsCard
            title={getText('merchant.orders.totalOrders', 'Total Orders')}
            value={orderStats.total.toLocaleString()}
            change={toTrendDisplay(orderStats.totalTrend).change}
            changeType={toTrendDisplay(orderStats.totalTrend).changeType}
            comparisonLabel={getText('merchant.dashboard.vsYesterday', 'vs yesterday')}
            color="blue"
            icon={<Box className="w-5 h-5" />}
          />
          <StatsCard
            title={getText('merchant.orders.paid', 'Paid')}
            value={orderStats.paid.toString()}
            change={toTrendDisplay(orderStats.paidTrend).change}
            changeType={toTrendDisplay(orderStats.paidTrend).changeType}
            comparisonLabel={getText('merchant.dashboard.vsYesterday', 'vs yesterday')}
            color="green"
            icon={<CheckCircle className="w-5 h-5" />}
          />
          <StatsCard
            title={getText('merchant.orders.shipped', 'Shipped')}
            value={orderStats.shipped.toString()}
            change={toTrendDisplay(orderStats.shippedTrend).change}
            changeType={toTrendDisplay(orderStats.shippedTrend).changeType}
            comparisonLabel={getText('merchant.dashboard.vsYesterday', 'vs yesterday')}
            color="purple"
            icon={<Truck className="w-5 h-5" />}
          />
          <StatsCard
            title={getText('merchant.orders.refunded', 'Refunded')}
            value={orderStats.refunded.toString()}
            change={toTrendDisplay(orderStats.refundedTrend).change}
            changeType={toTrendDisplay(orderStats.refundedTrend).changeType}
            comparisonLabel={getText('merchant.dashboard.vsYesterday', 'vs yesterday')}
            color="red"
            icon={<XCircle className="w-5 h-5" />}
          />
        </div>

        {/* Revenue Card */}
        <div className="bg-gray-900 rounded-[2.5rem] p-10 text-white relative overflow-hidden group shadow-xl">
          <div className="absolute top-0 right-0 p-12 opacity-5 scale-110 -translate-y-4 translate-x-4">
            <TrendingUp className="w-48 h-48 -rotate-12" />
          </div>
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="space-y-4">
              <div className="space-y-1">
                <span className="text-blue-400 text-[10px] font-black uppercase tracking-[0.3em]">
                  {getText('merchant.orders.totalRevenue', 'Total Revenue')}
                </span>
                <div className="text-5xl md:text-6xl font-black tracking-tighter text-blue-400 italic">
                  {formatCurrency(orderStats.totalRevenue, orderStats.currency)}
                </div>
              </div>
              {orderStats.revenueTrend !== undefined && (
                <div className="flex items-center gap-2 text-gray-400 text-[10px] font-bold tracking-widest uppercase bg-white/5 px-4 py-2 rounded-full border border-white/5 inline-flex">
                  {toTrendDisplay(orderStats.revenueTrend).changeType === 'increase' ? (
                    <TrendingUp className="w-4 h-4 text-green-500" />
                  ) : (
                    <TrendingUp className="w-4 h-4 rotate-180 text-red-500" />
                  )}
                  <span className={toTrendDisplay(orderStats.revenueTrend).changeType === 'increase' ? 'text-green-400' : 'text-red-400'}>
                    {toTrendDisplay(orderStats.revenueTrend).change}
                  </span>
                  <span>{getText('merchant.dashboard.vsYesterday', 'vs yesterday')}</span>
                </div>
              )}
            </div>
            <div className="w-20 h-20 bg-white/10 rounded-2xl flex items-center justify-center">
              <TrendingUp className="w-10 h-10 text-white" />
            </div>
          </div>
        </div>

        {/* Filters and Table Section */}
        <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-8 border-b border-gray-50 flex flex-col lg:flex-row gap-6 items-start lg:items-center justify-between">
            <div className="flex-1 w-full max-w-md relative">
              <Search className="w-4 h-4 absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <Input
                placeholder={getText('merchant.orders.searchPlaceholder', 'Filter by ID, Customer...')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-11 h-11 rounded-xl bg-gray-50/50 border-gray-100 focus:bg-white transition-all text-sm"
              />
            </div>
            <div className="flex items-center gap-3 w-full lg:w-auto">
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="h-11 min-w-[180px] bg-gray-50 border-gray-50 rounded-2xl focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 flex items-center px-6 text-sm font-bold text-gray-700">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-gray-100 shadow-2xl p-2">
                  <SelectItem value="All" className="rounded-xl py-2.5 font-semibold">{getText('merchant.orders.allStatus', 'All Status')}</SelectItem>
                  <SelectItem value="PENDING" className="rounded-xl py-2.5 font-semibold">{getText('merchant.orders.pending', 'Pending')}</SelectItem>
                  <SelectItem value="PAID" className="rounded-xl py-2.5 font-semibold">{getText('merchant.orders.paid', 'Paid')}</SelectItem>
                  <SelectItem value="PROCESSING" className="rounded-xl py-2.5 font-semibold">{getText('merchant.orders.processing', 'Processing')}</SelectItem>
                  <SelectItem value="SHIPPED" className="rounded-xl py-2.5 font-semibold">{getText('merchant.orders.shipped', 'Shipped')}</SelectItem>
                  <SelectItem value="DELIVERED" className="rounded-xl py-2.5 font-semibold">{getText('merchant.orders.delivered', 'Delivered')}</SelectItem>
                  <SelectItem value="CANCELLED" className="rounded-xl py-2.5 font-semibold">{getText('merchant.orders.cancelled', 'Cancelled')}</SelectItem>
                  <SelectItem value="REFUNDED" className="rounded-xl py-2.5 font-semibold">{getText('merchant.orders.refunded', 'Refunded')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-gray-50/30">
                  <th className="py-4 px-8 text-[10px] font-bold text-gray-400 uppercase tracking-widest w-[25%]">{getText('merchant.orders.orderId', 'Ident')}</th>
                  <th className="py-4 px-6 text-[10px] font-bold text-gray-400 uppercase tracking-widest w-[30%]">{getText('merchant.orders.customer', 'Source')}</th>
                  <th className="py-4 px-6 text-[10px] font-bold text-gray-400 uppercase tracking-widest w-[15%]">{getText('merchant.orders.status', 'Status')}</th>
                  <th className="py-4 px-6 text-[10px] font-bold text-gray-400 uppercase tracking-widest w-[15%]">{getText('merchant.orders.total', 'Volume')}</th>
                  <th className="py-4 px-6 text-[10px] font-bold text-gray-400 uppercase tracking-widest w-[15%]">{getText('merchant.orders.date', 'Timestamp')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-20 text-center">
                      <div className="flex flex-col items-center opacity-30">
                        <Box className="w-12 h-12 mb-3 text-gray-300" />
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em]">{getText('merchant.orders.noOrdersFound', 'Ledger Empty')}</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  orders.map((order: Order) => (
                    <tr key={order.id} className="group hover:bg-blue-50/30 transition-colors cursor-pointer" onClick={() => router.push(`/${locale}/orders/${order.id}`)}>
                      <td className="py-4 px-8">
                        <div className="flex flex-col">
                          <span className="font-mono text-sm font-bold text-blue-600">
                            #{order.id.substring(0, 13).toUpperCase()}
                          </span>
                          <span className="text-[10px] text-gray-400 font-medium">...{order.id.slice(-12)}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-[10px] font-black text-gray-400 group-hover:bg-white transition-colors">
                            {order.customer.username?.charAt(0) || order.customer.email?.charAt(0) || 'U'}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-bold text-gray-900 text-sm">{order.customer.username || 'Anonymous User'}</span>
                            <span className="text-xs text-gray-400 font-medium">{order.customer.email || 'no-email'}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <Select
                          value={order.status}
                          onValueChange={(newStatus) => {
                            handleStatusUpdate(order.id, newStatus)
                          }}
                          disabled={updateOrderStatusMutation.isPending}
                        >
                          <SelectTrigger className={cn(
                            "h-10 min-w-[140px] bg-gray-50 border-gray-50 rounded-2xl focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 flex items-center px-4 text-[10px] font-bold uppercase tracking-widest transition-all",
                            getStatusColor(order.status)
                          )}
                          onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center space-x-2">
                              {getStatusIcon(order.status)}
                              <SelectValue />
                            </div>
                          </SelectTrigger>
                          <SelectContent className="rounded-2xl border-gray-100 shadow-2xl p-2">
                            <SelectItem value="PENDING" className="rounded-xl py-2.5 font-semibold text-[10px] uppercase tracking-widest">{getText('merchant.orders.pending', 'Pending')}</SelectItem>
                            <SelectItem value="PAID" className="rounded-xl py-2.5 font-semibold text-[10px] uppercase tracking-widest">{getText('merchant.orders.paid', 'Paid')}</SelectItem>
                            <SelectItem value="PROCESSING" className="rounded-xl py-2.5 font-semibold text-[10px] uppercase tracking-widest">{getText('merchant.orders.processing', 'Processing')}</SelectItem>
                            <SelectItem value="SHIPPED" className="rounded-xl py-2.5 font-semibold text-[10px] uppercase tracking-widest">{getText('merchant.orders.shipped', 'Shipped')}</SelectItem>
                            <SelectItem value="DELIVERED" className="rounded-xl py-2.5 font-semibold text-[10px] uppercase tracking-widest">{getText('merchant.orders.delivered', 'Delivered')}</SelectItem>
                            <SelectItem value="CANCELLED" className="rounded-xl py-2.5 font-semibold text-[10px] uppercase tracking-widest">{getText('merchant.orders.cancelled', 'Cancelled')}</SelectItem>
                            <SelectItem value="REFUNDED" className="rounded-xl py-2.5 font-semibold text-[10px] uppercase tracking-widest">{getText('merchant.orders.refunded', 'Refunded')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex flex-col">
                          <span className="font-bold text-gray-900 text-sm">{formatCurrency(order.totalAmount || 0, order.currency)}</span>
                          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">{order.itemsCount ?? 0} ITEMS</span>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className="text-xs text-gray-500 font-medium">
                          {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : 'N/A'}
                        </span>
                      </td>
                    </tr>
                  )
                  ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Section */}
          {pagination && (
            <div className="px-8 py-6 border-t border-gray-50 bg-gray-50/10 flex items-center justify-between">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                {getText('merchant.orders.showingResults', 'Showing {from} to {to} of {total}')
                  .replace('{from}', String((currentPage - 1) * pageSize + 1))
                  .replace('{to}', String(Math.min(currentPage * pageSize, pagination.total)))
                  .replace('{total}', String(pagination.total))}
              </span>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="h-8 rounded-lg border-gray-200 text-xs font-bold"
                >
                  Prev
                </Button>
                <div className="flex items-center px-4 text-xs font-black text-gray-900">
                  {currentPage} <span className="mx-2 text-gray-300">/</span> {pagination.totalPages}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(pagination.totalPages, prev + 1))}
                  disabled={currentPage === pagination.totalPages}
                  className="h-8 rounded-lg border-gray-200 text-xs font-bold"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
