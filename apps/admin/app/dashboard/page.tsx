'use client'

import { useEffect, useState } from 'react'
import { StatsCard } from '../../components/dashboard/stats-card'
import { SalesChannelChart, RealTimeOrdersChart } from '../../components/dashboard/charts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([])
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)

      // Mock data - in real app, fetch from API
      await new Promise(resolve => setTimeout(resolve, 1000)) // Simulate API call

      setStats({
        totalRevenue: 156780,
        totalOrders: 2847,
        totalProducts: 1234,
        activeUsers: 8567,
        revenueChange: 12.5,
        ordersChange: 8.2,
        productsChange: 15.3,
        usersChange: -2.1
      })

      setRecentOrders([
        { id: 'ORD-001', customer: 'John Doe', amount: 299.99, status: 'pending', date: '2025-06-06' },
        { id: 'ORD-002', customer: 'Jane Smith', amount: 159.50, status: 'processing', date: '2025-06-06' },
        { id: 'ORD-003', customer: 'Bob Johnson', amount: 89.99, status: 'shipped', date: '2025-06-05' },
        { id: 'ORD-004', customer: 'Alice Brown', amount: 199.99, status: 'delivered', date: '2025-06-05' },
        { id: 'ORD-005', customer: 'Charlie Wilson', amount: 79.99, status: 'cancelled', date: '2025-06-04' }
      ])

      setSystemStatus({
        plugins: { active: 6, total: 8 },
        uptime: '99.9%',
        lastBackup: '2 hours ago'
      })
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

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
          value={`¥${stats?.totalRevenue.toLocaleString()}`}
          change={`${stats?.revenueChange > 0 ? '+' : ''}${stats?.revenueChange}%`}
          changeType={stats?.revenueChange >= 0 ? "increase" : "decrease"}
          color="blue"
          icon={<CurrencyDollarIcon className="w-5 h-5" />}
        />
        <StatsCard
          title="Total Orders"
          value={stats?.totalOrders.toLocaleString() || '0'}
          change={`${stats?.ordersChange > 0 ? '+' : ''}${stats?.ordersChange}%`}
          changeType={stats?.ordersChange >= 0 ? "increase" : "decrease"}
          color="green"
          icon={<ShoppingBagIcon className="w-5 h-5" />}
        />
        <StatsCard
          title="Total Products"
          value={stats?.totalProducts.toLocaleString() || '0'}
          change={`${stats?.productsChange > 0 ? '+' : ''}${stats?.productsChange}%`}
          changeType={stats?.productsChange >= 0 ? "increase" : "decrease"}
          color="purple"
          icon={<CubeIcon className="w-5 h-5" />}
        />
        <StatsCard
          title="Active Users"
          value={stats?.activeUsers.toLocaleString() || '0'}
          change={`${stats?.usersChange > 0 ? '+' : ''}${stats?.usersChange}%`}
          changeType={stats?.usersChange >= 0 ? "increase" : "decrease"}
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
                {recentOrders.map((order) => (
                  <div key={order.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <ShoppingBagIcon className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{order.id}</p>
                        <p className="text-sm text-gray-600">{order.customer}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <Badge className={getStatusColor(order.status)}>
                        {order.status}
                      </Badge>
                      <div className="text-right">
                        <p className="font-medium text-gray-900">¥{order.amount}</p>
                        <p className="text-sm text-gray-600">{order.date}</p>
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
