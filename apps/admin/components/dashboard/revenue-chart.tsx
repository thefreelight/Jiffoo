'use client'

import { AlertCircle } from 'lucide-react'

/**
 * Revenue Chart Component
 * 显示收入和佣金统计图表
 * 功能待后端按月分组统计接口实现
 */
export function RevenueChart() {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Revenue & Commissions</h3>
      </div>

      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertCircle className="h-12 w-12 text-yellow-500 mb-4" />
        <p className="text-gray-600 font-medium mb-2">功能待开发</p>
        <p className="text-sm text-gray-500">
          收入和佣金详细图表功能待后端按月分组统计接口实现
        </p>
      </div>
    </div>
  )
}
