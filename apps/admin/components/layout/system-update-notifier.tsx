'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useLocale, useT } from 'shared/src/i18n/react'
import { useUpdateCheck } from '@/hooks/use-update-check'

const TOAST_SEEN_PREFIX = 'jiffoo_update_toast_seen:'

export function SystemUpdateNotifier() {
  const router = useRouter()
  const pathname = usePathname()
  const locale = useLocale()
  const t = useT()
  const {
    hasUpdate,
    isLoading,
    currentVersion,
    latestVersion,
  } = useUpdateCheck()

  const getText = (key: string, fallback: string): string => {
    if (!t) return fallback
    const translated = t(key)
    return translated === key ? fallback : translated
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (isLoading || !hasUpdate || !latestVersion) return

    const isUpdatesPage =
      pathname.includes('/system/updates') || pathname.includes('/settings')
    if (isUpdatesPage) {
      return
    }

    const seenKey = `${TOAST_SEEN_PREFIX}${latestVersion}`
    if (window.localStorage.getItem(seenKey) === 'shown') {
      return
    }

    window.localStorage.setItem(seenKey, 'shown')

    toast.info(
      getText('merchant.systemUpdates.updateAvailable', 'Update Available'),
      {
        id: `system-update-${latestVersion}`,
        description: getText(
          'merchant.systemUpdates.proactiveHint',
          `A newer Jiffoo core release is ready: ${currentVersion || '-'} -> ${latestVersion}.`
        ),
        duration: 12000,
        action: {
          label: getText('merchant.systemUpdates.openUpdateCenter', 'Open Update Center'),
          onClick: () => router.push(`/${locale}/system/updates`),
        },
      }
    )
  }, [
    currentVersion,
    getText,
    hasUpdate,
    isLoading,
    latestVersion,
    locale,
    pathname,
    router,
  ])

  return null
}
