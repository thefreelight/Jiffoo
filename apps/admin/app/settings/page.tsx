'use client'

import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useI18n } from '@/lib/i18n'

/**
 * Platform Settings Page
 * 平台设置页面
 * 功能待后端配置 API 实现
 */

export default function SettingsPage() {
  const { t } = useI18n()

  const handleSaveSettings = () => {
    alert('⚠️ 平台设置功能待后端配置 API 实现。\n\n当后端实现了相应的 API 端点后，此功能将被启用。')
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          {t('settings.title', 'Platform Settings')}
        </h1>
        <p className="text-gray-600 mt-2">
          {t('settings.description', 'Configure platform-wide settings and preferences')}
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
                平台设置功能待后端配置 API 实现。
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* General Settings Section */}
      <Card>
        <CardHeader>
          <CardTitle>General Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle className="h-12 w-12 text-yellow-500 mb-4" />
            <p className="text-gray-600 font-medium mb-2">功能待开发</p>
            <p className="text-sm text-gray-500">
              通用设置功能待后端实现
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Security Settings Section */}
      <Card>
        <CardHeader>
          <CardTitle>Security Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle className="h-12 w-12 text-yellow-500 mb-4" />
            <p className="text-gray-600 font-medium mb-2">功能待开发</p>
            <p className="text-sm text-gray-500">
              安全设置功能待后端实现
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Pricing Settings Section */}
      <Card>
        <CardHeader>
          <CardTitle>Pricing Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle className="h-12 w-12 text-yellow-500 mb-4" />
            <p className="text-gray-600 font-medium mb-2">功能待开发</p>
            <p className="text-sm text-gray-500">
              定价设置功能待后端实现
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Notifications Settings Section */}
      <Card>
        <CardHeader>
          <CardTitle>Notifications Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle className="h-12 w-12 text-yellow-500 mb-4" />
            <p className="text-gray-600 font-medium mb-2">功能待开发</p>
            <p className="text-sm text-gray-500">
              通知设置功能待后端实现
            </p>
          </div>
        </CardContent>
      </Card>

      {/* API Settings Section */}
      <Card>
        <CardHeader>
          <CardTitle>API Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle className="h-12 w-12 text-yellow-500 mb-4" />
            <p className="text-gray-600 font-medium mb-2">功能待开发</p>
            <p className="text-sm text-gray-500">
              API 设置功能待后端实现
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSaveSettings} className="bg-blue-600 hover:bg-blue-700">
          Save Settings
        </Button>
      </div>
    </div>
  )
}
