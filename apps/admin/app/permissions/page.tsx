'use client'

import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

/**
 * Permissions Management Page
 * 权限管理页面
 * 权限统计功能待后端权限 API 实现
 */

export default function PermissionsPage() {
  const handleTestPermission = () => {
    alert('⚠️ 权限测试 API (/permissions/check) 尚未在后端实现。\n\n当后端实现了权限检查 API 后，此功能将被启用。')
  }

  const handleBatchTestPermissions = () => {
    alert('⚠️ 批量权限测试 API 尚未在后端实现。\n\n当后端实现了相应的 API 端点后，此功能将被启用。')
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Permissions Management</h1>
        <p className="text-gray-600 mt-2">
          Manage user permissions and role-based access control
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
                权限统计功能待后端权限 API 实现。权限测试 API (/permissions/check) 尚未在后端实现。
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Permission Statistics Section */}
      <Card>
        <CardHeader>
          <CardTitle>Permission Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle className="h-12 w-12 text-yellow-500 mb-4" />
            <p className="text-gray-600 font-medium mb-2">功能待开发</p>
            <p className="text-sm text-gray-500">
              权限统计功能待后端实现
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Role Permissions Matrix Section */}
      <Card>
        <CardHeader>
          <CardTitle>Role Permissions Matrix</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle className="h-12 w-12 text-yellow-500 mb-4" />
            <p className="text-gray-600 font-medium mb-2">功能待开发</p>
            <p className="text-sm text-gray-500">
              详细角色权限配置功能待后端实现
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Single Permission Test Section */}
      <Card>
        <CardHeader>
          <CardTitle>Test Single Permission</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle className="h-12 w-12 text-yellow-500 mb-4" />
            <p className="text-gray-600 font-medium mb-2">功能待开发</p>
            <p className="text-sm text-gray-500 mb-6">
              权限测试 API (/permissions/check) 尚未在后端实现
            </p>
            <Button onClick={handleTestPermission} className="bg-blue-600 hover:bg-blue-700">
              Test Permission
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Batch Permission Test Section */}
      <Card>
        <CardHeader>
          <CardTitle>Batch Permission Test</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle className="h-12 w-12 text-yellow-500 mb-4" />
            <p className="text-gray-600 font-medium mb-2">功能待开发</p>
            <p className="text-sm text-gray-500 mb-6">
              批量权限测试 API 尚未在后端实现
            </p>
            <Button onClick={handleBatchTestPermissions} className="bg-blue-600 hover:bg-blue-700">
              Test Batch Permissions
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
