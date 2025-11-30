'use client'

import { AlertCircle } from 'lucide-react'

/**
 * Agent Stats Component
 * 显示代理等级分布统计
 * 功能待开发：后端暂无 agent 概念
 */
export function AgentStats() {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">Agent Distribution by Level</h3>

      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertCircle className="h-12 w-12 text-yellow-500 mb-4" />
        <p className="text-gray-600 font-medium mb-2">功能待开发</p>
        <p className="text-sm text-gray-500">
          代理等级统计功能待后端实现（当前系统暂无 agent 概念）
        </p>
      </div>
    </div>
  )
}
