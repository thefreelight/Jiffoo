/**
 * Dashboard Page for Tenant Application
 *
 * Displays store overview with stats, charts, and recent orders.
 * Supports i18n through the translation function.
 */

'use client'

import { AlertTriangle, Box, CheckCircle, Clock, DollarSign, Eye, Plus, ShoppingBag, Users } from 'lucide-react'
import { StatsCard } from '@/components/dashboard/stats-card'
import { SalesChannelChart, RealTimeOrdersChart } from '@/components/dashboard/charts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useDashboardStats, useOrders, useInstalledPlugins } from '@/lib/hooks/use-api'
import { cacheApi } from '@/lib/api'
import { Order } from '@/lib/types'
import { useQuery } from '@tanstack/react-query'
import { useT } from 'shared/src/i18n'




export default function DashboardPage() {
  const t = useT()

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback
  }

  // Use API hooks for real data
  const { data: stats, isLoading: statsLoading, error: statsError } = useDashboardStats()
  const { data: ordersData, isLoading: ordersLoading } = useOrders({ limit: 5 })
  const { data: pluginsData, isLoading: pluginsLoading } = useInstalledPlugins()
  const { data: cacheStats, isLoading: cacheLoading } = useQuery({
    queryKey: ['cacheStats'],
    queryFn: async () => {
      try {
        const response = await cacheApi.getStats()
        return response.data ?? { totalKeys: 0, memoryUsage: 0, hitRate: 0 }
      } catch {
        return { totalKeys: 0, memoryUsage: 0, hitRate: 0 }
      }
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  })

  // Calculate system status from real data
  const systemStatus = {
    plugins: {
      active: Array.isArray(pluginsData) ? pluginsData.filter((p: any) => p.enabled).length : 0,
      total: Array.isArray(pluginsData) ? pluginsData.length : 0
    },
    cacheKeys: cacheStats?.totalKeys || 0,
    cacheHitRate: cacheStats?.hitRate ? `${(cacheStats.hitRate * 100).toFixed(1)}%` : 'N/A'
  }

  const loading = statsLoading || ordersLoading || pluginsLoading || cacheLoading
  const recentOrders = Array.isArray(ordersData?.data) ? ordersData.data : (ordersData?.data?.data || [])

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'processing': return 'bg-blue-100 text-blue-800'
      case 'shipped': return 'bg-purple-100 text-purple-800'
      case 'delivered': return 'bg-green-100 text-green-800'
      case 'cancelled': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">{getText('tenant.dashboard.loading', 'Loading dashboard...')}</p>
        </div>
      </div>
    )
  }

  if (statsError) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600">{getText('tenant.dashboard.loadFailed', 'Failed to load dashboard data')}</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => window.location.reload()}
          >
            {getText('tenant.dashboard.retry', 'Retry')}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#0F172A]">{getText('tenant.dashboard.welcome', 'Welcome back!')}</h1>
          <p className="text-[#64748B]">{getText('tenant.dashboard.welcomeSubtitle', "Here's what's happening with your store today.")}</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" size="sm" className="border-[#E2E8F0] text-[#0F172A] hover:border-[#3B82F6] hover:text-[#3B82F6]">
            <Eye className="w-4 h-4 mr-2" />
            {getText('tenant.dashboard.viewStore', 'View Store')}
          </Button>
          <Button size="sm" className="bg-[#3B82F6] hover:bg-[#2563EB] text-white">
            <Plus className="w-4 h-4 mr-2" />
            {getText('tenant.dashboard.addProduct', 'Add Product')}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title={getText('tenant.dashboard.totalRevenue', 'Total Revenue')}
          value={`¥${stats?.totalRevenue?.toLocaleString() || '0'}`}
          change={`${(stats?.revenueGrowth ?? 0) > 0 ? '+' : ''}${stats?.revenueGrowth ?? 0}%`}
          changeType={(stats?.revenueGrowth ?? 0) >= 0 ? "increase" : "decrease"}
          color="blue"
          icon={<DollarSign className="w-5 h-5" />}
        />
        <StatsCard
          title={getText('tenant.dashboard.totalOrders', 'Total Orders')}
          value={stats?.totalOrders?.toLocaleString() || '0'}
          change={`${(stats?.orderGrowth ?? 0) > 0 ? '+' : ''}${stats?.orderGrowth ?? 0}%`}
          changeType={(stats?.orderGrowth ?? 0) >= 0 ? "increase" : "decrease"}
          color="green"
          icon={<ShoppingBag className="w-5 h-5" />}
        />
        <StatsCard
          title={getText('tenant.dashboard.totalProducts', 'Total Products')}
          value={stats?.totalProducts?.toLocaleString() || '0'}
          change={`${(stats?.productGrowth ?? 0) > 0 ? '+' : ''}${stats?.productGrowth ?? 0}%`}
          changeType={(stats?.productGrowth ?? 0) >= 0 ? "increase" : "decrease"}
          color="purple"
          icon={<Box className="w-5 h-5" />}
        />
        <StatsCard
          title={getText('tenant.dashboard.totalUsers', 'Total Users')}
          value={stats?.totalUsers?.toLocaleString() || '0'}
          change={`${(stats?.userGrowth ?? 0) > 0 ? '+' : ''}${stats?.userGrowth ?? 0}%`}
          changeType={(stats?.userGrowth ?? 0) >= 0 ? "increase" : "decrease"}
          color="orange"
          icon={<Users className="w-5 h-5" />}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SalesChannelChart />
        <RealTimeOrdersChart />
      </div>
    </div>
  )
}
