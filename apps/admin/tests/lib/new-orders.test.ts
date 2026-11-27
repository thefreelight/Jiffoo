import { describe, expect, it } from 'vitest'
import {
  countNewOrders,
  NEW_ORDERS_PAGE,
  newOrdersLabel,
  ORDERS_SEEN_KEY,
  ordersSeenAt,
  readOrdersSeen,
  rememberOrdersSeen,
  writeOrdersSeen,
} from '../../lib/new-orders'

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value) },
  }
}

const SEEN = '2026-11-28T08:00:00.000Z'

describe('the orders badge', () => {
  it('counts the orders placed after the last look, and nothing before a first look', () => {
    const orders = [
      { createdAt: '2026-11-28T09:30:00.000Z' },
      { createdAt: '2026-11-28T09:00:00.000Z' },
      { createdAt: SEEN },
      { createdAt: '2026-11-28T07:00:00.000Z' },
    ]
    // Placed at the very moment of the look: already seen.
    expect(countNewOrders(orders, SEEN)).toBe(2)
    // Never looked: the orders that exist are not news.
    expect(countNewOrders(orders, null)).toBe(0)
    expect(countNewOrders([], SEEN)).toBe(0)
  })

  it('says "at least" once the page could not hold everything that is new', () => {
    expect(newOrdersLabel(3)).toBe('3')
    expect(newOrdersLabel(NEW_ORDERS_PAGE)).toBe('50+')
    expect(newOrdersLabel(NEW_ORDERS_PAGE + 40)).toBe('90+')
    expect(newOrdersLabel(140)).toBe('99+')
  })

  it('remembers the last look per account and forgets what it cannot read', () => {
    const store = memoryStorage({ [ORDERS_SEEN_KEY]: JSON.stringify({ 'admin-1': SEEN, 'admin-2': 'yesterday', 'admin-3': 42 }) })
    const seen = readOrdersSeen(store)
    expect(seen).toEqual({ 'admin-1': SEEN })
    expect(ordersSeenAt(seen, 'admin-1')).toBe(SEEN)
    expect(ordersSeenAt(seen, 'admin-9')).toBeNull()
    expect(ordersSeenAt(seen, null)).toBeNull()

    const next = rememberOrdersSeen(seen, 'admin-2', '2026-11-28T10:00:00.000Z')
    writeOrdersSeen(next, store)
    expect(readOrdersSeen(store)).toEqual({ 'admin-1': SEEN, 'admin-2': '2026-11-28T10:00:00.000Z' })
  })

  it('starts over from a damaged or missing record instead of failing', () => {
    expect(readOrdersSeen(memoryStorage())).toEqual({})
    expect(readOrdersSeen(memoryStorage({ [ORDERS_SEEN_KEY]: '{not json' }))).toEqual({})
    expect(readOrdersSeen(memoryStorage({ [ORDERS_SEEN_KEY]: '["a"]' }))).toEqual({})
    // A store that refuses to write costs the badge its memory, nothing else.
    const refusing = { getItem: () => null, setItem: () => { throw new Error('QuotaExceededError') } }
    expect(() => writeOrdersSeen({ 'admin-1': SEEN }, refusing)).not.toThrow()
  })
})
