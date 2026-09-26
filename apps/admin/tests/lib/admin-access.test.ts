import { describe, expect, it } from 'vitest'
import {
  getFirstAccessibleAdminPath, getSystemNavHref, hasAdminWorkspaceAccess,
} from '../../lib/admin-access'

describe('Admin access policy', () => {
  it('admits only ADMIN accounts to the workspace', () => {
    expect(hasAdminWorkspaceAccess({ role: 'ADMIN' })).toBe(true)
    expect(hasAdminWorkspaceAccess({ role: 'USER' })).toBe(false)
    expect(hasAdminWorkspaceAccess(null)).toBe(false)
  })

  it('uses the same dashboard for all administrators', () => {
    expect(getFirstAccessibleAdminPath({ role: 'ADMIN' }, 'en')).toBe('/en/dashboard')
    expect(getSystemNavHref({ role: 'ADMIN' }, 'en')).toBe('/en/dashboard')
  })
})
