'use client'

import { Building2, CheckCircle, Clock, Users } from 'lucide-react'
import { useEffect, useState } from 'react'

import { tenantManagementApi } from '@/lib/api'

interface TenantStatsData {
  totalTenants: number
  activeTenants: number
  pendingTenants: number
  suspendedTenants: number
}

export function TenantStats() {
  const [stats, setStats] = useState<TenantStatsData>({
    totalTenants: 0,
    activeTenants: 0,
    pendingTenants: 0,
    suspendedTenants: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchTenantStats = async () => {
      try {
        const response = await tenantManagementApi.getAllTenants({ limit: 100 })
        // apiClient.get() 返回的是后端响应的 JSON 对象 { success, data, pagination }
        // 所以 response.data 就是租户数组
        const tenants = Array.isArray(response.data) ? response.data : []

        const totalTenants = tenants.length
        // 数据库存储的 status 是大写 (ACTIVE, PENDING, SUSPENDED)
        const activeTenants = tenants.filter((t: any) => t.status === 'ACTIVE').length
        const pendingTenants = tenants.filter((t: any) => t.status === 'PENDING').length
        const suspendedTenants = tenants.filter((t: any) => t.status === 'SUSPENDED').length

        setStats({
          totalTenants,
          activeTenants,
          pendingTenants,
          suspendedTenants,
        })
      } catch (error) {
        console.error('Failed to fetch tenant stats:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchTenantStats()
  }, [])

  const statCards = [
    {
      title: 'Total Tenants',
      value: stats.totalTenants,
      icon: Building2,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      title: 'Active Tenants',
      value: stats.activeTenants,
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      title: 'Pending Tenants',
      value: stats.pendingTenants,
      icon: Clock,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
    },
    {
      title: 'Suspended Tenants',
      value: stats.suspendedTenants,
      icon: Users,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
    },
  ]

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-lg shadow p-6 animate-pulse">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-gray-200 rounded-lg"></div>
              <div className="ml-4 flex-1">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-6 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {statCards.map((stat, index) => (
        <div key={index} className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className={`p-3 rounded-lg ${stat.bgColor}`}>
              <stat.icon className={`w-6 h-6 ${stat.color}`} />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">{stat.title}</p>
              <p className="text-2xl font-semibold text-gray-900">{stat.value}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
