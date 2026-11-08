/**
 * Support Inbox Bell
 *
 * Top-bar bell for storefront support-chat activity: polls the support-hub
 * adapter's unread-count endpoint, shows a red dot while visitor messages
 * are unread, and lists the recent conversations in the dropdown with a
 * link to the /support page. Rendered only for operators holding
 * support.read; failures stay silent (notification surfaces are
 * best-effort, mirroring UpdateNotificationBell).
 */

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { MessagesSquare } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import { apiClient, unwrapApiResponse } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import { canAccessAnyPermission } from '@/lib/admin-access'
import { ADMIN_PERMISSIONS } from 'shared'
import { useLocale, useT } from 'shared/src/i18n/react'

interface UnreadInfo {
  unread: number
}

interface SupportConversation {
  id: string
  visitorToken: string
  messageCount: number
  lastMessage: string | null
  updatedAt: string
}

/** Client-side refresh cadence for the unread badge. */
const REFRESH_INTERVAL_MS = 45 * 1000

export function SupportInboxBell() {
  const locale = useLocale()
  const t = useT()
  const user = useAuthStore((state) => state.user)
  const allowed = canAccessAnyPermission(user, [ADMIN_PERMISSIONS.SUPPORT_READ])
  const [unread, setUnread] = useState(0)
  const [conversations, setConversations] = useState<SupportConversation[]>([])
  const loadingRef = useRef(false)
  const mountedRef = useRef(false)

  const getText = (key: string, fallback: string): string => {
    if (!t) return fallback
    const translated = t(key)
    return translated === key ? fallback : translated
  }

  const refresh = useCallback(async () => {
    if (loadingRef.current) return
    loadingRef.current = true
    try {
      const unreadResponse = await apiClient.get(
        '/extensions/plugin/support-hub/api/admin/conversations/unread-count',
        { headers: { 'x-installation-id': 'default' } },
      )
      const unreadData = unwrapApiResponse<UnreadInfo>(unreadResponse)
      setUnread(typeof unreadData?.unread === 'number' ? unreadData.unread : 0)

      const listResponse = await apiClient.get(
        '/extensions/plugin/support-hub/api/admin/conversations',
        { headers: { 'x-installation-id': 'default' } },
      )
      const listData = unwrapApiResponse<{ conversations?: SupportConversation[] }>(listResponse)
      setConversations((listData?.conversations ?? []).slice(0, 5))
    } catch {
      // Keep the bell silent on failures — the plugin may not be installed.
      setUnread(0)
      setConversations([])
    } finally {
      loadingRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!allowed || mountedRef.current) return
    mountedRef.current = true
    void refresh()
    const interval = setInterval(() => void refresh(), REFRESH_INTERVAL_MS)
    const onFocus = () => void refresh()
    window.addEventListener('focus', onFocus)
    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', onFocus)
    }
  }, [allowed, refresh])

  if (!allowed) return null

  return (
    <DropdownMenu onOpenChange={(open) => { if (open) void refresh() }}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={getText('merchant.header.supportInbox', '客服消息 / Support inbox')}
          className="relative rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
        >
          <MessagesSquare className="h-[18px] w-[18px]" />
          {unread > 0 && (
            <span
              aria-hidden
              className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-[#f5f7fb]"
            >
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 rounded-2xl border-gray-100 p-2 shadow-2xl">
        <p className="px-3 pb-2 pt-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
          {getText('merchant.header.supportInbox', '客服消息 / Support inbox')}
          {unread > 0 ? ` · ${unread}` : ''}
        </p>
        {conversations.length === 0 ? (
          <div className="flex items-start gap-3 rounded-xl p-3">
            <MessagesSquare className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
            <div>
              <p className="text-sm font-bold text-gray-900">
                {getText('merchant.header.supportAllRead', '暂无新访客消息')}
              </p>
              <p className="mt-0.5 text-xs text-gray-500">
                {getText('merchant.header.supportAllReadHint', '店面客服聊天的新消息会出现在这里')}
              </p>
            </div>
          </div>
        ) : (
          conversations.map((conversation) => (
            <Link
              key={conversation.id}
              href={`/${locale}/support`}
              className="block rounded-xl p-3 transition-colors hover:bg-blue-50/70"
            >
              <div className="flex items-start gap-3">
                <MessagesSquare className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-gray-900">
                    {conversation.lastMessage || getText('merchant.header.supportEmptyConversation', '(no messages)')}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {conversation.visitorToken.slice(0, 12)}… · {conversation.messageCount}{' '}
                    {getText('merchant.header.supportMessages', 'messages')} ·{' '}
                    {new Date(conversation.updatedAt).toLocaleString()}
                  </p>
                </div>
              </div>
            </Link>
          ))
        )}
        <Link
          href={`/${locale}/support`}
          className="mt-1 block rounded-xl border-t border-gray-100 px-3 py-2 text-center text-xs font-semibold text-blue-600 transition-colors hover:bg-blue-50/70"
        >
          {getText('merchant.header.openSupportInbox', '打开客服工作台 →')}
        </Link>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default SupportInboxBell
