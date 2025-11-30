'use client'

import { AlertCircle } from 'lucide-react'

/**
 * Platform Revenue Chart Component
 * 显示平台收入统计图表
 * 功能待后端按月分组统计接口实现
 */
export function PlatformRevenueChart() {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Platform Revenue</h3>
        <p className="text-sm text-gray-600">Monthly revenue and tenant growth</p>
      </div>

      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertCircle className="h-12 w-12 text-yellow-500 mb-4" />
        <p className="text-gray-600 font-medium mb-2">功能待开发</p>
        <p className="text-sm text-gray-500">
          平台收入图表功能待后端按月分组统计接口完善
        </p>
      </div>
    </div>
  )
}
