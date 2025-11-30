'use client'

import { BarChart3, Building2, Calendar, DollarSign, ShoppingCart, TrendingUp, TrendingDown, Users, AlertCircle } from 'lucide-react'
import { useEffect, useState } from 'react'

import { platformStatsApi, tenantManagementApi, userManagementApi, orderManagementApi } from '@/lib/api'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useI18n } from '@/lib/i18n'

interface AnalyticsData {
  overview: {
    totalRevenue: number
    revenueGrowth: number
    totalTenants: number
    tenantGrowth: number
    totalUsers: number
    userGrowth: number
    totalOrders: number
    orderGrowth: number
  }
  revenueByMonth: Array<{
    month: string
    revenue: number
    tenants: number
    users: number
  }>
  tenantsByLevel: Array<{
    level: string
    count: number
    percentage: number
  }>
  topTenants: Array<{
    id: string
    name: string
    revenue: number
    users: number
    orders: number
  }>
}

export default function AnalyticsPage() {
  const { t } = useI18n()
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState('30d')

  useEffect(() => {
    fetchAnalyticsData()
  }, [dateRange])

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true)

      // 📌 使用真实的后端 API 获取分析数据
      // 调用已实现的端点：platformStatsApi, tenantManagementApi, userManagementApi, orderManagementApi
      const [dashboardStats, tenantStats, userStats, orderStats] = await Promise.all([
        platformStatsApi.getDashboardStats().catch(() => null),
        tenantManagementApi.getTenantStats().catch(() => null),
        userManagementApi.getUserStats().catch(() => null),
        orderManagementApi.getOrderStats().catch(() => null)
      ])

      const realDashboard = dashboardStats?.data || {}
      const realTenantStats = tenantStats?.data || {}
      const realUserStats = userStats?.data || {}
      const realOrderStats = orderStats?.data || {}

      console.log('Analytics API responses:', {
        dashboard: realDashboard,
        tenants: realTenantStats,
        users: realUserStats,
        orders: realOrderStats
      })

      // 创建分析数据，基于真实的后端数据
      const analyticsData: AnalyticsData = {
        overview: {
          totalRevenue: realDashboard.totalRevenue || 0,
          revenueGrowth: 0, // 暂无增长数据
          totalTenants: realTenantStats.totalTenants || 0,
          tenantGrowth: 0, // 暂无增长数据
          totalUsers: realUserStats.totalUsers || 0,
          userGrowth: 0, // 暂无增长数据
          totalOrders: realOrderStats.totalOrders || 0,
          orderGrowth: 0 // 暂无增长数据
        },
        revenueByMonth: [], // 详细图表功能待后端按月分组统计接口实现
        tenantsByLevel: [], // 租户分布统计功能待后端实现
        topTenants: [] // 顶级租户统计功能待后端实现
      }

      setAnalyticsData(analyticsData)
    } catch (error) {
      console.error('Failed to fetch analytics data:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const getTrendIcon = (growth: number) => {
    return growth >= 0 ? (
      <TrendingUp className="h-4 w-4 text-green-500" />
    ) : (
      <TrendingDown className="h-4 w-4 text-red-500" />
    )
  }

  const getTrendColor = (growth: number) => {
    return growth >= 0 ? 'text-green-600' : 'text-red-600'
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Analytics & Reports</h1>
            <p className="text-gray-600 mt-2">Platform performance insights</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg shadow p-6 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
              <div className="h-8 bg-gray-200 rounded w-1/2 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-2/3"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {t('analytics.title', 'Analytics & Reports')}
          </h1>
          <p className="text-gray-600 mt-2">
            {t('analytics.description', 'Platform performance insights and business metrics')}
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="1y">Last year</option>
          </select>
          
          <button className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-10 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white">
            <Calendar className="h-4 w-4 mr-2" />
            Export Report
          </button>
        </div>
      </div>

      {/* Key Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(analyticsData?.overview.totalRevenue || 0)}
                </p>
                <div className="flex items-center mt-2">
                  {getTrendIcon(analyticsData?.overview.revenueGrowth || 0)}
                  <span className={`text-sm ml-1 ${getTrendColor(analyticsData?.overview.revenueGrowth || 0)}`}>
                    {analyticsData?.overview.revenueGrowth}%
                  </span>
                </div>
              </div>
              <DollarSign className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Tenants</p>
                <p className="text-2xl font-bold text-gray-900">
                  {analyticsData?.overview.totalTenants}
                </p>
                <div className="flex items-center mt-2">
                  {getTrendIcon(analyticsData?.overview.tenantGrowth || 0)}
                  <span className={`text-sm ml-1 ${getTrendColor(analyticsData?.overview.tenantGrowth || 0)}`}>
                    {analyticsData?.overview.tenantGrowth}%
                  </span>
                </div>
              </div>
              <Building2 className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Users</p>
                <p className="text-2xl font-bold text-gray-900">
                  {analyticsData?.overview.totalUsers}
                </p>
                <div className="flex items-center mt-2">
                  {getTrendIcon(analyticsData?.overview.userGrowth || 0)}
                  <span className={`text-sm ml-1 ${getTrendColor(analyticsData?.overview.userGrowth || 0)}`}>
                    {analyticsData?.overview.userGrowth}%
                  </span>
                </div>
              </div>
              <Users className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Orders</p>
                <p className="text-2xl font-bold text-gray-900">
                  {analyticsData?.overview.totalOrders}
                </p>
                <div className="flex items-center mt-2">
                  {getTrendIcon(analyticsData?.overview.orderGrowth || 0)}
                  <span className={`text-sm ml-1 ${getTrendColor(analyticsData?.overview.orderGrowth || 0)}`}>
                    {analyticsData?.overview.orderGrowth}%
                  </span>
                </div>
              </div>
              <ShoppingCart className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts and Detailed Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <BarChart3 className="h-5 w-5 mr-2" />
              Revenue Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="h-12 w-12 text-yellow-500 mb-4" />
              <p className="text-gray-600 font-medium mb-2">功能待开发</p>
              <p className="text-sm text-gray-500">
                详细收入趋势图表功能待后端按月分组统计接口实现
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Tenant Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Tenant Distribution by Level</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="h-12 w-12 text-yellow-500 mb-4" />
              <p className="text-gray-600 font-medium mb-2">功能待开发</p>
              <p className="text-sm text-gray-500">
                租户分布统计功能待后端维度统计接口实现
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Performing Tenants */}
      <Card>
        <CardHeader>
          <CardTitle>Top Performing Tenants</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle className="h-12 w-12 text-yellow-500 mb-4" />
            <p className="text-gray-600 font-medium mb-2">功能待开发</p>
            <p className="text-sm text-gray-500">
              顶级租户排名统计功能待后端实现
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
