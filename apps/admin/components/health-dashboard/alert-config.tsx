/**
 * Alert Threshold Configuration Component
 *
 * Provides configuration interface for health monitoring alert thresholds.
 * Allows setting warning and critical levels for various system metrics.
 */

'use client'

import { Settings, Save, AlertTriangle, Bell } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useT } from 'shared/src/i18n/react'
import { toast } from 'sonner'

interface AlertThreshold {
  warning: number
  critical: number
}

interface AlertThresholds {
  cpuUsage: AlertThreshold
  memoryUsage: AlertThreshold
  diskUsage: AlertThreshold
  errorRate: AlertThreshold
  responseTime: AlertThreshold
  cacheHitRate: AlertThreshold
}

interface AlertConfigProps {
  initialThresholds?: Partial<AlertThresholds>
  onSave?: (thresholds: AlertThresholds) => Promise<void>
  isLoading?: boolean
}

const DEFAULT_THRESHOLDS: AlertThresholds = {
  cpuUsage: { warning: 70, critical: 90 },
  memoryUsage: { warning: 75, critical: 90 },
  diskUsage: { warning: 80, critical: 95 },
  errorRate: { warning: 1, critical: 5 },
  responseTime: { warning: 500, critical: 1000 },
  cacheHitRate: { warning: 70, critical: 50 },
}

