/**
 * Plugin Status Badge Component
 *
 * Displays plugin status with appropriate styling and i18n support.
 */

'use client'

import { CheckCircle, Clock, XCircle } from 'lucide-react'
import { Badge } from '../ui/badge'
import { useT } from 'shared/src/i18n'


interface PluginStatusBadgeProps {
  status: 'ACTIVE' | 'INACTIVE'
  enabled?: boolean
  className?: string
}

export function PluginStatusBadge({ status, enabled, className }: PluginStatusBadgeProps) {
  const t = useT()

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback
  }

  if (status === 'INACTIVE') {
    return (
      <Badge className={`bg-gray-100 text-gray-800 ${className}`}>
        <XCircle className="w-3 h-3 mr-1" />
        {getText('tenant.plugins.status.inactive', 'Inactive')}
      </Badge>
    )
  }

  if (enabled === false) {
    return (
      <Badge className={`bg-yellow-100 text-yellow-800 ${className}`}>
        <Clock className="w-3 h-3 mr-1" />
        {getText('tenant.plugins.status.disabled', 'Disabled')}
      </Badge>
    )
  }

  return (
    <Badge className={`bg-green-100 text-green-800 ${className}`}>
      <CheckCircle className="w-3 h-3 mr-1" />
      {getText('tenant.plugins.status.active', 'Active')}
    </Badge>
  )
}

