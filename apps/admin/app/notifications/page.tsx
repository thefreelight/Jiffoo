'use client'

import { AlertCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useI18n } from '@/lib/i18n'

/**
 * Notifications Management Page
 * 通知中心页面
 * 功能待后端通知管理 API 实现
 */

export default function NotificationsPage() {
  const { t } = useI18n()

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          {t('notifications.title', 'Notification Management')}
        </h1>
        <p className="text-gray-600 mt-2">
          {t('notifications.description', 'Send and manage platform-wide notifications')}
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
                通知中心功能（/super-admin/notifications）尚未在后端实现，当前为占位页面。
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards - Placeholder */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { title: 'Total Sent', value: '0' },
          { title: 'Delivered', value: '0' },
          { title: 'Failed', value: '0' },
          { title: 'Pending', value: '0' }
        ].map((stat, index) => (
          <Card key={index}>
            <CardContent className="p-6">
              <p className="text-sm font-medium text-gray-600">{stat.title}</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Send Notification Section */}
      <Card>
        <CardHeader>
          <CardTitle>Send Notification</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle className="h-12 w-12 text-yellow-500 mb-4" />
            <p className="text-gray-600 font-medium mb-2">功能待开发</p>
            <p className="text-sm text-gray-500">
              发送通知功能待后端通知管理 API 实现
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Notifications List Section */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Notifications</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle className="h-12 w-12 text-yellow-500 mb-4" />
            <p className="text-gray-600 font-medium mb-2">功能待开发</p>
            <p className="text-sm text-gray-500">
              通知列表功能待后端实现
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Templates Section */}
      <Card>
        <CardHeader>
          <CardTitle>Notification Templates</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle className="h-12 w-12 text-yellow-500 mb-4" />
            <p className="text-gray-600 font-medium mb-2">功能待开发</p>
            <p className="text-sm text-gray-500">
              通知模板管理功能待后端实现
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