export function AlertConfig({ initialThresholds, onSave, isLoading }: AlertConfigProps) {
  const t = useT()
  const [thresholds, setThresholds] = useState<AlertThresholds>({
    ...DEFAULT_THRESHOLDS,
    ...initialThresholds,
  })
  const [saving, setSaving] = useState(false)

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback
  }

  const handleThresholdChange = (
    metric: keyof AlertThresholds,
    level: 'warning' | 'critical',
    value: string
  ) => {
    const numValue = parseFloat(value)
    if (!isNaN(numValue)) {
      setThresholds(prev => ({
        ...prev,
        [metric]: {
          ...prev[metric],
          [level]: numValue,
        },
      }))
    }
  }

  const handleSave = async () => {
    // Validate thresholds
    const errors: string[] = []
    Object.entries(thresholds).forEach(([metric, threshold]) => {
      if (threshold.warning >= threshold.critical && metric !== 'cacheHitRate') {
        errors.push(getText(`admin.health.alerts.${metric}`, metric))
      }
      // For cache hit rate, warning should be higher than critical (inverted logic)
      if (metric === 'cacheHitRate' && threshold.warning <= threshold.critical) {
        errors.push(getText('admin.health.alerts.cacheHitRate', 'Cache Hit Rate'))
      }
    })

    if (errors.length > 0) {
      toast.error(
        getText(
          'admin.health.alerts.validationError',
          `Warning threshold must be less than critical threshold for: ${errors.join(', ')}`
        )
      )
      return
    }

    setSaving(true)
    try {
      if (onSave) {
        await onSave(thresholds)
      }
      toast.success(getText('admin.health.alerts.saveSuccess', 'Alert thresholds saved successfully'))
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      toast.error(getText('admin.health.alerts.saveFailed', 'Failed to save alert thresholds: ') + errorMsg)
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    setThresholds(DEFAULT_THRESHOLDS)
    toast.success(getText('admin.health.alerts.resetSuccess', 'Alert thresholds reset to defaults'))
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse">
        <div className="h-96"></div>
      </div>
    )
  }

  const metricConfigs = [
    {
      key: 'cpuUsage' as keyof AlertThresholds,
      label: getText('admin.health.alerts.cpuUsage', 'CPU Usage'),
      unit: '%',
      description: getText('admin.health.alerts.cpuUsageDesc', 'CPU usage percentage threshold'),
    },
    {
      key: 'memoryUsage' as keyof AlertThresholds,
      label: getText('admin.health.alerts.memoryUsage', 'Memory Usage'),
      unit: '%',
      description: getText('admin.health.alerts.memoryUsageDesc', 'Memory usage percentage threshold'),
    },
    {
      key: 'diskUsage' as keyof AlertThresholds,
      label: getText('admin.health.alerts.diskUsage', 'Disk Usage'),
      unit: '%',
      description: getText('admin.health.alerts.diskUsageDesc', 'Disk usage percentage threshold'),
    },
    {
      key: 'errorRate' as keyof AlertThresholds,
      label: getText('admin.health.alerts.errorRate', 'Error Rate'),
      unit: '%',
      description: getText('admin.health.alerts.errorRateDesc', 'Error rate percentage threshold'),
    },
    {
      key: 'responseTime' as keyof AlertThresholds,
      label: getText('admin.health.alerts.responseTime', 'Response Time'),
      unit: 'ms',
      description: getText('admin.health.alerts.responseTimeDesc', 'Average response time threshold'),
    },
    {
      key: 'cacheHitRate' as keyof AlertThresholds,
      label: getText('admin.health.alerts.cacheHitRate', 'Cache Hit Rate'),
      unit: '%',
      description: getText('admin.health.alerts.cacheHitRateDesc', 'Cache hit rate minimum threshold (inverted)'),
    },
  ]

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
            <Settings className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {getText('admin.health.alerts.title', 'Alert Thresholds')}
            </h3>
            <p className="text-sm text-gray-500">
              {getText('admin.health.alerts.subtitle', 'Configure warning and critical alert levels')}
            </p>
          </div>
        </div>
        <Bell className="w-5 h-5 text-gray-400" />
      </div>

      <div className="space-y-6">
        {metricConfigs.map((config) => (
          <div key={config.key} className="border-b border-gray-100 pb-6 last:border-0 last:pb-0">
            <div className="mb-3">
              <h4 className="text-sm font-medium text-gray-900 mb-1">{config.label}</h4>
              <p className="text-xs text-gray-500">{config.description}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor={`${config.key}-warning`} className="text-xs text-gray-600">
                  {getText('admin.health.alerts.warningLevel', 'Warning Level')}
                </Label>
                <div className="flex items-center space-x-2 mt-1">
                  <Input
                    id={`${config.key}-warning`}
                    type="number"
                    value={thresholds[config.key].warning}
                    onChange={(e) => handleThresholdChange(config.key, 'warning', e.target.value)}
                    className="flex-1"
                    min="0"
                    step={config.unit === 'ms' ? '50' : '1'}
                  />
                  <span className="text-sm text-gray-500 w-12">{config.unit}</span>
                  <div className="w-6 h-6 rounded-full bg-yellow-100 flex items-center justify-center">
                    <AlertTriangle className="w-4 h-4 text-yellow-600" />
                  </div>
                </div>
              </div>
              <div>
                <Label htmlFor={`${config.key}-critical`} className="text-xs text-gray-600">
                  {getText('admin.health.alerts.criticalLevel', 'Critical Level')}
                </Label>
                <div className="flex items-center space-x-2 mt-1">
                  <Input
                    id={`${config.key}-critical`}
                    type="number"
                    value={thresholds[config.key].critical}
                    onChange={(e) => handleThresholdChange(config.key, 'critical', e.target.value)}
                    className="flex-1"
                    min="0"
                    step={config.unit === 'ms' ? '50' : '1'}
                  />
                  <span className="text-sm text-gray-500 w-12">{config.unit}</span>
                  <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center">
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-200">
        <Button
          variant="outline"
          onClick={handleReset}
          disabled={saving}
        >
          {getText('admin.health.alerts.reset', 'Reset to Defaults')}
        </Button>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center space-x-2"
        >
          <Save className="w-4 h-4" />
          <span>{saving ? getText('common.saving', 'Saving...') : getText('common.save', 'Save Changes')}</span>
        </Button>
      </div>

      <div className="mt-4 p-4 bg-blue-50 rounded-lg">
        <div className="flex items-start space-x-3">
          <AlertTriangle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-900">
            <p className="font-medium mb-1">
              {getText('admin.health.alerts.note', 'Note about thresholds')}
            </p>
            <p className="text-blue-700">
              {getText(
                'admin.health.alerts.noteText',
                'Warning alerts trigger notifications. Critical alerts indicate severe issues requiring immediate attention. For Cache Hit Rate, lower values trigger alerts (inverted logic).'
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
