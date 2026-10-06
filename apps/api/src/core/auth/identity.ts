import { prisma } from '@/config/database';

export const authUserSelect = {
  id: true, email: true, username: true, password: true, role: true,
  isActive: true, avatar: true, sessionVersion: true, emailVerified: true,
} as const;
const authIdentitySelect = { ...authUserSelect, password: false } as const;

export const findAuthUserByEmail = (email: string) => prisma.user.findUnique({ where: { email }, select: authUserSelect });
export const findAuthUserById = (id: string) => prisma.user.findUnique({ where: { id }, select: authUserSelect });
export const findAuthIdentityById = (id: string) => prisma.user.findUnique({ where: { id }, select: authIdentitySelect });
export async function findAuthUserByIdentifier(identifier: string) {
  const normalized = identifier.trim();
  if (normalized.includes('@')) return findAuthUserByEmail(normalized);
  const users = await prisma.user.findMany({ where: { username: normalized }, take: 2, select: authUserSelect });
  return users.length === 1 ? users[0] : null;
}
export const createAuthUser = (data: { email: string; username: string; password: string; role: string; emailVerified?: boolean }) =>
  prisma.user.create({ data: { ...data, emailVerified: data.emailVerified ?? false }, select: authUserSelect });
