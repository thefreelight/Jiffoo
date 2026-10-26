/**
 * Update Notification Bell
 *
 * Top-bar bell that surfaces "new upstream version available" from the
 * core update manifest (GET /api/upgrade/version, admin-authed). Replaces
 * the previous static always-on red dot: the dot now appears only when an
 * update is actually available, and the dropdown links to the updates page.
 */

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowUpCircle, Bell, CheckCircle2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import { apiClient, unwrapApiResponse } from '@/lib/api'
import { useLocale, useT } from 'shared/src/i18n/react'

interface UpdateVersionInfo {
  currentVersion: string | null
  latestVersion: string | null
  updateAvailable: boolean
  releaseNotes: string | null
  changelogUrl: string | null
}

/** Client-side refresh TTL — the backend caches the manifest for 5 minutes. */
const REFRESH_INTERVAL_MS = 10 * 60 * 1000

export function UpdateNotificationBell() {
  const locale = useLocale()
  const t = useT()
  const [info, setInfo] = useState<UpdateVersionInfo | null>(null)
  const [loadedAt, setLoadedAt] = useState(0)
  const loadingRef = useRef(false)
  const mountedRef = useRef(false)

  const getText = (key: string, fallback: string): string => {
    if (!t) return fallback
    const translated = t(key)
    return translated === key ? fallback : translated
  }

  const refresh = useCallback(
    async (force = false) => {
      if (loadingRef.current) return
      if (!force && Date.now() - loadedAt < REFRESH_INTERVAL_MS) return
      loadingRef.current = true
      try {
        const response = await apiClient.get('/upgrade/version')
        setInfo(unwrapApiResponse<UpdateVersionInfo>(response))
        setLoadedAt(Date.now())
      } catch {
        // Keep the bell silent on failures — availability checks are best-effort.
      } finally {
        loadingRef.current = false
      }
    },
    [loadedAt],
  )

  // Fetch once on mount; guard against re-running when the callback identity
  // changes after a successful load.
  useEffect(() => {
    if (mountedRef.current) return
    mountedRef.current = true
    void refresh(true)
  }, [refresh])

  const updateAvailable = info?.updateAvailable === true

  return (
    <DropdownMenu onOpenChange={(open) => { if (open) void refresh() }}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={getText('merchant.header.notifications', 'Notifications')}
          className="relative rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
        >
          <Bell className="h-[18px] w-[18px]" />
          {updateAvailable && (
            <span aria-hidden className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500 ring-2 ring-[#f5f7fb]" />
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 rounded-2xl border-gray-100 p-2 shadow-2xl">
        {updateAvailable ? (
          <Link
            href={`/${locale}/system/updates`}
            className="block rounded-xl p-3 transition-colors hover:bg-blue-50/70"
          >
            <div className="flex items-start gap-3">
              <ArrowUpCircle className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
              <div className="min-w-0">
                <p className="text-sm font-bold text-gray-900">
                  {getText('merchant.header.updateAvailable', '新版本可用 / Update available')}
                </p>
                <p className="mt-0.5 text-xs text-gray-500">
                  {info?.currentVersion || '?'} →{' '}
                  <span className="font-semibold text-blue-700">v{info?.latestVersion || '?'}</span>
                </p>
                {info?.releaseNotes && (
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-gray-500">{info.releaseNotes}</p>
                )}
                <p className="mt-1.5 text-xs font-semibold text-blue-600">
                  {getText('merchant.header.viewUpgrade', '查看升级方式 →')}
                </p>
              </div>
            </div>
          </Link>
        ) : (
          <div className="flex items-start gap-3 rounded-xl p-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
            <div>
              <p className="text-sm font-bold text-gray-900">
                {getText('merchant.header.upToDate', '系统已是最新 / Up to date')}
              </p>
              <p className="mt-0.5 text-xs text-gray-500">
                {info?.currentVersion ? `v${info.currentVersion}` : getText('merchant.header.updateUnavailable', '暂无版本信息')}
              </p>
            </div>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default UpdateNotificationBell
