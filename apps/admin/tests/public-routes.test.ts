import { describe, expect, it } from 'vitest'
import { isPublicAdminRoute } from '@/components/layout/public-routes'

describe('Admin public routes', () => {
  const publicPaths = [
    '/auth/login', '/auth/register', '/auth/accept-invite',
    '/auth/forgot-password', '/auth/reset-password', '/install',
  ]

  for (const locale of ['en', 'zh-Hans', 'zh-Hant']) {
    for (const path of publicPaths) {
      it(`allows /${locale}${path}`, () => {
        expect(isPublicAdminRoute(`/${locale}${path}`)).toBe(true)
        expect(isPublicAdminRoute(`/${locale}${path}?token=example#form`)).toBe(true)
      })
    }

    it(`rejects embedded public paths in ${locale}`, () => {
      expect(isPublicAdminRoute(`/${locale}/orders/auth/reset-password`)).toBe(false)
      expect(isPublicAdminRoute(`/${locale}/products/x-install`)).toBe(false)
      expect(isPublicAdminRoute(`/${locale}/auth/login/extra`)).toBe(false)
    })
  }

  it('rejects paths without a supported locale', () => {
    expect(isPublicAdminRoute('/auth/login')).toBe(false)
    expect(isPublicAdminRoute('/fr/auth/login')).toBe(false)
  })
})
