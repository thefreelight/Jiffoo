/**
 * ReorderAlerts Component
 *
 * Displays a table of inventory reorder alerts with severity indicators and dismiss functionality.
 * Follows table patterns from dashboard/page.tsx
 */

'use client'

import { Box } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from "@/components/ui/badge"
import { useT } from 'shared/src/i18n/react'
import { useEffect, useMemo, useState } from 'react'
import { cn } from '../../lib/utils'

// Alert Response Interface (matches API types)
export interface AlertResponse {
  id: string
  productId: string
  productName?: string
  variantId?: string | null
  variantName?: string | null
  alertType: 'STOCKOUT_RISK' | 'OVERSTOCK' | 'REORDER_POINT'
  severity: 'HIGH' | 'MEDIUM' | 'LOW'
  status: 'ACTIVE' | 'DISMISSED' | 'RESOLVED'
  message: string
  threshold: number | null
  currentStock: number
  recommendedOrder: number | null
  resolvedAt: string | null
  createdAt: string
  updatedAt: string
}

interface ReorderAlertsProps {
  alerts: AlertResponse[]
  onDismiss?: (alertId: string) => void
  onResolve?: (alertId: string) => void
  onUpdateStatus?: (alertId: string, status: 'ACTIVE' | 'DISMISSED' | 'RESOLVED') => void
  isUpdatingStatus?: boolean
  loading?: boolean
}

export function ReorderAlerts({
  alerts,
  onDismiss,
  onResolve,
  onUpdateStatus,
  isUpdatingStatus = false,
  loading = false
}: ReorderAlertsProps) {
  const t = useT()
  const [statusDrafts, setStatusDrafts] = useState<Record<string, 'ACTIVE' | 'DISMISSED' | 'RESOLVED'>>({})

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    if (!t) return fallback
    const translated = t(key)
    return translated === key ? fallback : translated
  }

  const getSeverityColor = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case 'high': return 'bg-red-100 text-red-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'low': return 'bg-blue-100 text-blue-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getAlertTypeColor = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'stockout_risk': return 'bg-red-100 text-red-800'
      case 'overstock': return 'bg-orange-100 text-orange-800'
      case 'reorder_point': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const formatAlertType = (type: string) => {
    return type.replace(/_/g, ' ')
  }

  const statusOptions = useMemo(
    () => ['ACTIVE', 'DISMISSED', 'RESOLVED'] as const,
    []
  )

  useEffect(() => {
    const nextDrafts: Record<string, 'ACTIVE' | 'DISMISSED' | 'RESOLVED'> = {}
    for (const alert of alerts) {
      nextDrafts[alert.id] = alert.status
    }
    setStatusDrafts(nextDrafts)
  }, [alerts])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="bg-gray-50/30">
            <th className="py-4 px-8 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{getText('merchant.inventory.product', 'Ident') || 'Ident'}</th>
            <th className="py-4 px-6 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{getText('merchant.inventory.alertType', 'Signal') || 'Signal'}</th>
            <th className="py-4 px-6 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{getText('merchant.inventory.severity', 'Priority') || 'Priority'}</th>
            <th className="py-4 px-6 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status</th>
            <th className="py-4 px-6 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{getText('merchant.inventory.currentStock', 'Volume') || 'Volume'}</th>
            <th className="py-4 px-6 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Recommended Action</th>
            <th className="py-4 px-8 text-right text-[10px] font-bold text-gray-400 uppercase tracking-widest">Op-Center</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {alerts.length === 0 && (
            <tr>
              <td colSpan={7} className="py-20 text-center">
                <div className="flex flex-col items-center opacity-30">
                  <Box className="w-12 h-12 mb-3" />
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em]">Signal Matrix Clear</p>
                </div>
              </td>
            </tr>
          )}
          {alerts.map((alert) => (
            <tr key={alert.id} className="group hover:bg-blue-50/30 transition-colors">
              <td className="py-4 px-8">
                <div className="flex flex-col">
                  <span className="font-bold text-gray-900 text-sm truncate max-w-[200px]">{alert.productName || 'Unnamed Unit'}</span>
                  <span className="font-mono text-[9px] font-bold text-gray-400 mt-0.5">#{alert.productId.substring(0, 8).toUpperCase()}</span>
                  {alert.variantName && (
                    <span className="text-[10px] text-gray-500 truncate max-w-[240px]">{alert.variantName}</span>
                  )}
                  {alert.variantId && (
                    <span className="font-mono text-[9px] text-gray-400">VAR #{alert.variantId.substring(0, 8).toUpperCase()}</span>
                  )}
                </div>
              </td>
              <td className="py-4 px-6">
                <div className={cn(
                  "inline-flex px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest border",
                  getAlertTypeColor(alert.alertType)
                )}>
                  {formatAlertType(alert.alertType)}
                </div>
              </td>
              <td className="py-4 px-6">
                <div className={cn(
                  "inline-flex px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest border",
                  getSeverityColor(alert.severity)
                )}>
                  {alert.severity}
                </div>
              </td>
              <td className="py-4 px-6">
                <Badge
                  variant="outline"
                  className="text-[9px] font-bold uppercase tracking-widest"
                >
                  {alert.status}
                </Badge>
              </td>
              <td className="py-4 px-6">
                <div className="space-y-1">
                  <div className="font-bold text-gray-900 text-sm">{alert.currentStock}</div>
                  <div className="text-[10px] text-gray-500">
                    Threshold: {alert.threshold ?? '-'}
                  </div>
                </div>
              </td>
              <td className="py-4 px-6">
                <div className="space-y-1.5 max-w-[280px]">
                  <p className="text-xs text-gray-500 font-medium leading-relaxed line-clamp-2">{alert.message}</p>
                  <div className="text-[10px] text-gray-500">
                    Recommended Order: {alert.recommendedOrder ?? '-'}
                  </div>
                  <div className="text-[10px] text-gray-400">
                    Created: {new Date(alert.createdAt).toLocaleString()}
                  </div>
                  <div className="text-[10px] text-gray-400">
                    Updated: {new Date(alert.updatedAt).toLocaleString()}
                  </div>
                  {alert.resolvedAt && (
                    <div className="text-[10px] text-gray-400">
                      Resolved: {new Date(alert.resolvedAt).toLocaleString()}
                    </div>
                  )}
                </div>
              </td>
              <td className="py-4 px-8 text-right">
                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onResolve?.(alert.id)}
                    disabled={isUpdatingStatus || alert.status === 'RESOLVED'}
                    className="h-8 rounded-lg text-blue-600 hover:bg-blue-50 font-bold text-[10px] uppercase tracking-widest px-3"
                  >
                    Resolve
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDismiss?.(alert.id)}
                    className="w-8 h-8 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"
                  >
                    <Box className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
