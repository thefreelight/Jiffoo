/**
 * Plugin Status Badge Component
 *
 * Displays plugin status with appropriate styling and i18n support.
 */

'use client'

import { CheckCircle, Clock, XCircle } from 'lucide-react'
import { Badge } from '../ui/badge'
import { useT } from 'shared/src/i18n/react'


interface PluginStatusBadgeProps {
  status: 'ACTIVE' | 'INACTIVE'
  enabled?: boolean
  className?: string
}

export function PluginStatusBadge({ status, enabled, className }: PluginStatusBadgeProps) {
  const t = useT()

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    if (!t) return fallback
    try {
      const translated = t(key)
      // If translation returns the key itself or contains the key, use fallback
      if (!translated || translated === key || translated.includes('.plugins.status.')) {
        return fallback
      }
      return translated
    } catch {
      return fallback
    }
  }

  if (status === 'INACTIVE') {
    return (
      <Badge className={`bg-neutral-faint text-neutral-dark ${className}`}>
        <XCircle className="w-3 h-3 mr-1" />
        {getText('merchant.plugins.status.inactive', 'Inactive')}
      </Badge>
    )
  }

  if (enabled === false) {
    return (
      <Badge className={`bg-warning-faint text-warning-dark ${className}`}>
        <Clock className="w-3 h-3 mr-1" />
        {getText('merchant.plugins.status.disabled', 'Disabled')}
      </Badge>
    )
  }

  return (
    <Badge className={`bg-success-faint text-success-dark ${className}`}>
      <CheckCircle className="w-3 h-3 mr-1" />
      {getText('merchant.plugins.status.active', 'Active')}
    </Badge>
  )
}

