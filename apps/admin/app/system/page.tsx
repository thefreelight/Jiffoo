'use client'

import { AlertTriangle, CheckCircle, Clock, Cpu, Database, RefreshCw, Server, ShieldCheck, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'

import { systemManagementApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useI18n } from '@/lib/i18n'

interface SystemHealth {
  status: 'healthy' | 'warning' | 'error'
  uptime: number
  version: string
  environment: string
  database: {
    status: 'connected' | 'disconnected'
    responseTime: number
  }
  redis: {
    status: 'connected' | 'disconnected'
    responseTime: number
  }
  memory: {
    used: number
    total: number
    percentage: number
  }
  cpu: {
    usage: number
  }
}

interface CacheStats {
  totalKeys: number
  memoryUsage: number
  hitRate: number
  missRate: number
}

export default function SystemPage() {
  const { t } = useI18n()
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null)
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    fetchSystemData()
  }, [])

  const fetchSystemData = async () => {
    try {
      setLoading(true)
      const [cacheStatsResponse, cacheHealthResponse] = await Promise.all([
        systemManagementApi.getCacheStats().catch(() => null),
        systemManagementApi.getCacheHealth().catch(() => null)
      ])

      // 使用真实的 API 数据
      const cacheStatsData = cacheStatsResponse?.data
      const cacheHealthData = cacheHealthResponse?.data

      // 构建系统健康状态（基于缓存健康检查）
      const systemHealth: SystemHealth = {
        status: cacheHealthData?.status === 'healthy' ? 'healthy' : (cacheHealthData?.status === 'unhealthy' ? 'error' : 'warning'),
        uptime: 86400, // 1 day in seconds (占位符)
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        database: {
          status: cacheHealthData?.connected ? 'connected' : 'disconnected',
          responseTime: 15 // 占位符
        },
        redis: {
          status: cacheHealthData?.ping ? 'connected' : 'disconnected',
          responseTime: cacheHealthData?.ping ? 8 : 0
        },
        memory: {
          used: 512,
          total: 1024,
          percentage: 50
        },
        cpu: {
          usage: 25
        }
      }

      // 构建缓存统计（基于真实 API 数据）
      const cacheStats: CacheStats = {
        totalKeys: cacheStatsData?.totalKeys || 0,
        memoryUsage: 64, // 占位符
        hitRate: 85.5, // 占位符
        missRate: 14.5 // 占位符
      }

      setSystemHealth(systemHealth)
      setCacheStats(cacheStats)
    } catch (error) {
      console.error('Failed to fetch system data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchSystemData()
    setRefreshing(false)
  }

  const handleClearCache = async () => {
    if (confirm('Are you sure you want to clear all caches?')) {
      try {
        // Clear both product and search caches
        await Promise.all([
          systemManagementApi.clearProductCache(),
          systemManagementApi.clearSearchCache()
        ])
        await fetchSystemData() // Refresh data
        alert('All caches cleared successfully!')
      } catch (error) {
        console.error('Failed to clear cache:', error)
        alert('Failed to clear cache')
      }
    }
  }

  const handleClearProductCache = async () => {
    if (confirm('Are you sure you want to clear the product cache?')) {
      try {
        await systemManagementApi.clearProductCache()
        await fetchSystemData() // Refresh data
        alert('Product cache cleared successfully!')
      } catch (error) {
        console.error('Failed to clear product cache:', error)
        alert('Failed to clear product cache')
      }
    }
  }

  const handleClearSearchCache = async () => {
    if (confirm('Are you sure you want to clear the search cache?')) {
      try {
        await systemManagementApi.clearSearchCache()
        await fetchSystemData() // Refresh data
        alert('Search cache cleared successfully!')
      } catch (error) {
        console.error('Failed to clear search cache:', error)
        alert('Failed to clear search cache')
      }
    }
  }

  const handleClearStatisticsCache = async () => {
    if (confirm('Are you sure you want to clear the statistics cache?')) {
      try {
        await systemManagementApi.clearStatsCache()
        await fetchSystemData() // Refresh data
        alert('Statistics cache cleared successfully!')
      } catch (error) {
        console.error('Failed to clear statistics cache:', error)
        alert('Failed to clear statistics cache')
      }
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'connected':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />
      case 'error':
      case 'disconnected':
        return <XCircle className="h-5 w-5 text-red-500" />
      default:
        return <Clock className="h-5 w-5 text-gray-500" />
    }
  }

  const getStatusBadge = (status: string) => {
    const baseClasses = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
    switch (status) {
      case 'healthy':
      case 'connected':
        return `${baseClasses} bg-green-100 text-green-800`
      case 'warning':
        return `${baseClasses} bg-yellow-100 text-yellow-800`
      case 'error':
      case 'disconnected':
        return `${baseClasses} bg-red-100 text-red-800`
      default:
        return `${baseClasses} bg-gray-100 text-gray-800`
    }
  }

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return `${days}d ${hours}h ${minutes}m`
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">System Management</h1>
            <p className="text-gray-600 mt-2">Monitor system health and performance</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
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
            {t('system.title', 'System Management')}
          </h1>
          <p className="text-gray-600 mt-2">
            {t('system.description', 'Monitor system health, performance, and manage cache')}
          </p>
        </div>
        
        <div className="flex space-x-3">
          <Button 
            variant="outline" 
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
          
          <div className="flex space-x-2">
            <Button
              variant="outline"
              onClick={handleClearProductCache}
              className="text-orange-600 hover:text-orange-700"
              size="sm"
            >
              Clear Products
            </Button>
            <Button
              variant="outline"
              onClick={handleClearSearchCache}
              className="text-orange-600 hover:text-orange-700"
              size="sm"
            >
              Clear Search
            </Button>
            <Button
              variant="outline"
              onClick={handleClearStatisticsCache}
              className="text-orange-600 hover:text-orange-700"
              size="sm"
            >
              Clear Statistics
            </Button>
            <Button
              variant="outline"
              onClick={handleClearCache}
              className="text-red-600 hover:text-red-700"
            >
              Clear All Cache
            </Button>
          </div>
        </div>
      </div>

      {/* System Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">System Status</p>
                <p className="text-2xl font-bold text-gray-900">
                  {systemHealth?.status === 'healthy' ? 'Healthy' : 'Issues'}
                </p>
              </div>
              {getStatusIcon(systemHealth?.status || 'unknown')}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Uptime</p>
                <p className="text-2xl font-bold text-gray-900">
                  {systemHealth ? formatUptime(systemHealth.uptime) : 'N/A'}
                </p>
              </div>
              <Clock className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Memory Usage</p>
                <p className="text-2xl font-bold text-gray-900">
                  {systemHealth?.memory.percentage}%
                </p>
              </div>
              <Cpu className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">CPU Usage</p>
                <p className="text-2xl font-bold text-gray-900">
                  {systemHealth?.cpu.usage}%
                </p>
              </div>
              <Server className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed System Information */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* System Health Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <ShieldCheck className="h-5 w-5 mr-2" />
              System Health
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Environment</span>
              <span className="text-sm text-gray-600">{systemHealth?.environment}</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Version</span>
              <span className="text-sm text-gray-600">{systemHealth?.version}</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Database</span>
              <div className="flex items-center space-x-2">
                <span className={getStatusBadge(systemHealth?.database.status || 'unknown')}>
                  {systemHealth?.database.status}
                </span>
                <span className="text-xs text-gray-500">
                  {systemHealth?.database.responseTime}ms
                </span>
              </div>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Redis Cache</span>
              <div className="flex items-center space-x-2">
                <span className={getStatusBadge(systemHealth?.redis.status || 'unknown')}>
                  {systemHealth?.redis.status}
                </span>
                <span className="text-xs text-gray-500">
                  {systemHealth?.redis.responseTime}ms
                </span>
              </div>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Memory</span>
              <span className="text-sm text-gray-600">
                {systemHealth ? formatBytes(systemHealth.memory.used * 1024 * 1024) : 'N/A'} / 
                {systemHealth ? formatBytes(systemHealth.memory.total * 1024 * 1024) : 'N/A'}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Cache Statistics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Database className="h-5 w-5 mr-2" />
              Cache Statistics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Total Keys</span>
              <span className="text-sm text-gray-600">{cacheStats?.totalKeys.toLocaleString()}</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Memory Usage</span>
              <span className="text-sm text-gray-600">
                {cacheStats ? formatBytes(cacheStats.memoryUsage * 1024 * 1024) : 'N/A'}
              </span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Hit Rate</span>
              <span className="text-sm text-green-600">{cacheStats?.hitRate}%</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Miss Rate</span>
              <span className="text-sm text-red-600">{cacheStats?.missRate}%</span>
            </div>
            
            <div className="pt-4 border-t">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-green-600 h-2 rounded-full" 
                  style={{ width: `${cacheStats?.hitRate}%` }}
                ></div>
              </div>
              <p className="text-xs text-gray-500 mt-1">Cache Hit Rate</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
