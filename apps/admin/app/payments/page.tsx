'use client'

import { AlertCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

/**
 * Payment Monitoring Page
 * 支付监控页面
 * 功能待后端支付监控 API 实现
 */

export default function PaymentsPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Payment Monitoring</h1>
        <p className="text-gray-600 mt-2">Monitor payment system health and transactions</p>
      </div>

      {/* Alert Banner */}
      <Card className="border-yellow-200 bg-yellow-50">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <AlertCircle className="h-6 w-6 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-yellow-900">功能待开发</h3>
              <p className="text-sm text-yellow-800 mt-1">
                支付系统监控详图功能待后端监控 API 实现。
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards - Placeholder */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { title: 'Total Transactions', value: '0' },
          { title: 'Successful', value: '0' },
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

      {/* Payment Providers Section */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Providers</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle className="h-12 w-12 text-yellow-500 mb-4" />
            <p className="text-gray-600 font-medium mb-2">功能待开发</p>
            <p className="text-sm text-gray-500">
              支付提供商监控功能待后端实现
            </p>
          </div>
        </CardContent>
      </Card>

      {/* System Health Section */}
      <Card>
        <CardHeader>
          <CardTitle>System Health</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle className="h-12 w-12 text-yellow-500 mb-4" />
            <p className="text-gray-600 font-medium mb-2">功能待开发</p>
            <p className="text-sm text-gray-500">
              系统健康状态监控功能待后端实现
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Transaction Details Section */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle className="h-12 w-12 text-yellow-500 mb-4" />
            <p className="text-gray-600 font-medium mb-2">功能待开发</p>
            <p className="text-sm text-gray-500">
              交易详情功能待后端实现
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
