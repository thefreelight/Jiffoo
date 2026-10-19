// @vitest-environment jsdom

import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'
import ForgotPasswordPage from '@/app/[locale]/(themed)/auth/forgot-password/page'
import StaffDetailPage from '@/app/[locale]/(themed)/staff/[id]/page'
import CustomerDetailPage from '@/app/[locale]/(themed)/customers/[id]/page'

const customerOrders = vi.hoisted(() => ({ recent: [] as any[], address: null as any }));
const { forgotPassword, generateResetLink, generateInviteLink } = vi.hoisted(() => ({
  forgotPassword: vi.fn(),
  generateResetLink: vi.fn(),
  generateInviteLink: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  usePathname: () => '/en/auth/forgot-password',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ id: 'staff-1' }),
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}))
vi.mock('shared/src/i18n/react', () => ({
  useLocale: () => 'en',
  useT: () => (key: string, values?: Record<string, string | number>) => key + (values ? ' ' + Object.values(values).join(' ') : ''),
}))
vi.mock('@/lib/api', () => ({
  authApi: { forgotPassword },
  usersApi: { generateResetLink },
  staffApi: { generateInviteLink },
  unwrapApiResponse: <T,>(response: { data: T }) => response.data,
}))
vi.mock('@/lib/store', () => ({
  useAuthStore: () => ({ user: { role: 'ADMIN' } }),
}))
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn() }) }))
vi.mock('@/lib/hooks/use-api', () => ({
  useAdminDashboard: () => ({ data: null }),
  useUser: () => ({
    data: {
      id: 'customer-1', username: 'buyer', email: 'buyer@example.com',
      role: 'USER', isActive: true, avatar: null, locale: null, emailVerified: false,
      orderCount: 0, paidTotal: 0, currency: 'USD', lastOrderAt: null, recentOrders: customerOrders.recent, latestShippingAddress: customerOrders.address,
      createdAt: '2026-09-23T00:00:00.000Z', updatedAt: '2026-09-23T00:00:00.000Z',
    },
    isLoading: false, error: null, refetch: vi.fn(),
  }),
  useUpdateUser: () => ({ mutateAsync: vi.fn() }),
  useDeleteUser: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCustomerNeighbors: () => ({ data: { position: 1, total: 1, previousId: null, nextId: null }, error: null }),
  useStaffMember: () => ({
    data: {
      id: 'staff-1', username: 'invited', email: 'invited@example.com',
      role: 'ADMIN', isActive: false, isInstallAdmin: false,
      emailVerified: false, createdAt: '2026-09-23T00:00:00.000Z',
      updatedAt: '2026-09-23T00:00:00.000Z',
    },
    isLoading: false, error: null, refetch: vi.fn(),
  }),
  useStaffAuditLogs: () => ({
    data: { data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 1 } },
    isLoading: false,
  }),
  useResendStaffInvite: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useRemoveStaff: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useReinviteStaff: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useStaffNeighbors: () => ({ data: { position: 1, total: 1, previousId: null, nextId: null } }),
}))

describe('Admin account links', () => {
  let root: Root
  let container: HTMLDivElement

  beforeEach(() => {
    vi.clearAllMocks()
    customerOrders.recent = []; customerOrders.address = null;
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    forgotPassword.mockResolvedValue({ data: { requested: true } })
    generateResetLink.mockResolvedValue({ data: { link: 'https://store.example/reset-password?token=one' } })
    generateInviteLink.mockResolvedValue({ data: { link: 'https://admin.example/en/auth/accept-invite?token=two' } })
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
  })

  it('requests the Admin password reset through the real client method', async () => {
    await act(async () => root.render(<ForgotPasswordPage />))
    const email = container.querySelector<HTMLInputElement>('input[type="email"]')!
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
      setter.call(email, '  Buyer@Example.com  ')
      email.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => container.querySelector('form')!.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    ))
    expect(forgotPassword).toHaveBeenCalledWith('buyer@example.com')
    expect(container.textContent).toContain('merchant.authFlow.sentDescription')
  })

  it('generates the reset link immediately and shows an inline panel', async () => {
    await act(async () => root.render(<CustomerDetailPage />))
    const button = Array.from(container.querySelectorAll('button')).find(item => item.textContent === 'merchant.customers.workspace.generateLink')!
    await act(async () => button.click())
    expect(generateResetLink).toHaveBeenCalledTimes(1)
    expect(generateResetLink).toHaveBeenCalledWith('staff-1')
    expect(container.querySelector<HTMLInputElement>('input[aria-label="merchant.customers.workspace.resetLink"]')?.value).toContain('token=one')
    expect(container.querySelector('[role="dialog"]')).toBeNull()
    expect(container.textContent).toContain('merchant.customers.workspace.linkNote')
  })

  it('shows readable numbers in customer orders and address provenance while linking by internal id', async () => {
    customerOrders.recent = [{ id: 'internal-order', orderNumber: 'JF-20261012-0001', status: 'PROCESSING', paymentStatus: 'PAID', totalAmount: 20, currency: 'USD', createdAt: '2026-10-12T00:00:00Z' }];
    customerOrders.address = { orderId: 'internal-order', orderNumber: 'JF-20261012-0001', recipientName: 'Buyer', street: '1 Road', city: 'City', country: 'US' };
    await act(async () => root.render(<CustomerDetailPage />));
    expect(container.textContent).toContain('JF-20261012-0001');
    expect(container.textContent).not.toContain('internal-order');
    expect(container.querySelectorAll('a[href="/en/orders/internal-order"]')).toHaveLength(3);
  })

  it('shows an Admin invite link on staff detail', async () => {
    await act(async () => root.render(<StaffDetailPage />))
    const button = Array.from(container.querySelectorAll('button')).find((item) => item.textContent === 'merchant.staffView.copyInvite')
    expect(button).toBeDefined()
    await act(async () => button!.click())
    expect(generateInviteLink).toHaveBeenCalledWith('staff-1')
    expect(container.textContent).toContain('merchant.staffView.copyLink')
  })
})
