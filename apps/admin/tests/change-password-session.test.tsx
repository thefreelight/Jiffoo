// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ProfileSecurityCard } from '@/components/profile/ProfileSecurityCard'
import { useChangePassword } from '@/lib/hooks/use-api'
import { apiClient, authApi } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import { merchant } from '../../../packages/shared/src/i18n/messages/en/merchant'

vi.mock('shared/src/i18n/react', () => ({ useT: () => (key: string) => key.startsWith('merchant.profileView.') ? merchant.profileView[key.split('.').at(-1) as keyof typeof merchant.profileView] : key }))

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
    await act(async () => Array.from(container.querySelectorAll('button')).find(button => button.textContent === 'Change password')!.click())
    const inputs = Array.from(document.body.querySelectorAll('input[type="password"]')) as HTMLInputElement[]
    expect(inputs.length).toBe(3)
    const setInput = (input: HTMLInputElement, value: string) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
      setter.call(input, value)
      input.dispatchEvent(new Event('input', { bubbles: true }))
    }
    await act(async () => {
      setInput(inputs[0], 'OldPassword123!')
      setInput(inputs[1], 'NewPassword123!')
      setInput(inputs[2], 'NewPassword123!')
    })
    const button = Array.from(document.body.querySelectorAll<HTMLButtonElement>('[role="dialog"] button'))
      .find((element) => element.textContent === 'Change password')
    expect(button).toBeDefined()
    await act(async () => button!.click())
    expect(authApi.changePassword).toHaveBeenCalledWith('OldPassword123!', 'NewPassword123!')
    expect(apiClient.getToken()).toBe('new-access-token')
    expect((apiClient as unknown as { getRefreshToken: () => string | null }).getRefreshToken()).toBe('new-refresh-token')
    expect(apiClient.isAuthenticated()).toBe(true)
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
  })
})
