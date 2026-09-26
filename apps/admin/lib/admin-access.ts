import type { UserProfile } from 'shared'

export function hasAdminWorkspaceAccess(user: Pick<UserProfile, 'role'> | null | undefined): boolean {
  return user?.role === 'ADMIN'
}

export function getSystemNavHref(_user: Pick<UserProfile, 'role'> | null | undefined, locale: string): string {
  return `/${locale}/dashboard`
}

export function getFirstAccessibleAdminPath(_user: Pick<UserProfile, 'role'> | null | undefined, locale: string): string {
  return `/${locale}/dashboard`
}
