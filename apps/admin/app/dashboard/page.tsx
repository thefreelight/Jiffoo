'use client'

import { StatsCard } from '../../components/dashboard/stats-card'
import { SalesChannelChart, RealTimeOrdersChart } from '../../components/dashboard/charts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useDashboardStats, useOrders } from '../../lib/hooks/use-api'
import {
  CurrencyDollarIcon,
  ArrowTrendingDownIcon,
  ArrowTrendingUpIcon,
  UsersIcon,
  ShoppingBagIcon,
  CubeIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  PlusIcon,
  EyeIcon
} from '@heroicons/react/24/outline'

interface DashboardStats {
  totalRevenue: number
  totalOrders: number
  totalProducts: number
  activeUsers: number
  revenueChange: number
  ordersChange: number
  productsChange: number
  usersChange: number
}

interface RecentOrder {
  id: string
  customer: string
  amount: number
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled'
  date: string
}

interface SystemStatus {
  plugins: { active: number; total: number }
  uptime: string
  lastBackup: string
}

export default function DashboardPage() {
  // Use API hooks for real data
  const { data: stats, isLoading: statsLoading, error: statsError } = useDashboardStats()
  const { data: ordersData, isLoading: ordersLoading } = useOrders({ limit: 5 })

  // Mock system status for now (can be moved to API later)
  const systemStatus = {
    plugins: { active: 6, total: 8 },
    uptime: '99.9%',
    lastBackup: '2 hours ago'
  }

  const loading = statsLoading || ordersLoading
  const recentOrders = ordersData?.data || []

  const getStatusColor = (status: RecentOrder['status']) => {
    switch (status) {
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
          <p className="mt-2 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  if (statsError) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <ExclamationTriangleIcon className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600">Failed to load dashboard data</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => window.location.reload()}
          >
            Retry
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Welcome Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Welcome back!</h1>
          <p className="text-gray-600">Here's what's happening with your store today.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" size="sm">
            <EyeIcon className="w-4 h-4 mr-2" />
            View Store
          </Button>
          <Button size="sm">
            <PlusIcon className="w-4 h-4 mr-2" />
            Add Product
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Total Revenue"
          value={`¥${stats?.totalRevenue?.toLocaleString() || '0'}`}
          change={`${stats?.revenueGrowth > 0 ? '+' : ''}${stats?.revenueGrowth || 0}%`}
          changeType={stats?.revenueGrowth >= 0 ? "increase" : "decrease"}
          color="blue"
          icon={<CurrencyDollarIcon className="w-5 h-5" />}
        />
        <StatsCard
          title="Total Orders"
          value={stats?.totalOrders?.toLocaleString() || '0'}
          change={`${stats?.ordersGrowth > 0 ? '+' : ''}${stats?.ordersGrowth || 0}%`}
          changeType={stats?.ordersGrowth >= 0 ? "increase" : "decrease"}
          color="green"
          icon={<ShoppingBagIcon className="w-5 h-5" />}
        />
        <StatsCard
          title="Total Products"
          value={stats?.totalProducts?.toLocaleString() || '0'}
          change={`${stats?.productsGrowth > 0 ? '+' : ''}${stats?.productsGrowth || 0}%`}
          changeType={stats?.productsGrowth >= 0 ? "increase" : "decrease"}
          color="purple"
          icon={<CubeIcon className="w-5 h-5" />}
        />
        <StatsCard
          title="Total Users"
          value={stats?.totalUsers?.toLocaleString() || '0'}
          change={`${stats?.usersGrowth > 0 ? '+' : ''}${stats?.usersGrowth || 0}%`}
          changeType={stats?.usersGrowth >= 0 ? "increase" : "decrease"}
          color="orange"
          icon={<UsersIcon className="w-5 h-5" />}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SalesChannelChart />
        <RealTimeOrdersChart />
      </div>

      {/* Recent Orders & System Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Orders */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Recent Orders</CardTitle>
                  <CardDescription>Latest orders from your customers</CardDescription>
                </div>
                <Button variant="outline" size="sm">View All</Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentOrders.map((order: any) => (
                  <div key={order.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <ShoppingBagIcon className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{order.id}</p>
                        <p className="text-sm text-gray-600">{order.user?.username || order.user?.email || 'Unknown'}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <Badge className={getStatusColor(order.status)}>
                        {order.status}
                      </Badge>
                      <div className="text-right">
                        <p className="font-medium text-gray-900">¥{order.totalAmount?.toFixed(2) || '0.00'}</p>
                        <p className="text-sm text-gray-600">{new Date(order.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* System Status */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>System Status</CardTitle>
              <CardDescription>Current system health</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <CheckCircleIcon className="w-5 h-5 text-green-500" />
                  <span className="text-sm font-medium">Uptime</span>
                </div>
                <span className="text-sm text-gray-600">{systemStatus?.uptime}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <CubeIcon className="w-5 h-5 text-blue-500" />
                  <span className="text-sm font-medium">Active Plugins</span>
                </div>
                <span className="text-sm text-gray-600">
                  {systemStatus?.plugins.active}/{systemStatus?.plugins.total}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <ClockIcon className="w-5 h-5 text-purple-500" />
                  <span className="text-sm font-medium">Last Backup</span>
                </div>
                <span className="text-sm text-gray-600">{systemStatus?.lastBackup}</span>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Common tasks</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" className="w-full justify-start">
                <PlusIcon className="w-4 h-4 mr-2" />
                Add New Product
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <UsersIcon className="w-4 h-4 mr-2" />
                Manage Customers
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <CubeIcon className="w-4 h-4 mr-2" />
                Install Plugin
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <ExclamationTriangleIcon className="w-4 h-4 mr-2" />
                View Reports
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
