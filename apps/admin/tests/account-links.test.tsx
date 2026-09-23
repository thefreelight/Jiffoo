// @vitest-environment jsdom

import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'
import ForgotPasswordPage from '@/app/[locale]/auth/forgot-password/page'
import { GenerateResetLinkDialog } from '@/components/customers/generate-reset-link-dialog'
import StaffDetailPage from '@/app/[locale]/staff/[id]/page'
import CustomerDetailPage from '@/app/[locale]/customers/[id]/page'

const { forgotPassword, generateResetLink, generateInviteLink, authPermissions } = vi.hoisted(() => ({
  forgotPassword: vi.fn(),
  generateResetLink: vi.fn(),
  generateInviteLink: vi.fn(),
  authPermissions: { current: ['customers.write'] as string[] },
}))

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'staff-1' }),
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}))
vi.mock('shared/src/i18n/react', () => ({
  useLocale: () => 'en',
  useT: () => (key: string) => key,
}))
vi.mock('@/lib/api', () => ({
  authApi: { forgotPassword },
  usersApi: { generateResetLink },
  staffApi: { generateInviteLink },
  unwrapApiResponse: <T,>(response: { data: T }) => response.data,
}))
vi.mock('@/lib/store', () => ({
  useAuthStore: () => ({ user: { role: 'OPERATIONS_MANAGER', permissions: authPermissions.current } }),
}))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('@/lib/hooks/use-api', () => ({
  useAdminDashboard: () => ({ data: null }),
  useUser: () => ({
    data: {
      id: 'customer-1', username: 'buyer', email: 'buyer@example.com',
      role: 'USER', isActive: true, avatar: null,
      createdAt: '2026-09-23T00:00:00.000Z', updatedAt: '2026-09-23T00:00:00.000Z',
    },
    isLoading: false, error: null, refetch: vi.fn(),
  }),
  useUpdateUser: () => ({ mutateAsync: vi.fn() }),
  useStaffMember: () => ({
    data: {
      userId: 'staff-1', username: 'invited', email: 'invited@example.com',
      emailVerified: false, effectivePermissions: [], extraPermissions: [],
      revokedPermissions: [], status: 'INVITED', updatedAt: '2026-09-23T00:00:00.000Z',
    },
    isLoading: false, error: null,
  }),
  useStaffAuditLogs: () => ({
    data: { data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 1 } },
    isLoading: false,
  }),
  useResendStaffInvite: () => ({ isPending: false, mutateAsync: vi.fn() }),
}))

describe('Admin account links', () => {
  let root: Root
  let container: HTMLDivElement

  beforeEach(() => {
    vi.clearAllMocks()
    authPermissions.current = ['customers.write']
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
    expect(container.textContent).toContain('If an account exists')
  })

  it('generates and displays the customer reset link once', async () => {
    const account = { id: 'customer-1', email: 'buyer@example.com' }
    await act(async () => root.render(<GenerateResetLinkDialog open onOpenChange={vi.fn()} user={account as never} />))
    const button = Array.from(document.body.querySelectorAll('button')).find((item) => item.textContent?.includes('Generate link'))
    expect(button).toBeDefined()
    await act(async () => button!.click())
    expect(generateResetLink).toHaveBeenCalledTimes(1)
    expect(generateResetLink).toHaveBeenCalledWith('customer-1')
    expect(document.body.querySelector<HTMLInputElement>('input[aria-label="Reset link"]')?.value).toContain('token=one')
    expect(Array.from(document.body.querySelectorAll('button')).some((item) => item.textContent?.includes('Generate link'))).toBe(false)
  })

  it('shows Generate reset link only with customers.credentials.reset', async () => {
    await act(async () => root.render(<CustomerDetailPage />))
    expect(container.textContent).not.toContain('Generate reset link')
    authPermissions.current = ['customers.write', 'customers.credentials.reset']
    await act(async () => root.render(<CustomerDetailPage />))
    expect(container.textContent).toContain('Generate reset link')
  })

  it('shows an Admin invite link on staff detail', async () => {
    await act(async () => root.render(<StaffDetailPage />))
    const button = Array.from(container.querySelectorAll('button')).find((item) => item.textContent?.includes('Show invite link'))
    expect(button).toBeDefined()
    await act(async () => button!.click())
    expect(generateInviteLink).toHaveBeenCalledWith('staff-1')
    expect(container.querySelector<HTMLInputElement>('input[aria-label="Invite link"]')?.value).toContain('token=two')
  })
})
