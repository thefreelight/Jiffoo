/**
 * Orders Page for the Admin Application
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
import { useOrders, useOrderStats, type Order } from '@/lib/hooks/use-api'
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

  const { data: orderStatsData } = useOrderStats()

  const orders = ordersData?.data || []
  const pagination = ordersData?.pagination

  const getStatusColor = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'DELIVERED':
        return 'border-success-faint text-success-strong bg-success-veil/50'
      case 'SHIPPED':
        return 'border-action-faint text-action-strong bg-action-veil/50'
      case 'PROCESSING':
        return 'border-highlight-faint text-highlight-strong bg-highlight-veil/50'
      case 'PENDING':
        return 'border-caution-faint text-caution-strong bg-caution-veil/50'
      case 'CANCELLED':
        return 'border-danger-faint text-danger-strong bg-danger-veil/50'
      case 'REFUNDED':
        return 'border-neutral-faint text-neutral-strong bg-neutral-veil/50'
      default:
        return 'border-neutral-faint text-neutral-strong bg-neutral-veil/50'
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
  const visibleOrderCount = orders.length
  const pendingVisibleCount = orders.filter((order) => order.status?.toUpperCase() === 'PENDING').length

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-action-strong mx-auto"></div>
          <p className="mt-4 text-neutral-light font-bold text-[10px] uppercase tracking-widest">{getText('merchant.orders.loading', 'Loading Transaction Data...')}</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-danger-veil rounded-2xl flex items-center justify-center mx-auto">
            <AlertTriangle className="w-8 h-8 text-danger-base" />
          </div>
          <p className="text-neutral-deepest font-bold">{getText('merchant.orders.loadFailed', 'Signal Interference Detected')}</p>
          <Button
            variant="outline"
            className="rounded-xl border-neutral-soft"
            onClick={() => refetch()}
          >
            {getText('merchant.orders.retry', 'Reconnect Signal')}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full bg-page-surface min-h-screen">
      {/* Header Bar */}
      <div className="sticky top-0 z-50 flex items-center justify-between border-b border-neutral-faint bg-surface/80 py-4 pl-4 pr-4 backdrop-blur-md sm:pl-20 sm:pr-8 lg:px-8">
        <div className="flex flex-col">
          <h1 className="text-xl font-bold text-neutral-deepest tracking-tight leading-none">
            {getText('merchant.orders.title', 'Orders')}
          </h1>
          <span className="text-[10px] font-bold text-action-strong uppercase tracking-widest mt-1">
            Transaction Ledger Node
          </span>
        </div>
      </div>

      <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-6">
        {/* Welcome Section */}
        <div className="space-y-1">
          <h2 className="text-2xl font-black text-neutral-deepest tracking-tight">{getText('merchant.orders.overview', 'Transaction Matrix')}</h2>
          <p className="text-neutral-light text-sm font-medium">{getText('merchant.orders.subtitle', 'Manage customer orders and fulfillment')}</p>
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
        <div className="group relative overflow-hidden rounded-[2.5rem] bg-neutral-deepest p-6 text-surface shadow-xl sm:p-10">
          <div className="absolute top-0 right-0 p-12 opacity-5 scale-110 -translate-y-4 translate-x-4">
            <TrendingUp className="w-48 h-48 -rotate-12" />
          </div>
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="space-y-4">
              <div className="space-y-1">
                <span className="text-action-light text-[10px] font-black uppercase tracking-[0.3em]">
                  {getText('merchant.orders.totalRevenue', 'Total Revenue')}
                </span>
                <div className="text-5xl md:text-6xl font-black tracking-tighter text-action-light italic">
                  {formatCurrency(orderStats.totalRevenue, orderStats.currency)}
                </div>
              </div>
              {orderStats.revenueTrend !== undefined && (
                <div className="flex items-center gap-2 text-neutral-light text-[10px] font-bold tracking-widest uppercase bg-surface/5 px-4 py-2 rounded-full border border-surface/5 inline-flex">
                  {toTrendDisplay(orderStats.revenueTrend).changeType === 'increase' ? (
                    <TrendingUp className="w-4 h-4 text-success-base" />
                  ) : (
                    <TrendingUp className="w-4 h-4 rotate-180 text-danger-base" />
                  )}
                  <span className={toTrendDisplay(orderStats.revenueTrend).changeType === 'increase' ? 'text-success-light' : 'text-danger-light'}>
                    {toTrendDisplay(orderStats.revenueTrend).change}
                  </span>
                  <span>{getText('merchant.dashboard.vsYesterday', 'vs yesterday')}</span>
                </div>
              )}
            </div>
            <div className="w-20 h-20 bg-surface/10 rounded-2xl flex items-center justify-center">
              <TrendingUp className="w-10 h-10 text-surface" />
            </div>
          </div>
        </div>

        {/* Filters and Table Section */}
        <div className="bg-surface rounded-[2rem] border border-neutral-faint shadow-sm overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-neutral-faint px-4 py-4 sm:px-8">
            <span className="inline-flex items-center rounded-full border border-action-faint bg-action-veil px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-action-strong">
              {pagination?.total ?? visibleOrderCount} {getText('merchant.orders.totalOrders', 'Orders')}
            </span>
            {pendingVisibleCount > 0 && (
              <span className="inline-flex items-center rounded-full border border-caution-faint bg-caution-veil px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-caution-strong">
                {pendingVisibleCount} {getText('merchant.orders.pending', 'Pending')}
              </span>
            )}
            <span className="inline-flex items-center rounded-full border border-neutral-faint bg-neutral-veil px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-base">
              {selectedStatus === 'All'
                ? getText('merchant.orders.allStatus', 'All Status')
                : selectedStatus}
            </span>
            {searchTerm && (
              <span className="inline-flex items-center rounded-full border border-neutral-soft bg-surface px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-base">
                Search: {searchTerm}
              </span>
            )}
          </div>

          <div className="flex flex-col items-start justify-between gap-6 border-b border-neutral-veil p-4 sm:p-8 lg:flex-row lg:items-center">
            <div className="flex-1 w-full max-w-md relative">
              <Search className="w-4 h-4 absolute left-4 top-1/2 transform -translate-y-1/2 text-neutral-light" />
              <Input
                placeholder={getText('merchant.orders.searchPlaceholder', 'Filter by ID, Customer...')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-11 h-11 rounded-xl bg-neutral-veil/50 border-neutral-faint focus:bg-surface transition-all text-sm"
              />
            </div>
            <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center lg:w-auto">
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="h-11 w-full min-w-0 bg-neutral-veil border-neutral-veil rounded-2xl px-6 text-sm font-bold text-neutral-deep focus:border-action-base focus:ring-2 focus:ring-action-base/10 sm:min-w-[180px] sm:w-auto">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-neutral-faint shadow-2xl p-2">
                  <SelectItem value="All" className="rounded-xl py-2.5 font-semibold">{getText('merchant.orders.allStatus', 'All Status')}</SelectItem>
                  <SelectItem value="PENDING" className="rounded-xl py-2.5 font-semibold">{getText('merchant.orders.pending', 'Pending')}</SelectItem>
                  <SelectItem value="PROCESSING" className="rounded-xl py-2.5 font-semibold">{getText('merchant.orders.processing', 'Processing')}</SelectItem>
                  <SelectItem value="SHIPPED" className="rounded-xl py-2.5 font-semibold">{getText('merchant.orders.shipped', 'Shipped')}</SelectItem>
                  <SelectItem value="DELIVERED" className="rounded-xl py-2.5 font-semibold">{getText('merchant.orders.delivered', 'Delivered')}</SelectItem>
                  <SelectItem value="CANCELLED" className="rounded-xl py-2.5 font-semibold">{getText('merchant.orders.cancelled', 'Cancelled')}</SelectItem>
                  <SelectItem value="REFUNDED" className="rounded-xl py-2.5 font-semibold">{getText('merchant.orders.refunded', 'Refunded')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="divide-y divide-neutral-faint md:hidden">
            {orders.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <Box className="mx-auto mb-3 h-10 w-10 text-neutral-pale" />
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-neutral-light">
                  {getText('merchant.orders.noOrdersFound', 'Ledger Empty')}
                </p>
              </div>
            ) : (
              orders.map((order: Order) => (
                <div key={order.id} className="space-y-4 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-mono text-sm font-bold text-action-strong">
                        #{order.id.substring(0, 13).toUpperCase()}
                      </p>
                      <p className="mt-1 text-[11px] font-medium text-neutral-light">
                        ...{order.id.slice(-12)}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-neutral-veil px-3 py-2 text-right">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-light">
                        {getText('merchant.orders.total', 'Volume')}
                      </p>
                      <p className="mt-1 text-sm font-bold text-neutral-deepest">
                        {formatCurrency(order.totalAmount || 0, order.currency)}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-neutral-veil/70 p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface text-xs font-black text-neutral-light shadow-sm">
                        {order.customer.username?.charAt(0) || order.customer.email?.charAt(0) || 'U'}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-neutral-deepest">
                          {order.customer.username || 'Anonymous User'}
                        </p>
                        <p className="truncate text-xs font-medium text-neutral-light">
                          {order.customer.email || 'no-email'}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-between text-[11px] font-medium text-neutral-base">
                      <span>{order.itemsCount ?? 0} ITEMS</span>
                      <span>{order.createdAt ? new Date(order.createdAt).toLocaleDateString() : 'N/A'}</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <span className={cn('flex h-11 items-center gap-2 px-4 text-xs font-semibold', getStatusColor(order.status))}>
                      {getStatusIcon(order.status)}{order.status}
                    </span>

                    <Button variant="outline" size="sm" asChild className="h-11 rounded-2xl border-neutral-soft px-4">
                      <Link href={`/${locale}/orders/${order.id}`}>
                        {getText('common.actions.view', 'View')}
                      </Link>
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-neutral-veil/30">
                  <th className="py-4 px-8 text-[10px] font-bold text-neutral-light uppercase tracking-widest w-[25%]">{getText('merchant.orders.orderId', 'Ident')}</th>
                  <th className="py-4 px-6 text-[10px] font-bold text-neutral-light uppercase tracking-widest w-[30%]">{getText('merchant.orders.customer', 'Source')}</th>
                  <th className="py-4 px-6 text-[10px] font-bold text-neutral-light uppercase tracking-widest w-[15%]">{getText('merchant.orders.status', 'Status')}</th>
                  <th className="py-4 px-6 text-[10px] font-bold text-neutral-light uppercase tracking-widest w-[15%]">{getText('merchant.orders.total', 'Volume')}</th>
                  <th className="py-4 px-6 text-[10px] font-bold text-neutral-light uppercase tracking-widest w-[15%]">{getText('merchant.orders.date', 'Timestamp')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-veil">
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-20 text-center">
                      <div className="flex flex-col items-center opacity-30">
                        <Box className="w-12 h-12 mb-3 text-neutral-pale" />
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em]">{getText('merchant.orders.noOrdersFound', 'Ledger Empty')}</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  orders.map((order: Order) => (
                    <tr key={order.id} className="group hover:bg-action-veil/30 transition-colors cursor-pointer" onClick={() => router.push(`/${locale}/orders/${order.id}`)}>
                      <td className="py-4 px-8">
                        <div className="flex flex-col">
                          <span className="font-mono text-sm font-bold text-action-strong">
                            #{order.id.substring(0, 13).toUpperCase()}
                          </span>
                          <span className="text-[10px] text-neutral-light font-medium">...{order.id.slice(-12)}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-lg bg-neutral-faint flex items-center justify-center text-[10px] font-black text-neutral-light group-hover:bg-surface transition-colors">
                            {order.customer.username?.charAt(0) || order.customer.email?.charAt(0) || 'U'}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-bold text-neutral-deepest text-sm">{order.customer.username || 'Anonymous User'}</span>
                            <span className="text-xs text-neutral-light font-medium">{order.customer.email || 'no-email'}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className={cn('flex items-center gap-2 text-xs font-semibold', getStatusColor(order.status))}>
                          {getStatusIcon(order.status)}{order.status}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex flex-col">
                          <span className="font-bold text-neutral-deepest text-sm">{formatCurrency(order.totalAmount || 0, order.currency)}</span>
                          <span className="text-[10px] text-neutral-light font-bold uppercase tracking-tighter">{order.itemsCount ?? 0} ITEMS</span>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className="text-xs text-neutral-base font-medium">
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
            <div className="flex flex-col items-start justify-between gap-4 border-t border-neutral-veil bg-neutral-veil/10 px-4 py-4 sm:flex-row sm:items-center sm:px-8 sm:py-6">
              <span className="text-[10px] font-bold text-neutral-light uppercase tracking-widest">
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
                  className="h-8 rounded-lg border-neutral-soft text-xs font-bold"
                >
                  Prev
                </Button>
                <div className="flex items-center px-4 text-xs font-black text-neutral-deepest">
                  {currentPage} <span className="mx-2 text-neutral-pale">/</span> {pagination.totalPages}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(pagination.totalPages, prev + 1))}
                  disabled={currentPage === pagination.totalPages}
                  className="h-8 rounded-lg border-neutral-soft text-xs font-bold"
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
