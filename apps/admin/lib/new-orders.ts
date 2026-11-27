/**
 * The sidebar's orders badge: how many orders came in since the operator last
 * looked at the orders. The look is remembered in this browser, per account.
 */

/** admin user id → when that account last looked at the orders (ISO). */
export type OrdersSeen = Record<string, string>

export const ORDERS_SEEN_KEY = 'jiffoo.orders.seen.v1'

/** How many of the newest orders are fetched to answer "anything new?". */
export const NEW_ORDERS_PAGE = 50

interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

function storage(): StorageLike | undefined {
  if (typeof window === 'undefined') return undefined
  try {
    return window.localStorage
  } catch {
    // Storage can be refused (private modes, embedded views); the badge then simply stays off.
    return undefined
  }
}

export function readOrdersSeen(store: StorageLike | undefined = storage()): OrdersSeen {
  const raw = store?.getItem(ORDERS_SEEN_KEY)
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const seen: OrdersSeen = {}
    for (const [id, at] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof at === 'string' && Number.isFinite(Date.parse(at))) seen[id] = at
    }
    return seen
  } catch {
    return {}
  }
}

export function writeOrdersSeen(seen: OrdersSeen, store: StorageLike | undefined = storage()): void {
  try {
    store?.setItem(ORDERS_SEEN_KEY, JSON.stringify(seen))
  } catch {
    // A full or refused store only costs the badge its memory.
  }
}

/** When the account last looked at the orders; null before the first look. */
export function ordersSeenAt(seen: OrdersSeen, userId: string | null | undefined): string | null {
  if (!userId) return null
  return seen[userId] ?? null
}

export function rememberOrdersSeen(seen: OrdersSeen, userId: string, at: string): OrdersSeen {
  return { ...seen, [userId]: at }
}

/**
 * Orders placed after the last look. Before a first look nothing is new: the
 * orders that exist are not news. When the whole page is newer, the answer is
 * "at least this many".
 */
export function countNewOrders(orders: Array<{ createdAt?: string }>, seenAt: string | null): number {
  if (!seenAt) return 0
  return orders.filter((order) => typeof order.createdAt === 'string' && order.createdAt > seenAt).length
}

/** `{count}+` once the page could not hold everything that is new. */
export function newOrdersLabel(count: number): string {
  const atLeast = count >= NEW_ORDERS_PAGE
  const shown = count > 99 ? 99 : count
  return `${shown}${atLeast ? '+' : ''}`
}
