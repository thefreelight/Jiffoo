'use client'

import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

/**
 * Licenses Management Page
 * 许可证管理页面
 * 功能待后端实现（会基于插件订阅/计划扩展）
 */

export default function LicensesPage() {
  const handleGenerateLicense = () => {
    alert('⚠️ 许可证管理功能待后端实现。\n\n此功能会基于插件订阅和计划扩展后端实现。')
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">License Management</h1>
        <p className="text-gray-600 mt-2">
          Manage plugin licenses and subscriptions
        </p>
      </div>

      {/* Alert Banner */}
      <Card className="border-yellow-200 bg-yellow-50">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <AlertCircle className="h-6 w-6 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-yellow-900">功能待开发</h3>
              <p className="text-sm text-yellow-800 mt-1">
                许可证管理功能待后端实现。此功能会基于插件订阅和计划扩展后端实现。
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Licenses List Section */}
      <Card>
        <CardHeader>
          <CardTitle>Plugin Licenses</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle className="h-12 w-12 text-yellow-500 mb-4" />
            <p className="text-gray-600 font-medium mb-2">功能待开发</p>
            <p className="text-sm text-gray-500">
              许可证列表功能待后端实现
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Generate License Section */}
      <Card>
        <CardHeader>
          <CardTitle>Generate New License</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle className="h-12 w-12 text-yellow-500 mb-4" />
            <p className="text-gray-600 font-medium mb-2">功能待开发</p>
            <p className="text-sm text-gray-500 mb-6">
              许可证生成功能待后端实现
            </p>
            <Button onClick={handleGenerateLicense} className="bg-blue-600 hover:bg-blue-700">
              Generate License
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* License Statistics Section */}
      <Card>
        <CardHeader>
          <CardTitle>License Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle className="h-12 w-12 text-yellow-500 mb-4" />
            <p className="text-gray-600 font-medium mb-2">功能待开发</p>
            <p className="text-sm text-gray-500">
              许可证统计功能待后端实现
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
