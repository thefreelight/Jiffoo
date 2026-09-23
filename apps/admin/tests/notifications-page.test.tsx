// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import NotificationsPage from '@/app/[locale]/notifications/page'

const { getAll, getById, resend } = vi.hoisted(() => ({
  getAll: vi.fn(),
  getById: vi.fn(),
  resend: vi.fn(),
}))

vi.mock('shared/src/i18n/react', () => ({ useT: () => (key: string) => key }))
vi.mock('@/lib/store', () => ({
  useAuthStore: () => ({ user: { role: 'ADMIN', permissions: ['orders.read', 'orders.write'] } }),
}))
vi.mock('@/lib/api', () => ({
  notificationsApi: { getAll, getById, resend },
  unwrapApiResponse: <T,>(response: { data: T }) => response.data,
}))

describe('Admin notifications page', () => {
  let root: Root
  let container: HTMLDivElement
  const item = {
    id: 'notification-1', type: 'payment_received', channel: 'email', recipientUserId: 'user-1',
    toAddress: 'buyer@example.com', locale: 'en', subject: 'Test Store: Payment received',
    html: '<p>Payment received</p>', text: 'Payment received', status: 'SENT',
    attempts: 1, nextAttemptAt: '2026-09-23T00:00:00.000Z', lastError: null,
    providerSlug: 'console-email', providerMessageId: 'message-1',
    relatedType: 'order', relatedId: 'order-1', resentFromId: null,
    createdAt: '2026-09-23T00:00:00.000Z', updatedAt: '2026-09-23T00:00:00.000Z', sentAt: '2026-09-23T00:00:00.000Z',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    getAll.mockResolvedValue({ data: { items: [item], page: 1, limit: 20, total: 1, totalPages: 1 } })
    getById.mockResolvedValue({ data: item })
    resend.mockResolvedValue({ data: { ...item, id: 'notification-2', status: 'PENDING', resentFromId: item.id } })
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
  })

  it('lists persisted notifications and queues a resend from detail', async () => {
    await act(async () => root.render(<NotificationsPage />))
    expect(container.textContent).toContain('buyer@example.com')
    expect(getAll).toHaveBeenCalledWith(1, 20, undefined)
    const row = Array.from(container.querySelectorAll('tr')).find((element) => element.textContent?.includes('buyer@example.com'))
    expect(row).toBeDefined()
    await act(async () => row?.click())
    const resendButton = Array.from(document.body.querySelectorAll('button')).find((element) => element.textContent?.includes('Resend'))
    expect(resendButton).toBeDefined()
    await act(async () => resendButton?.click())
    expect(resend).toHaveBeenCalledWith(item.id)
    expect(getAll).toHaveBeenCalledTimes(2)
  })
})
