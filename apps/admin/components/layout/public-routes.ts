const publicRoutes = new Set([
  '/auth/login',
  '/auth/register',
  '/auth/accept-invite',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/install',
])

export function isPublicAdminRoute(pathname: string): boolean {
  const path = pathname.split(/[?#]/, 1)[0]
  const match = /^\/(en|zh-Hans|zh-Hant)(\/.*)$/.exec(path)
  return match !== null && publicRoutes.has(match[2])
}
