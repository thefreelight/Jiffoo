'use client'

import { useState, useEffect } from 'react'
import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { saasManagementApi } from '@/lib/api'

/**
 * SaaS Management Page
 * SaaS 管理页面
 * 实例创建/删除功能待后端实现
 */

export default function SaasManagementPage() {
  const [instances, setInstances] = useState<any[]>([])
  const [stats, setStats] = useState({
    totalInstances: 0,
    activeInstances: 0,
    inactiveInstances: 0,
    suspendedInstances: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadSaasData()
  }, [])

  const loadSaasData = async () => {
    try {
      setLoading(true)
      await loadInstances()
    } finally {
      setLoading(false)
    }
  }

  const loadInstances = async () => {
    try {
      // 使用真实的租户管理 API 获取 SaaS 实例
      const response = await saasManagementApi.getAllTenants({ limit: 100 })
      if (response.success && Array.isArray(response.data)) {
        // 将租户数据转换为 SaaS 实例格式
        const instancesData = response.data.map((tenant: any) => ({
          id: tenant.id,
          name: tenant.companyName,
          domain: tenant.domain || `${tenant.id}.jiffoo.com`,
          plan: tenant.agencyLevel || 'basic',
          planName: tenant.agencyLevel || 'Basic',
          status: tenant.status,
          createdAt: tenant.createdAt,
          lastActivity: tenant.updatedAt,
          owner: {
            id: tenant.adminUserId || '',
            name: tenant.contactName || 'Unknown',
            email: tenant.contactEmail || ''
          },
          metrics: {
            users: 0,
            storage: 0,
            bandwidth: 0,
            requests: 0
          },
          usage: {
            users: 0,
            storage: 0,
            bandwidth: 0,
            requests: 0
          }
        }))
        setInstances(instancesData)

        // 计算统计数据 - 使用大写状态值
        const activeCount = instancesData.filter((i: any) => i.status === 'ACTIVE').length
        const inactiveCount = instancesData.filter((i: any) => i.status === 'INACTIVE' || i.status === 'TERMINATED').length
        const suspendedCount = instancesData.filter((i: any) => i.status === 'SUSPENDED').length

        setStats({
          totalInstances: instancesData.length,
          activeInstances: activeCount,
          inactiveInstances: inactiveCount,
          suspendedInstances: suspendedCount
        })
      } else {
        setInstances([])
      }
    } catch (error) {
      console.error('Failed to load SaaS instances:', error)
      setInstances([])
    }
  }

  const handleCreateInstance = () => {
    alert('⚠️ SaaS 实例创建/删除功能待后端实现。\n\n当后端实现了相应的 API 端点后，此功能将被启用。')
  }

  const handleDeleteInstance = () => {
    alert('⚠️ SaaS 实例删除功能待后端实现。\n\n当后端实现了相应的 API 端点后，此功能将被启用。')
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">SaaS Management</h1>
          <p className="text-gray-600 mt-2">Manage SaaS instances and tenant configurations</p>
        </div>
        <Button onClick={handleCreateInstance} className="bg-blue-600 hover:bg-blue-700">
          Create Instance
        </Button>
      </div>

      {/* Alert Banner */}
      <Card className="border-yellow-200 bg-yellow-50">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <AlertCircle className="h-6 w-6 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-yellow-900">功能待开发</h3>
              <p className="text-sm text-yellow-800 mt-1">
                SaaS 实例创建/删除功能待后端实现。当前可查看现有租户实例。
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { title: 'Total Instances', value: stats.totalInstances.toString() },
          { title: 'Active', value: stats.activeInstances.toString() },
          { title: 'Inactive', value: stats.inactiveInstances.toString() },
          { title: 'Suspended', value: stats.suspendedInstances.toString() }
        ].map((stat, index) => (
          <Card key={index}>
            <CardContent className="p-6">
              <p className="text-sm font-medium text-gray-600">{stat.title}</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Instances List */}
      <Card>
        <CardHeader>
          <CardTitle>SaaS Instances</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-gray-500">Loading instances...</p>
            </div>
          ) : instances.length === 0 ? (
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No instances found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {instances.map((instance: any) => (
                <div key={instance.id} className="border rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{instance.name}</h3>
                      <p className="text-sm text-gray-600 mt-1">Domain: {instance.domain}</p>
                      <p className="text-sm text-gray-600">Plan: {instance.planName}</p>
                      <p className="text-sm text-gray-600">Owner: {instance.owner.name} ({instance.owner.email})</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        instance.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                        instance.status === 'INACTIVE' || instance.status === 'TERMINATED' ? 'bg-gray-100 text-gray-800' :
                        instance.status === 'SUSPENDED' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {instance.status}
                      </span>
                      <Button variant="outline" size="sm" onClick={handleDeleteInstance}>
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
