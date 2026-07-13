'use client'

/**
 * Instance Health & Version Card
 *
 * Compact card for the Admin dashboard showing:
 * - Current version
 * - Whether an update is available
 * - Deployment mode
 *
 * Data comes from the existing upgrade API (`/api/v1/upgrade/version`).
 * This is display-only — no upgrade execution.
 */

import { useEffect, useState } from 'react'
import { ArrowUpCircle, CheckCircle2, Server, Activity } from 'lucide-react'
import { useT } from 'shared/src/i18n/react'
import { cn } from '@/lib/utils'
import { upgradeApi, unwrapApiResponse } from '@/lib/api'
import { resolveApiErrorMessage } from '@/lib/error-utils'

interface VersionInfo {
  currentVersion: string
  latestVersion: string
  updateAvailable: boolean
  releaseChannel: 'stable' | 'prerelease'
  deploymentMode: 'single-host' | 'docker-compose' | 'k8s' | 'unsupported'
  oneClickUpgradeSupported: boolean
  manifestStatus: 'available' | 'missing' | 'unreachable' | 'invalid'
}

function formatDeploymentMode(mode: string): string {
  switch (mode) {
    case 'single-host': return 'Single Host'
    case 'docker-compose': return 'Docker Compose'
    case 'k8s': return 'Kubernetes'
    default: return mode
  }
}

function formatChannel(channel: string): string {
  return channel === 'stable' ? 'Stable' : 'Pre-release'
}

export function InstanceHealthCard() {
  const t = useT()
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadVersion() {
      try {
        const response = await upgradeApi.getVersion()
        const data = unwrapApiResponse(response) as VersionInfo
        if (!cancelled) {
          setVersionInfo(data)
          setError(null)
        }
      } catch (err) {
        if (!cancelled) {
          setError(resolveApiErrorMessage(err, t))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadVersion()
    return () => { cancelled = true }
  }, [])

  if (loading) {
    return (
      <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-100 rounded w-1/3" />
          <div className="h-8 bg-gray-100 rounded w-1/2" />
          <div className="h-4 bg-gray-100 rounded w-2/3" />
        </div>
      </div>
    )
  }

  if (error || !versionInfo) {
    return null // Silently hide on error — non-critical
  }

  const hasUpdate = versionInfo.updateAvailable
  const manifestHealthy = versionInfo.manifestStatus === 'available'

  return (
    <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-blue-500" />
          <h3 className="text-sm font-bold text-gray-900">Instance Health</h3>
        </div>
        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
          Version & Status
        </span>
      </div>

      <div className="p-6 space-y-4">
        {/* Version row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                Current Version
              </p>
              <p className="text-lg font-black text-gray-900 tracking-tight">
                {versionInfo.currentVersion}
              </p>
            </div>
          </div>

          {hasUpdate ? (
            <a
              href="/settings"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 text-xs font-bold hover:bg-amber-100 transition-colors"
            >
              <ArrowUpCircle className="h-3.5 w-3.5" />
              Update available: {versionInfo.latestVersion}
            </a>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 text-green-700 text-xs font-bold">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Up to date
            </span>
          )}
        </div>

        {/* Deployment info */}
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-50">
          <div>
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">
              Deployment
            </p>
            <div className="flex items-center gap-1.5">
              <Server className="h-3.5 w-3.5 text-gray-400" />
              <span className="text-sm font-semibold text-gray-700">
                {formatDeploymentMode(versionInfo.deploymentMode)}
              </span>
            </div>
          </div>
          <div>
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">
              Channel
            </p>
            <span className={cn(
              'inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide',
              versionInfo.releaseChannel === 'stable'
                ? 'bg-blue-50 text-blue-600'
                : 'bg-purple-50 text-purple-600',
            )}>
              {formatChannel(versionInfo.releaseChannel)}
            </span>
          </div>
        </div>

        {/* Manifest health */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-50">
          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
            Update Feed
          </span>
          <div className="flex items-center gap-1.5">
            <span className={cn(
              'h-2 w-2 rounded-full',
              manifestHealthy ? 'bg-green-400' : 'bg-gray-300',
            )} />
            <span className="text-xs text-gray-500">
              {manifestHealthy ? 'Connected' : 'Unavailable'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
