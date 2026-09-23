// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ProfileSecurityCard } from '@/components/profile/ProfileSecurityCard'
import { useChangePassword } from '@/lib/hooks/use-api'
import { apiClient, authApi } from '@/lib/api'
import { useAuthStore } from '@/lib/store'

vi.mock('shared/src/i18n/react', () => ({ useT: () => (key: string) => key }))

describe('Admin password change session', () => {
  let root: Root
  let container: HTMLDivElement

  function Security() {
    const changePassword = useChangePassword()
    return <ProfileSecurityCard
      initialEmail="admin@example.com"
      isProfileLoading={false}
      isUpdatingEmail={false}
      isChangingPassword={changePassword.isPending}
      onUpdateEmail={async () => undefined}
      onChangePassword={(payload) => changePassword.mutateAsync(payload)}
      t={(_, fallback) => fallback}
    />
  }

  beforeEach(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    useAuthStore.setState({ isAuthenticated: true, user: null })
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    vi.restoreAllMocks()
    apiClient.clearAuth()
    container.remove()
  })

  it('stores returned access and refresh tokens and remains authenticated after changing password', async () => {
    vi.spyOn(authApi, 'changePassword').mockResolvedValue({
      success: true,
      data: {
        passwordChanged: true,
        changedAt: new Date().toISOString(),
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
      },
    })
    const queryClient = new QueryClient()
    await act(async () => root.render(<QueryClientProvider client={queryClient}><Security /></QueryClientProvider>))
    const inputs = Array.from(container.querySelectorAll('input[type="password"]')) as HTMLInputElement[]
    expect(inputs.length).toBeGreaterThanOrEqual(4)
    const setInput = (input: HTMLInputElement, value: string) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
      setter.call(input, value)
      input.dispatchEvent(new Event('input', { bubbles: true }))
    }
    await act(async () => {
      setInput(inputs[1], 'NewPassword123!')
      setInput(inputs[2], 'NewPassword123!')
      setInput(inputs[3], 'OldPassword123!')
    })
    const button = Array.from(container.querySelectorAll('button'))
      .find((element) => element.textContent?.includes('Update Password'))
    expect(button).toBeDefined()
    await act(async () => button!.click())
    expect(authApi.changePassword).toHaveBeenCalledWith('OldPassword123!', 'NewPassword123!')
    expect(apiClient.getToken()).toBe('new-access-token')
    expect((apiClient as unknown as { getRefreshToken: () => string | null }).getRefreshToken()).toBe('new-refresh-token')
    expect(apiClient.isAuthenticated()).toBe(true)
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
  })
})
