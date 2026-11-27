'use client'

/**
 * The count behind the sidebar's orders badge: orders placed since the account
 * last looked at the orders. Opening the orders, or being on an orders page,
 * counts as looking.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ordersApi, unwrapApiResponse } from '@/lib/api'
import {
  countNewOrders,
  NEW_ORDERS_PAGE,
  ordersSeenAt,
  readOrdersSeen,
  rememberOrdersSeen,
  writeOrdersSeen,
} from '@/lib/new-orders'

/** How often the newest orders are asked for while an admin page is open. */
export const NEW_ORDERS_REFRESH_MS = 60 * 1000

export function useNewOrders(options: { userId: string | null; enabled: boolean; onOrdersPage: boolean }) {
  const { userId, enabled, onOrdersPage } = options
  const [seenAt, setSeenAt] = useState<string | null>(null)

  useEffect(() => {
    setSeenAt(ordersSeenAt(readOrdersSeen(), userId))
  }, [userId])

  const query = useQuery({
    queryKey: ['admin', 'new-orders', userId],
    queryFn: async () => {
      const response = await ordersApi.getAll(1, NEW_ORDERS_PAGE)
      return unwrapApiResponse(response).items ?? []
    },
    enabled: enabled && Boolean(userId),
    refetchInterval: NEW_ORDERS_REFRESH_MS,
    staleTime: 20 * 1000,
  })

  const markSeen = useCallback(() => {
    if (!userId) return
    const at = new Date().toISOString()
    setSeenAt(at)
    writeOrdersSeen(rememberOrdersSeen(readOrdersSeen(), userId, at))
  }, [userId])

  // On an orders page the orders are in front of the operator: keep the mark at "now".
  const refreshedAt = query.dataUpdatedAt
  useEffect(() => {
    if (onOrdersPage) markSeen()
  }, [onOrdersPage, markSeen, refreshedAt])

  const count = useMemo(() => countNewOrders(query.data ?? [], seenAt), [query.data, seenAt])
  return { count, markSeen }
}
