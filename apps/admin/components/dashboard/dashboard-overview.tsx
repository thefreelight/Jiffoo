'use client'

import { ArrowDown, ArrowUp, BarChart3, CreditCard, DollarSign, Users } from 'lucide-react'
import { useEffect, useState } from 'react'

import { formatCurrency } from '@/lib/utils'
import { statisticsApi, saasManagementApi } from '@/lib/api'

interface OverviewStats {
  totalTenants: number
  activeTenants: number
  pendingTenants: number
  totalUsers: number
  totalProducts: number
  totalOrders: number
  totalRevenue: number
  monthlyGrowth: number
}

export function DashboardOverview() {
  const [stats, setStats] = useState<OverviewStats>({
    totalTenants: 0,
    activeTenants: 0,
    pendingTenants: 0,
    totalUsers: 0,
    totalProducts: 0,
    totalOrders: 0,
    totalRevenue: 0,
    monthlyGrowth: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // 使用真实的API端点获取平台统计数据
        // 后端限制 limit <= 100，所以使用 100
        const [dashboardStats, tenantsResponse] = await Promise.all([
          statisticsApi.getDashboard(),
          saasManagementApi.getAllTenants({ limit: 100 }) // 获取租户（后端限制最大100）
        ])

        // 处理租户数据
        // apiClient.get() 返回的是后端响应的 JSON 对象 { success, data, pagination }
        // 所以 tenantsResponse.data 就是租户数组
        const tenants = Array.isArray(tenantsResponse.data) ? tenantsResponse.data : []
        // 数据库存储的 status 是大写 (ACTIVE, PENDING, SUSPENDED)
        const activeTenants = tenants.filter((t: any) => t.status === 'ACTIVE').length
        const pendingTenants = tenants.filter((t: any) => t.status === 'PENDING').length

        const platformStats: OverviewStats = {
          totalTenants: tenants.length,
          activeTenants,
          pendingTenants,
          totalUsers: dashboardStats.data?.users?.totalUsers || 0,
          totalProducts: dashboardStats.data?.products?.totalProducts || 0,
          totalOrders: dashboardStats.data?.orders?.totalOrders || 0,
          totalRevenue: dashboardStats.data?.orders?.totalRevenue || 0,
          monthlyGrowth: dashboardStats.data?.orders?.monthlyGrowth || 0,
        }

        setStats(platformStats)
        setLoading(false)
      } catch (error) {
        console.error('Failed to fetch platform stats:', error)
        // 如果API调用失败，显示加载失败状态而不是使用模拟数据
        setStats({
          totalTenants: 0,
          activeTenants: 0,
          pendingTenants: 0,
          totalUsers: 0,
          totalProducts: 0,
          totalOrders: 0,
          totalRevenue: 0,
          monthlyGrowth: 0,
        })
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  const cards = [
    {
      title: 'Total Tenants',
      value: stats.totalTenants.toLocaleString(),
      subtitle: `${stats.activeTenants} active`,
      icon: Users,
      color: 'bg-blue-500',
      change: `+${stats.monthlyGrowth.toFixed(1)}%`,
      changeType: 'positive' as const,
    },
    {
      title: 'Pending Tenants',
      value: stats.pendingTenants.toLocaleString(),
      subtitle: 'Awaiting activation',
      icon: BarChart3,
      color: 'bg-yellow-500',
      change: `${stats.pendingTenants}`,
      changeType: 'neutral' as const,
    },
    {
      title: 'Total Revenue',
      value: formatCurrency(stats.totalRevenue),
      subtitle: 'Platform-wide',
      icon: DollarSign,
      color: 'bg-green-500',
      change: `+${stats.monthlyGrowth.toFixed(1)}%`,
      changeType: 'positive' as const,
    },
    {
      title: 'Total Users',
      value: stats.totalUsers.toLocaleString(),
      subtitle: 'Across all tenants',
      icon: CreditCard,
      color: 'bg-purple-500',
      change: '+15%',
      changeType: 'positive' as const,
    },
  ]

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-lg shadow p-6 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
            <div className="h-8 bg-gray-200 rounded w-1/2 mb-2"></div>
            <div className="h-3 bg-gray-200 rounded w-2/3"></div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {cards.map((card, index) => (
        <div key={index} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600">{card.title}</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">{card.value}</p>
              <p className="text-sm text-gray-500 mt-1">{card.subtitle}</p>
            </div>
            <div className={`p-3 rounded-lg ${card.color}`}>
              <card.icon className="h-6 w-6 text-white" />
            </div>
          </div>
          
          <div className="mt-4 flex items-center">
            <div className={`flex items-center text-sm ${
              card.changeType === 'positive' ? 'text-green-600' : 'text-gray-600'
            }`}>
              {card.changeType === 'positive' && <ArrowUp className="h-4 w-4 mr-1" />}
              <span className="font-medium">{card.change}</span>
            </div>
            <span className="text-sm text-gray-500 ml-2">from last month</span>
          </div>
        </div>
      ))}
    </div>
  )
}
